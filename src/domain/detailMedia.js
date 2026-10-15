export const MEDIA_LIMITS = Object.freeze({ fileBytes: 4 * 1024 * 1024, dimension: 16384, pixels: 32000000, decodePixels: 8000000, assets: 20, productBytes: 24 * 1024 * 1024, workspaceBytes: 64 * 1024 * 1024 });
const checkNames = ['optionMatch', 'copyFacts', 'imageRights', 'unknownsLabelled'];
function invalid() { throw Object.assign(new Error('상세페이지 초안 형식 또는 검수 조건이 올바르지 않습니다.'), { code: 'MEDIA_DRAFT_INVALID', status: 400 }); }
function shape(value, names) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !names.includes(k)) || names.some(k => !Object.hasOwn(value, k))) invalid();
}
function text(value, length) { if (typeof value !== 'string' || [...value].length > length) invalid(); return value; }
export function emptyDraft(candidate) {
  return { revision: 0, sourceCandidateRevision: candidate.revision, title: '', intro: '', panels: [], review: { status: 'REVIEW_REQUIRED', checks: Object.fromEntries(checkNames.map(k => [k, false])), note: '' } };
}
export function validateDraft({ candidate, previous, input, assets }) {
  shape(input, ['title', 'intro', 'panels', 'review']);
  shape(input.review, ['status', 'checks', 'note']); shape(input.review.checks, checkNames);
  if (!['DRAFT', 'REVIEW_REQUIRED', 'REVIEWED_INTERNAL'].includes(input.review.status) || checkNames.some(k => typeof input.review.checks[k] !== 'boolean')) invalid();
  if (!Array.isArray(input.panels) || input.panels.length > MEDIA_LIMITS.assets) invalid();
  const seen = new Set();
  const panels = input.panels.map(p => {
    shape(p, ['assetId', 'copy', 'alt']);
    const asset = assets.find(a => a.id === p.assetId && a.status === 'READY' && (!a.offerId || a.offerId === candidate.offerId));
    if (!asset || seen.has(p.assetId)) invalid(); seen.add(p.assetId);
    return { assetId: p.assetId, copy: text(p.copy, 2000), alt: text(p.alt, 300) };
  });
  const draft = { revision: (previous?.revision ?? 0) + 1, sourceCandidateRevision: candidate.revision, title: text(input.title, 200), intro: text(input.intro, 4000), panels, review: { status: input.review.status, checks: { ...input.review.checks }, note: text(input.review.note, 2000) } };
  if (draft.review.status === 'REVIEWED_INTERNAL' && (!panels.length || checkNames.some(k => !draft.review.checks[k]))) invalid();
  if (previous && (previous.sourceCandidateRevision !== candidate.revision || previous.title !== draft.title || previous.intro !== draft.intro || JSON.stringify(previous.panels) !== JSON.stringify(panels))) {
    draft.review.status = 'REVIEW_REQUIRED'; draft.review.checks = Object.fromEntries(checkNames.map(k => [k, false]));
  }
  return draft;
}
export function draftView({ draft, candidate, assets }) {
  const current = structuredClone(draft ?? emptyDraft(candidate));
  const stale = current.sourceCandidateRevision !== candidate.revision;
  if (stale) { current.review.status = 'REVIEW_REQUIRED'; current.review.checks = Object.fromEntries(checkNames.map(k => [k, false])); }
  return { draft: current, candidateRevision: candidate.revision, stale, assets };
}
