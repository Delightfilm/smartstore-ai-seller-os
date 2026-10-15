import test from 'node:test';
import assert from 'node:assert/strict';

const mod = await import('../src/domain/detailMedia.js').catch(() => ({}));
const candidate = { offerId: '675246155709', revision: 4, publication: { status: 'NOT_PUBLISHED' } };
const assets = [{ id: 'a', offerId: candidate.offerId, status: 'READY' }, { id: 'b', offerId: candidate.offerId, status: 'READY' }];
const checks = { optionMatch: true, copyFacts: true, imageRights: true, unknownsLabelled: true };
const input = () => ({ title: '메모함', intro: '내부 검토', panels: [{ assetId: 'a', copy: '', alt: '' }], review: { status: 'REVIEW_REQUIRED', checks, note: '' } });

test('draft validation rejects duplicate, foreign, missing and unknown input without changing candidate', () => {
  assert.equal(typeof mod.validateDraft, 'function');
  const before = structuredClone(candidate);
  for (const panels of [[{ assetId: 'x', copy: '', alt: '' }], [input().panels[0], input().panels[0]]]) {
    assert.throws(() => mod.validateDraft({ candidate, previous: null, input: { ...input(), panels }, assets }), { code: 'MEDIA_DRAFT_INVALID' });
  }
  assert.throws(() => mod.validateDraft({ candidate, input: input(), assets: [{ ...assets[0], offerId: 'other' }] }), { code: 'MEDIA_DRAFT_INVALID' });
  assert.throws(() => mod.validateDraft({ candidate, input: { ...input(), revision: 12 }, assets }), { code: 'MEDIA_DRAFT_INVALID' });
  assert.deepEqual(candidate, before);
});

test('internal review needs ready images and all checks; content changes invalidate previous review', () => {
  assert.equal(typeof mod.validateDraft, 'function');
  for (const patch of [{ panels: [] }, { review: { status: 'REVIEWED_INTERNAL', checks: { ...checks, imageRights: false }, note: '' } }]) {
    assert.throws(() => mod.validateDraft({ candidate, input: { ...input(), review: { ...input().review, status: 'REVIEWED_INTERNAL' }, ...patch }, assets }), { code: 'MEDIA_DRAFT_INVALID' });
  }
  const previous = mod.validateDraft({ candidate, input: { ...input(), review: { ...input().review, status: 'REVIEWED_INTERNAL' } }, assets });
  assert.equal(previous.review.status, 'REVIEWED_INTERNAL');
  const changed = mod.validateDraft({ candidate, previous, input: { ...input(), intro: '변경', review: previous.review }, assets });
  assert.equal(changed.review.status, 'REVIEW_REQUIRED');
  const view = mod.draftView({ draft: previous, candidate: { ...candidate, revision: 5 }, assets });
  assert.equal(view.stale, true);
  assert.equal(view.draft.review.status, 'REVIEW_REQUIRED');
});

test('empty draft starts at revision zero, text bounds and state are strict', () => {
  assert.equal(typeof mod.draftView, 'function');
  assert.equal(mod.draftView({ candidate, assets: [] }).draft.revision, 0);
  for (const patch of [{ title: 'x'.repeat(201) }, { review: { ...input().review, status: 'APPROVED' } }, { intro: 1 }]) {
    assert.throws(() => mod.validateDraft({ candidate, input: { ...input(), ...patch }, assets }), { code: 'MEDIA_DRAFT_INVALID' });
  }
});
