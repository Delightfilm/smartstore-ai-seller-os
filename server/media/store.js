import { failure } from '../cloud/errors.js';
const exposed = new Set(['MEDIA_BUDGET_DISABLED', 'MEDIA_QUOTA_EXCEEDED', 'MEDIA_READ_LIMIT', 'MEDIA_INPUT_INVALID', 'MEDIA_ASSET_NOT_FOUND']);
function checked({ data, error }) {
  if (error) {
    const code = error.code === '40001' ? 'REVISION_CONFLICT' : error.code === '22023' ? 'REQUEST_REUSED' : error.code === '42501' ? 'MEDIA_FORBIDDEN' : exposed.has(error.message) ? error.message : 'MEDIA_STORE_ERROR';
    throw failure(code, code === 'REVISION_CONFLICT' || code === 'REQUEST_REUSED' ? 409 : code === 'MEDIA_FORBIDDEN' ? 403 : exposed.has(code) ? 400 : 500);
  }
  return data;
}
export function createMediaStore({ writer, workspaceId, actorId }) {
  const scope = { p_workspace: workspaceId, p_actor: actorId };
  const offer = id => { if (typeof id !== 'string' || !/^\d{1,32}$/.test(id)) throw failure('MEDIA_INPUT_INVALID'); return id; };
  const rpc = async (name, args) => checked(await writer.rpc(name, { ...scope, ...args }));
  const writeArgs = input => ({ p_request: input.requestId, p_offer: offer(input.offerId), p_candidate_revision: input.expectedCandidateRevision, p_detail_revision: input.expectedDetailRevision, p_fingerprint: input.fingerprint });
  return {
    async list(id) { return rpc('seller_os_media_snapshot', { p_offer: offer(id) }); },
    async reserve(input) { return rpc('seller_os_media_reserve', { ...writeArgs(input), p_meta: input.meta }); },
    async finish(input) { return rpc('seller_os_media_finish', { p_request: input.requestId, p_object_meta: input.objectMeta }); },
    async save(input) { return rpc('seller_os_media_save', { ...writeArgs(input), p_draft: input.draft }); },
    async readPermit(id, assetId) { return rpc('seller_os_media_read_permit', { p_offer: offer(id), p_asset: assetId }); },
    async asset(id, assetId) { return (await this.list(offer(id))).assets.find(a => a.id === assetId) ?? null; },
  };
}
