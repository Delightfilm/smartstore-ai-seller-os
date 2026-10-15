import { MEDIA_LIMITS } from '../domain/detailMedia.js';
const messages = {
 MEDIA_CLOUD_REQUIRED: '비공개 클라우드 설정이 필요합니다. 로컬 파일 저장으로 대체하지 않습니다.',
 MEDIA_BUDGET_DISABLED: '무료 사용량 확인 기간이 만료되었거나 저장이 비활성입니다. 사용량을 재확인해야 합니다.',
 MEDIA_READ_LIMIT: '미리보기 전송 예산을 소진했습니다. 무료 사용량 재확인이 필요합니다.',
 MEDIA_QUOTA_EXCEEDED: '보관 용량 또는 파일 개수 한도입니다. 초안에서 제외해도 보관 용량은 줄지 않습니다.',
 REVISION_CONFLICT: '후보 또는 초안이 변경됐습니다. 변경 내용을 복사한 뒤 최신 상태를 다시 불러오세요.',
 SESSION_CHANGED: '로그인 계정이 변경됐습니다. 현재 계정으로 다시 여세요.',
 MEDIA_IMAGE_INVALID: '손상되었거나 지원하지 않는 이미지입니다. 정적 PNG/JPEG/WebP를 선택하세요.',
 MEDIA_DECODE_LIMIT: '이미지 검증 한도는 8MP입니다. 긴 이미지를 작은 패널로 나누어 주세요.',
};
const copyInput = d => structuredClone({ title: d.title, intro: d.intro, panels: d.panels, review: d.review });
export function createDetailMediaController({ client, onState, createObjectURL = URL.createObjectURL, revokeObjectURL = URL.revokeObjectURL }) {
  let state = { scope: null, draft: null, assets: [], selectedFiles: [], dirty: false, busy: false, message: '', previewUrls: {}, conflict: false, budget: null, contentDirty: false, uncertain: false };
  let epoch = 0, disposed = false, pendingSave = null; const reads = new Map();
  const emit = patch => { if (!disposed) { state = { ...state, ...patch }; onState(state); } };
  const cleanup = () => { for (const url of Object.values(state.previewUrls)) revokeObjectURL(url); reads.clear(); state = { ...state, previewUrls: {} }; };
  const allowed = () => state.budget?.enabled === true && new Date(state.budget.enabledUntil).getTime() > Date.now();
  const apply = snapshot => emit({ ...snapshot, contentDirty: false, dirty: state.selectedFiles.length > 0, conflict: false, uncertain: false });
  const report = e => emit({ message: messages[e.code] || `서버 저장 확인이 필요합니다 (${e.code || '통신 오류'}). 같은 요청으로 다시 확인하거나 최신 상태를 불러오세요.`, conflict: e.code === 'REVISION_CONFLICT' || state.conflict, uncertain: !e.status || e.status >= 500 });
  const current = captured => !disposed && epoch === captured;
  const api = {
    async load(scope, candidateRevision) {
      if (disposed) return;
      if (state.dirty && state.scope?.offerId === scope.offerId && state.draft?.sourceCandidateRevision !== candidateRevision) { emit({ conflict: true, message: messages.REVISION_CONFLICT }); return; }
      const captured = ++epoch; client.abort(); cleanup(); pendingSave = null;
      emit({ scope: { ...scope }, draft: null, assets: [], selectedFiles: [], dirty: false, contentDirty: false, busy: true, conflict: false, uncertain: false, message: '', budget: null });
      try { const snapshot = await client.list(scope); if (current(captured)) { apply(snapshot); if (snapshot.stale || snapshot.candidateRevision !== candidateRevision) emit({ conflict: true, message: messages.REVISION_CONFLICT }); } }
      catch (e) { if (current(captured)) report(e); } finally { if (current(captured)) emit({ busy: false }); }
    },
    edit(patch) {
      if (disposed || state.busy || !state.draft || state.conflict || state.uncertain) return;
      const changed = ['title', 'intro', 'panels'].some(k => Object.hasOwn(patch, k) && JSON.stringify(patch[k]) !== JSON.stringify(state.draft[k]));
      const draft = { ...state.draft, ...structuredClone(patch) };
      if (changed) draft.review = { ...draft.review, status: 'REVIEW_REQUIRED', checks: Object.fromEntries(Object.keys(draft.review.checks).map(k => [k, false])) };
      pendingSave = null; emit({ draft, dirty: true, contentDirty: true, message: '' });
    },
    selectFiles(files) {
      if (disposed || state.busy || state.uncertain) return;
      const list = Array.from(files);
      if (list.length + state.assets.length > MEDIA_LIMITS.assets || list.some(f => !['image/png', 'image/jpeg', 'image/webp'].includes(f.type) || f.size < 1 || f.size > MEDIA_LIMITS.fileBytes)) { emit({ message: '제품당 보관 파일 20개, 파일당 4MiB 이하의 정적 PNG/JPEG/WebP만 가능합니다.' }); return; }
      emit({ selectedFiles: list.map(file => ({ file, request: null, message: '로컬 선택 · 미저장' })), dirty: state.contentDirty || list.length > 0, message: '' });
    },
    async uploadSelected() {
      if (disposed || state.busy || !state.draft || state.conflict || state.contentDirty || !state.selectedFiles.length) return;
      if (!allowed()) { emit({ message: messages.MEDIA_BUDGET_DISABLED }); return; }
      const captured = epoch, scope = { ...state.scope }; emit({ busy: true, message: '' });
      try {
        while (state.selectedFiles.length && current(captured)) {
          const entry = state.selectedFiles[0];
          entry.request ??= { file: entry.file, requestId: crypto.randomUUID(), expectedCandidateRevision: state.candidateRevision, expectedDetailRevision: state.draft.revision };
          try {
            const snapshot = await client.upload(scope, entry.request); if (!current(captured)) return;
            emit({ selectedFiles: state.selectedFiles.slice(1) }); apply(snapshot);
          } catch (e) { if (current(captured)) { entry.message = '미저장 · 같은 요청으로 확인 필요'; report(e); } return; }
        }
        if (current(captured)) emit({ message: '선택한 파일을 비공개 클라우드에 저장했습니다.', dirty: false });
      } finally { if (current(captured)) emit({ busy: false }); }
    },
    async save() {
      if (disposed || state.busy || !state.draft || state.conflict || !state.contentDirty) return false;
      const captured = epoch;
      pendingSave ??= { requestId: crypto.randomUUID(), expectedCandidateRevision: state.candidateRevision, expectedDetailRevision: state.draft.revision, draft: copyInput(state.draft) };
      emit({ busy: true, message: '' });
      try { const snapshot = await client.save(state.scope, pendingSave); if (!current(captured)) return false; pendingSave = null; apply(snapshot); emit({ message: '초안 저장 완료 · 내부 검수는 판매 승인이 아닙니다.' }); return true; }
      catch (e) { if (current(captured)) report(e); return false; } finally { if (current(captured)) emit({ busy: false }); }
    },
    preview(assetId) {
      if (disposed || !state.assets.some(a => a.id === assetId && a.status === 'READY')) return Promise.resolve();
      if (state.previewUrls[assetId]) return Promise.resolve(state.previewUrls[assetId]);
      if (reads.has(assetId)) return reads.get(assetId);
      if (!allowed()) { emit({ message: messages.MEDIA_BUDGET_DISABLED }); return Promise.resolve(); }
      const captured = epoch;
      const promise = client.read(state.scope, assetId).then(({ bytes, mime }) => {
        if (!current(captured)) return;
        const url = createObjectURL(new Blob([bytes], { type: mime })); emit({ previewUrls: { ...state.previewUrls, [assetId]: url } }); return url;
      }).catch(e => { if (current(captured)) report(e); }).finally(() => { if (current(captured)) reads.delete(assetId); });
      reads.set(assetId, promise); return promise;
    },
    requestSwitch() { return { confirmationRequired: state.dirty || state.busy }; },
    dispose() { if (disposed) return; epoch++; client.abort(); cleanup(); emit({ dirty: false, selectedFiles: [], busy: false }); disposed = true; },
  };
  emit({}); return api;
}
