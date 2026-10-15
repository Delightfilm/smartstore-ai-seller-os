import test from 'node:test';
import assert from 'node:assert/strict';
const mod = await import('../src/dashboard/detailMediaController.js').catch(() => ({}));
const scope = { workspaceId: 'ccb5017e-7c70-414d-b103-38e17e48e799', offerId: '675246155709' };
const snapshot = () => ({ draft: { revision: 2, sourceCandidateRevision: 4, title: '메모함', intro: '', panels: [{ assetId: 'a', copy: '', alt: '' }, { assetId: 'b', copy: '', alt: '' }], review: { status: 'REVIEW_REQUIRED', checks: { optionMatch: false, copyFacts: false, imageRights: false, unknownsLabelled: false }, note: '' } }, candidateRevision: 4, stale: false, assets: [{ id: 'a', status: 'READY' }, { id: 'b', status: 'READY' }], budget: { enabled: true, enabledUntil: new Date(Date.now() + 100000).toISOString(), readRemaining: 10000 } });
function setup(overrides = {}) {
  assert.equal(typeof mod.createDetailMediaController, 'function');
  let state; const revoked = [];
  const client = { list: async () => snapshot(), save: async (_, req) => ({ ...snapshot(), draft: { ...req.draft, revision: 3, sourceCandidateRevision: 4 } }), read: async () => ({ bytes: new Uint8Array([1]), mime: 'image/png' }), abort() {}, ...overrides };
  const c = mod.createDetailMediaController({ client, onState: s => { state = s; }, createObjectURL: () => 'blob:private', revokeObjectURL: u => revoked.push(u) });
  return { c, state: () => state, revoked };
}
test('dirty scope/revision changes preserve edits, confirmed save persists order/copy and source invalidates review', async () => {
  const { c, state } = setup(); await c.load(scope, 4);
  c.edit({ intro: '검수 전 카피', panels: [{ assetId: 'b', copy: '새 카피', alt: '' }, { assetId: 'a', copy: '', alt: '' }] });
  assert.equal(c.requestSwitch({ ...scope, offerId: '816692570613' }).confirmationRequired, true);
  await c.load(scope, 5); assert.equal(state().conflict, true); assert.equal(state().draft.intro, '검수 전 카피');
  c.dispose();
  const next = setup(); await next.c.load(scope, 4); next.c.edit({ panels: [{ assetId: 'b', copy: '카피', alt: '' }] }); await next.c.save();
  assert.equal(next.state().draft.panels[0].assetId, 'b'); assert.equal(next.state().dirty, false);
});
test('preview coalesces reads, revokes URLs and ignores late results after disposal', async () => {
  let resolve, calls = 0; const { c, state, revoked } = setup({ read: () => { calls++; return new Promise(r => { resolve = r; }); } });
  await c.load(scope, 4); const one = c.preview('a'), two = c.preview('a'); assert.equal(calls, 1);
  resolve({ bytes: new Uint8Array([1]), mime: 'image/png' }); await Promise.all([one, two]); assert.equal(state().previewUrls.a, 'blob:private');
  c.dispose(); assert.deepEqual(revoked, ['blob:private']);
  let late; const next = setup({ read: () => new Promise(r => { late = r; }) }); await next.c.load(scope, 4); const p = next.c.preview('a'); next.c.dispose(); late({ bytes: new Uint8Array([1]), mime: 'image/png' }); await p; assert.deepEqual(next.state().previewUrls, {});
});
test('file choice sends nothing; double-submit and uncertain retries preserve one request identity', async () => {
  let calls = 0; const ids = [];
  const { c, state } = setup({ upload: async (_, req) => { calls++; ids.push(req.requestId); if (calls === 1) throw new TypeError('network'); return snapshot(); } });
  await c.load(scope, 4); c.selectFiles([new File(['x'], 'gpt.png', { type: 'image/png' })]); assert.equal(calls, 0);
  await Promise.all([c.uploadSelected(), c.uploadSelected()]); assert.equal(calls, 1); assert.equal(state().selectedFiles.length, 1);
  await c.uploadSelected(); assert.equal(ids[0], ids[1]); assert.equal(state().selectedFiles.length, 0);
});

test('stale source has explicit re-review path preserving copy but clearing prior checks', async () => {
  const original = snapshot(); original.stale = true; original.candidateRevision = 5; original.draft.review = { ...original.draft.review, status: 'REVIEW_REQUIRED' };
  const { c, state } = setup({ list: async () => original }); await c.load(scope, 5);
  assert.equal(typeof c.rebase, 'function'); await c.rebase();
  assert.equal(state().conflict, false); assert.equal(state().draft.title, '메모함'); assert.equal(state().draft.sourceCandidateRevision, 5);
  assert.equal(state().contentDirty, true); assert.ok(Object.values(state().draft.review.checks).every(v => v === false));
});
test('late upload success cannot clear a newly observed source conflict', async () => {
  let resolve;
  const { c, state } = setup({ upload: () => new Promise(r => { resolve = r; }) });
  await c.load(scope, 4); c.selectFiles([new File(['x'], 'gpt.png', { type: 'image/png' })]);
  const p = c.uploadSelected(); await c.load(scope, 5); assert.equal(state().conflict, true);
  resolve(snapshot()); await p;
  assert.equal(state().conflict, true); assert.equal(state().busy, false); assert.notEqual(state().message, '선택한 파일을 비공개 클라우드에 저장했습니다.');
});
