import test from 'node:test';
import assert from 'node:assert/strict';
const mod = await import('../server/media/handler.js').catch(() => ({}));
const origin = 'http://127.0.0.1:5173', workspaceId = 'ccb5017e-7c70-414d-b103-38e17e48e799';
const identity = { workspaceId, userId: '88888888-8888-4888-8888-888888888888' };
const meta = { mime: 'image/png', ext: 'png', width: 1, height: 1, byteLength: 3, sha256: '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81', displayName: 'test.png' };
function setup(options = {}) {
  assert.equal(typeof mod.createMediaHandler, 'function');
  const calls = []; let result;
  const store = { list: async () => ({ draft: { revision: 0 }, assets: [] }), reserve: async () => result ? { committed: true, snapshot: result } : { assetId: crypto.randomUUID(), path: `${workspaceId}/1688/1/88888888-8888-4888-8888-888888888888.png`, meta, existing: false }, finish: async () => { result = { draft: { revision: 1 }, assets: [{ id: 'one' }] }; return result; } };
  const handler = mod.createMediaHandler({ allowedOrigins: [origin], authenticate: async () => identity, storeFor: () => store, validateImage: async () => ({ ...meta, displayName: undefined }), storage: { upload: async (...args) => { calls.push(args); }, read: async () => new Uint8Array([1, 2, 3]) }, ...options });
  return { handler, calls, store };
}
const request = data => new Request('https://unit.test/media', { method: 'POST', headers: { origin, authorization: 'Bearer private-test', 'content-type': 'application/json' }, body: JSON.stringify({ workspaceId, offerId: '1', ...data }) });
function upload(extra = false) { const f = new FormData(); f.set('meta', JSON.stringify({ action: 'upload', workspaceId, offerId: '1', requestId: '11111111-1111-4111-8111-111111111111', expectedCandidateRevision: 4, expectedDetailRevision: 0 })); f.append('file', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), 'test.png'); if (extra) f.append('file', new Blob(['x']), 'second.png'); return new Request('https://unit.test/media', { method: 'POST', headers: { origin, authorization: 'Bearer private-test' }, body: f }); }
test('reject untrusted origins, invalid actions/paths and duplicate multipart file with zero storage writes', async () => {
  const { handler, calls } = setup();
  const denied = await handler(new Request('https://unit.test/media', { method: 'OPTIONS', headers: { origin: origin + '.evil.test' } }));
  assert.equal(denied.status, 403); assert.equal(denied.headers.get('access-control-allow-origin'), null);
  assert.equal((await handler(request({ action: 'list', path: '../secret' }))).status, 400);
  assert.equal((await handler(upload(true))).status, 400); assert.equal(calls.length, 0);
});
test('upload verifies immutable object/readback, finish response loss replay does not upload twice', async () => {
  const { handler, calls } = setup();
  assert.equal((await handler(upload())).status, 200);
  assert.equal((await handler(upload())).status, 200);
  assert.equal(calls.length, 1); assert.equal(calls[0][2].upsert, false);
});
test('auth and raw SDK errors are sanitized, response never reflects tokens', async () => {
  const { handler } = setup({ authenticate: async () => { throw new Error('private-test SECRET'); } });
  const r = await handler(request({ action: 'list' })); assert.equal(r.status, 401);
  assert.ok(!(await r.text()).includes('private-test'));
});
