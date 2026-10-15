const fail = (code, status) => Object.assign(new Error(code), { code, status });
async function bounded(response, limit) {
  if (!response.body) throw fail('MEDIA_RESPONSE_INVALID');
  const reader = response.body.getReader(); let size = 0; const chunks = [];
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) { void reader.cancel(); throw fail('MEDIA_RESPONSE_INVALID'); } chunks.push(value); } }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let pos = 0; for (const c of chunks) { bytes.set(c, pos); pos += c.length; } return bytes;
}
export function createMediaClient({ config, workspaceId, getAccessToken, fetchImpl = fetch, getGeneration = () => 0 }) {
  let epoch = 0; const active = new Set();
  async function request(scope, action, payload = {}) {
    if (config.mode !== 'cloud') throw fail('MEDIA_CLOUD_REQUIRED');
    if (scope.workspaceId !== workspaceId || !/^\d{1,32}$/.test(scope.offerId)) throw fail('MEDIA_SCOPE_INVALID');
    const endpoint = new URL(config.url);
    if (endpoint.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(endpoint.hostname) || endpoint.username || endpoint.password || endpoint.port || endpoint.pathname !== '/' || endpoint.search || endpoint.hash) throw fail('MEDIA_SCOPE_INVALID');
    const generation = getGeneration(), captured = epoch;
    const check = () => { if (generation !== getGeneration() || captured !== epoch) throw fail('SESSION_CHANGED'); };
    const token = await getAccessToken(); check(); if (!token) throw fail('SIGN_IN_REQUIRED', 401);
    const controller = new AbortController(); active.add(controller); const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const input = { action, workspaceId, offerId: scope.offerId, ...payload };
      const headers = { authorization: `Bearer ${token}`, apikey: config.publishableKey }; let body;
      if (action === 'upload') { body = new FormData(); const { file, ...meta } = input; body.set('meta', JSON.stringify(meta)); body.set('file', file, file.name); }
      else { body = JSON.stringify(input); headers['content-type'] = 'application/json'; }
      const response = await fetchImpl(`${endpoint.origin}/functions/v1/seller-os-media`, { method: 'POST', headers, body, signal: controller.signal, redirect: 'error', cache: 'no-store' }); check();
      if (action === 'read' && response.ok) {
        const mime = response.headers.get('content-type')?.split(';')[0]; if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime)) throw fail('MEDIA_RESPONSE_INVALID');
        const bytes = await bounded(response, 4194304); check(); return { bytes, mime };
      }
      const bytes = await bounded(response, 131072); check(); let result;
      try { result = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw fail('MEDIA_RESPONSE_INVALID'); }
      if (!response.ok) throw fail(typeof result.error === 'string' && /^[A-Z_]{1,60}$/.test(result.error) ? result.error : 'MEDIA_REQUEST_FAILED', response.status);
      return result;
    } finally { clearTimeout(timeout); active.delete(controller); }
  }
  return {
    list: scope => request(scope, 'list'),
    upload: (scope, input) => request(scope, 'upload', input),
    save: (scope, input) => request(scope, 'save', input),
    read: (scope, assetId) => request(scope, 'read', { assetId }),
    abort() { epoch++; for (const c of active) c.abort(); active.clear(); },
  };
}
