import test from 'node:test';
import assert from 'node:assert/strict';
const mod = await import('../src/data/mediaClient.js').catch(() => ({}));
const workspaceId = 'ccb5017e-7c70-414d-b103-38e17e48e799', scope = { workspaceId, offerId: '675246155709' };
const config = { mode: 'cloud', url: 'https://unit.supabase.co', publishableKey: 'public' };
test('media transport rejects old session responses and aborts in-flight requests', async () => {
  assert.equal(typeof mod.createMediaClient, 'function');
  let generation = 0, resolve, signal;
  const client = mod.createMediaClient({ config, workspaceId, getAccessToken: async () => 'private-token', getGeneration: () => generation, fetchImpl: (_, init) => { signal = init.signal; return new Promise(r => { resolve = r; }); } });
  const pending = client.list(scope); await new Promise(r => setImmediate(r)); generation++; client.abort();
  assert.equal(signal.aborted, true); resolve(Response.json({ draft: {} }));
  await assert.rejects(pending, { code: 'SESSION_CHANGED' });
});
test('binary reads enforce MIME/size and scoped requests cannot supply arbitrary endpoint or workspace', async () => {
  assert.equal(typeof mod.createMediaClient, 'function');
  let calls = 0;
  const client = mod.createMediaClient({ config, workspaceId, getAccessToken: async () => 'private-token', getGeneration: () => 0, fetchImpl: async () => { calls++; return new Response('<html>login</html>', { headers: { 'content-type': 'text/html' } }); } });
  await assert.rejects(client.read(scope, crypto.randomUUID()), { code: 'MEDIA_RESPONSE_INVALID' });
  await assert.rejects(client.list({ ...scope, workspaceId: crypto.randomUUID() }), { code: 'MEDIA_SCOPE_INVALID' }); assert.equal(calls, 1);
});
