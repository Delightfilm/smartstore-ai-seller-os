import test from 'node:test';
import assert from 'node:assert/strict';
const mod = await import('../server/media/store.js').catch(() => ({}));
const workspaceId = 'ccb5017e-7c70-414d-b103-38e17e48e799', actorId = '88888888-8888-4888-8888-888888888888';
test('media store maps database CAS/conflict/permission/quota failures without leaking SDK details', async () => {
  assert.equal(typeof mod.createMediaStore, 'function');
  for (const [sql, message, code] of [['40001', 'secret-token', 'REVISION_CONFLICT'], ['22023', 'secret-token', 'REQUEST_REUSED'], ['42501', 'secret-token', 'MEDIA_FORBIDDEN'], ['P0001', 'MEDIA_BUDGET_DISABLED', 'MEDIA_BUDGET_DISABLED']]) {
    const store = mod.createMediaStore({ writer: { rpc: async () => ({ error: { code: sql, message } }) }, workspaceId, actorId });
    await assert.rejects(store.save({ offerId: '675246155709', requestId: crypto.randomUUID(), expectedCandidateRevision: 4, expectedDetailRevision: 1, fingerprint: 'f', draft: {} }), e => e.code === code && !e.message.includes('secret-token'));
  }
});
test('media store binds authenticated actor/workspace, returns committed replay, never accepts arbitrary tables', async () => {
  assert.equal(typeof mod.createMediaStore, 'function');
  const seen = [];
  const result = { committed: true, snapshot: { draft: { revision: 3 }, assets: [{ id: 'immutable-id' }] } };
  const writer = { rpc: async (name, args) => { seen.push({ name, args }); return { data: result }; } };
  const store = mod.createMediaStore({ writer, workspaceId, actorId });
  const input = { offerId: '675246155709', requestId: crypto.randomUUID(), expectedCandidateRevision: 4, expectedDetailRevision: 2, fingerprint: 'abc', meta: { mime: 'image/png' } };
  assert.deepEqual(await store.reserve(input), result);
  assert.deepEqual(await store.reserve(input), result);
  assert.equal(seen[0].name, 'seller_os_media_reserve');
  assert.equal(seen[0].args.p_actor, actorId); assert.equal(seen[0].args.p_workspace, workspaceId);
  assert.deepEqual(seen[0], seen[1]);
  await assert.rejects(store.list('../outside'), { code: 'MEDIA_INPUT_INVALID' });
});
