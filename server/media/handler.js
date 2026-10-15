import { failure, uuid } from '../cloud/errors.js';
import { MEDIA_LIMITS, validateDraft } from '../../src/domain/detailMedia.js';
const JSON_LIMIT = 65536, UPLOAD_LIMIT = MEDIA_LIMITS.fileBytes + 16384;
const errorCodes = new Set(['MEDIA_INPUT_INVALID', 'MEDIA_IMAGE_INVALID', 'MEDIA_IMAGE_TOO_LARGE', 'MEDIA_DECODE_LIMIT', 'MEDIA_BUSY', 'MEDIA_BUDGET_DISABLED', 'MEDIA_QUOTA_EXCEEDED', 'MEDIA_READ_LIMIT', 'MEDIA_ASSET_NOT_FOUND', 'MEDIA_FORBIDDEN', 'REVISION_CONFLICT', 'REQUEST_REUSED', 'SIGN_IN_REQUIRED', 'SESSION_INVALID', 'WORKSPACE_FORBIDDEN', 'MEDIA_DRAFT_INVALID', 'MEDIA_STORAGE_UNCERTAIN']);
const json = (data, status, headers) => new Response(JSON.stringify(data), { status, headers: { ...headers, 'content-type': 'application/json', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
function exact(value, fields) { if (!plain(value) || Object.keys(value).some(k => !fields.includes(k)) || fields.some(k => !Object.hasOwn(value, k))) throw failure('MEDIA_INPUT_INVALID'); }
async function hash(bytes) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), v => v.toString(16).padStart(2, '0')).join(''); }
const canonical = v => Array.isArray(v) ? v.map(canonical) : plain(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
export async function boundedBody(request, limit) {
  if (!request.body) throw failure('MEDIA_INPUT_INVALID');
  const reader = request.body.getReader(), parts = []; let length = 0, timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => { void reader.cancel(); reject(failure('MEDIA_INPUT_INVALID', 408)); }, 30000); });
  try {
    for (;;) { const { value, done } = await Promise.race([reader.read(), timeout]); if (done) break; length += value.length; if (length > limit) { void reader.cancel(); throw failure('MEDIA_IMAGE_TOO_LARGE', 413); } parts.push(value); }
    const bytes = new Uint8Array(length); let offset = 0; for (const p of parts) { bytes.set(p, offset); offset += p.length; } return bytes;
  } finally { clearTimeout(timer); reader.releaseLock(); }
}
export function createMediaHandler({ allowedOrigins, authenticate, storeFor, storage, validateImage }) {
  let admitted = 0;
  return async request => {
    const origin = request.headers.get('origin');
    if (!allowedOrigins.includes(origin)) return json({ error: 'MEDIA_FORBIDDEN' }, 403, {});
    const headers = { 'access-control-allow-origin': origin, vary: 'Origin', 'access-control-allow-headers': 'authorization, apikey, content-type', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json({ error: 'MEDIA_INPUT_INVALID' }, 405, headers);
    let multipart = false, admission = false;
    try {
      const type = request.headers.get('content-type') ?? '';
      multipart = type.startsWith('multipart/form-data;');
      if (multipart) { if (admitted >= 2) throw failure('MEDIA_BUSY', 429); admitted++; admission = true; }
      else if (!/^application\/json(?:;|$)/i.test(type)) throw failure('MEDIA_INPUT_INVALID');
      const bytes = await boundedBody(request, multipart ? UPLOAD_LIMIT : JSON_LIMIT);
      let input, file;
      try {
        if (multipart) {
          const form = await new Request(request.url, { method: 'POST', headers: { 'content-type': type }, body: bytes }).formData();
          if ([...form.keys()].sort().join(',') !== 'file,meta' || typeof form.get('meta') !== 'string' || new TextEncoder().encode(form.get('meta')).length > 8192) throw failure('MEDIA_INPUT_INVALID');
          input = JSON.parse(form.get('meta')); file = form.get('file');
          if (!file || typeof file.arrayBuffer !== 'function' || file.size < 1 || file.size > MEDIA_LIMITS.fileBytes) throw failure('MEDIA_INPUT_INVALID');
        } else input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      } catch { throw failure('MEDIA_INPUT_INVALID'); }
      const base = ['action', 'workspaceId', 'offerId'];
      if (!plain(input) || !uuid(input.workspaceId) || typeof input.offerId !== 'string' || !/^\d{1,32}$/.test(input.offerId)) throw failure('MEDIA_INPUT_INVALID');
      if (input.action === 'list' && !multipart) exact(input, base);
      else if (input.action === 'read' && !multipart) { exact(input, [...base, 'assetId']); if (!uuid(input.assetId)) throw failure('MEDIA_INPUT_INVALID'); }
      else if (['save', 'upload'].includes(input.action) && multipart === (input.action === 'upload')) {
        exact(input, [...base, 'requestId', 'expectedCandidateRevision', 'expectedDetailRevision', ...(input.action === 'save' ? ['draft'] : [])]);
        if (!uuid(input.requestId) || !Number.isSafeInteger(input.expectedCandidateRevision) || input.expectedCandidateRevision < 1 || !Number.isSafeInteger(input.expectedDetailRevision) || input.expectedDetailRevision < 0) throw failure('MEDIA_INPUT_INVALID');
      } else throw failure('MEDIA_INPUT_INVALID');
      let identity;
      try { identity = await authenticate({ authorization: request.headers.get('authorization'), workspaceId: input.workspaceId }); }
      catch (e) { if (errorCodes.has(e.code)) throw e; throw failure('SIGN_IN_REQUIRED', 401); }
      if (identity.workspaceId !== input.workspaceId) throw failure('MEDIA_FORBIDDEN', 403);
      const store = storeFor(identity);
      if (input.action === 'list') return json(await store.list(input.offerId), 200, headers);
      const verifyObject = async (path, meta) => {
        const object = await storage.read(path);
        if (!(object instanceof Uint8Array) || object.length > MEDIA_LIMITS.fileBytes || object.length !== meta.byteLength || await hash(object) !== meta.sha256) throw failure('MEDIA_STORAGE_UNCERTAIN', 503);
        return object;
      };
      const safePath = path => { if (typeof path !== 'string' || !new RegExp(`^${identity.workspaceId}/1688/${input.offerId}/[a-f0-9-]{36}\\.(png|jpg|webp)$`).test(path)) throw failure('MEDIA_FORBIDDEN', 403); return path; };
      if (input.action === 'read') {
        const permit = await store.readPermit(input.offerId, input.assetId);
        const object = await verifyObject(safePath(permit.path), permit.meta);
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(permit.meta.mime)) throw failure('MEDIA_STORAGE_UNCERTAIN', 503);
        return new Response(object, { headers: { ...headers, 'content-type': permit.meta.mime, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
      }
      if (input.action === 'save') {
        const snapshot = await store.list(input.offerId);
        validateDraft({ candidate: { offerId: input.offerId, revision: input.expectedCandidateRevision }, previous: snapshot.draft, input: input.draft, assets: snapshot.assets });
        const fingerprint = await hash(new TextEncoder().encode(JSON.stringify(canonical(input))));
        return json(await store.save({ ...input, fingerprint }), 200, headers);
      }
      const payload = new Uint8Array(await file.arrayBuffer());
      const validated = await validateImage(payload, file.type);
      const displayName = [...file.name.replaceAll('\\', '/').split('/').at(-1).replace(/[\x00-\x1f\x7f]/g, '')].slice(0, 120).join('') || 'image';
      const meta = { ...validated, displayName };
      const fingerprint = await hash(new TextEncoder().encode(JSON.stringify(canonical({ ...input, meta }))));
      const reservation = await store.reserve({ ...input, fingerprint, meta });
      if (reservation.committed) return json(reservation.snapshot, 200, headers);
      const path = safePath(reservation.path);
      // Never allocate a second object key or overwrite after an uncertain response.
      if (reservation.existing) {
        try { await verifyObject(path, meta); }
        catch (e) { if (e.code !== 'MEDIA_OBJECT_MISSING') throw e; await storage.upload(path, payload, { upsert: false, contentType: meta.mime }); await verifyObject(path, meta); }
      } else {
        try { await storage.upload(path, payload, { upsert: false, contentType: meta.mime }); }
        catch { /* One fixed-key readback resolves an uncertain upload; no re-upload. */ }
        await verifyObject(path, meta);
      }
      return json(await store.finish({ requestId: input.requestId, objectMeta: meta }), 200, headers);
    } catch (e) {
      const code = errorCodes.has(e.code) ? e.code : 'MEDIA_STORAGE_UNCERTAIN';
      return json({ error: code }, errorCodes.has(e.code) ? (e.status ?? 400) : 503, headers);
    } finally { if (admission) admitted--; }
  };
}
