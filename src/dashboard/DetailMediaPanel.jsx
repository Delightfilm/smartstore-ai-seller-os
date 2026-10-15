import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, X, Upload, Save } from 'lucide-react';
import { useWorkflow } from '../auth/AuthProvider.jsx';
import { createDetailMediaController } from './detailMediaController.js';
import DetailMediaPreview from './DetailMediaPreview.jsx';
const checkLabels = { optionMatch: '상품·옵션·포함 구성 일치', copyFacts: '카피의 사실 확인', imageRights: '상업적 이미지 사용권 확인', unknownsLabelled: '고시·배송 미확인 정보 표시' };
export default function DetailMediaPanel({ candidate, onClose }) {
 const { client, user } = useWorkflow();
 const dialog = useRef(null), controller = useRef(null), lastRevision = useRef(candidate.revision);
 const [state, setState] = useState(null), [confirmClose, setConfirmClose] = useState(false), [showPreview, setShowPreview] = useState(false), [fileError, setFileError] = useState('');
 useEffect(() => {
  dialog.current.showModal();
  const c = createDetailMediaController({ client: client.media, onState: setState }); controller.current = c;
  lastRevision.current = candidate.revision;
  void c.load({ workspaceId: import.meta.env.VITE_SELLER_OS_WORKSPACE_ID, offerId: candidate.id }, candidate.revision);
  return () => { c.dispose(); controller.current = null; };
 }, [client, user?.id, candidate.id]);
 useEffect(() => { if (lastRevision.current !== candidate.revision) { lastRevision.current = candidate.revision; void controller.current?.load({ workspaceId: import.meta.env.VITE_SELLER_OS_WORKSPACE_ID, offerId: candidate.id }, candidate.revision); } }, [candidate.revision, candidate.id]);
 useEffect(() => { if (!state?.dirty) return; const guard = e => { e.preventDefault(); e.returnValue = ''; }; window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard); }, [state?.dirty]);
 const close = () => { if (controller.current?.requestSwitch().confirmationRequired) setConfirmClose(true); else onClose(); };
 const draft = state?.draft, locked = state?.busy || state?.conflict || state?.uncertain;
 const edit = patch => controller.current.edit(patch);
 const panelEdit = (index, patch) => edit({ panels: draft.panels.map((p, i) => i === index ? { ...p, ...patch } : p) });
 const move = (index, offset) => { const panels = [...draft.panels]; [panels[index], panels[index + offset]] = [panels[index + offset], panels[index]]; edit({ panels }); };
 const choose = async e => {
  const capturedController = controller.current;
  const files = Array.from(e.target.files); e.target.value = ''; setFileError('');
  try {
   for (const file of files) { if (file.size > 4194304 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('4MiB 이하 PNG/JPEG/WebP만 선택하세요.'); const image = await createImageBitmap(file); const pixels = image.width * image.height; image.close(); if (pixels > 8000000) throw new Error('8MP 이하 패널로 분할해 주세요.'); }
   if (controller.current === capturedController) capturedController?.selectFiles(files);
  } catch (error) { if (controller.current === capturedController) setFileError(error.message || '이미지 파일을 확인해 주세요.'); }
 };
 return <dialog ref={dialog} className="detail-media-dialog" aria-labelledby="detail-media-title" onCancel={e => { e.preventDefault(); close(); }}>
  <header className="detail-media-heading"><div><h2 id="detail-media-title">완성 이미지·상세페이지</h2><p>{candidate.title} · 상품 {candidate.id}</p></div><button className="btn btn-ghost" type="button" aria-label="편집 닫기" onClick={close}><X size={20}/></button></header>
  <p className="detail-media-disclosure">선택만으로 전송되지 않습니다. 업로드를 누르면 Seller OS 비공개 클라우드에 저장합니다. GPT·네이버·퀵스타 자동 전송 및 상품 등록·배송 신청은 하지 않습니다.</p>
  {confirmClose && <section className="detail-media-close-confirm" aria-label="미저장 변경 확인"><h3>{state?.busy ? '요청 처리 중입니다' : '미저장 변경이 있습니다'}</h3><p>이미 서버에 저장된 결과는 닫아도 취소되지 않습니다. 로컬 선택·편집만 버려집니다.</p><div className="detail-media-actions"><button type="button" className="btn btn-primary" disabled={state?.busy || !state?.contentDirty || state?.selectedFiles.length > 0 || state?.conflict} onClick={async () => { if (await controller.current.save()) onClose(); }}>초안 저장 후 닫기</button><button type="button" className="btn btn-ghost" disabled={state?.busy} onClick={onClose}>로컬 변경 버리고 닫기</button><button type="button" className="btn btn-ghost" onClick={() => setConfirmClose(false)}>계속 편집</button></div></section>}
  <p role="status" className="detail-media-message">{state?.message || (state?.busy ? '서버 상태 확인 중…' : draft ? `초안 r${draft.revision} · ${state.dirty ? '미저장 변경 있음' : '서버 조회 기준'} · ${draft.review.status === 'REVIEWED_INTERNAL' && !state.stale ? '내부 검수 완료 · 판매 승인 아님' : '내부 검수 필요'}` : '비공개 저장소 연결 확인 중')}</p>
  {!draft && !state?.busy && <button type="button" className="btn btn-ghost" onClick={() => controller.current.load(state.scope, candidate.revision)}>연결 다시 확인</button>}
  {draft && <>
   {(state.conflict || state.stale) && <div className="detail-media-close-confirm"><p>저장 당시 후보 근거와 현재 근거가 다릅니다. 기존 카피를 유지하고 검수 항목을 초기화해 재검토할 수 있습니다.</p><button type="button" className="btn btn-ghost" disabled={state.busy} onClick={() => controller.current.rebase()}>최신 후보 근거로 재검토 시작</button></div>}
   <div className="detail-media-budget"><p>보관 파일 {state.assets.length}/20 · {((state.budget?.storageUsed || 0) / 1048576).toFixed(2)}MiB / 64MiB</p><p>{state.budget?.enabled && new Date(state.budget.enabledUntil) > new Date() ? `무료 확인 유효: ${new Date(state.budget.enabledUntil).toLocaleString('ko-KR')}` : '무료 사용량 재확인 전 업로드·이미지 조회 비활성'}</p></div>
   <div className="detail-media-body"><div className="detail-media-editor">
    <fieldset disabled={locked}><legend>초안 내용</legend><label>한국어 제목<input className="inp" maxLength={200} value={draft.title} onChange={e => edit({ title: e.target.value })}/></label><label>소개<textarea className="inp" maxLength={4000} rows={3} value={draft.intro} onChange={e => edit({ intro: e.target.value })}/></label></fieldset>
    <section className="detail-media-upload"><h3>ChatGPT 완성 이미지</h3><p>파일당 4MiB·8MP 이하, 최대 20개 보관. 초안에서 제외해도 파일과 사용량은 보존됩니다.</p><label className="detail-file-label">결과 이미지 선택<input type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={locked} onChange={choose}/></label>{fileError && <p role="alert">{fileError}</p>}
     {state.selectedFiles.length > 0 && <ul>{state.selectedFiles.map((entry, i) => <li key={i}>{entry.file.name} · {entry.message}</li>)}</ul>}
     <button type="button" className="btn btn-ghost" disabled={state.busy || state.conflict || state.contentDirty || !state.selectedFiles.length || !state.budget?.enabled || new Date(state.budget.enabledUntil) <= new Date()} onClick={() => controller.current.uploadSelected()}><Upload size={16}/>{state.uncertain ? '같은 업로드 요청 확인' : '선택 파일 비공개 업로드'}</button>{state.contentDirty && <p>카피·순서 변경을 먼저 저장한 뒤 업로드하세요.</p>}
    </section>
    <h3>이미지 순서·카피</h3>{!draft.panels.length && <p>아직 초안에 이미지가 없습니다. 실제 GPT 결과물을 선택해 업로드하세요.</p>}
    {draft.panels.map((p, index) => <fieldset key={p.assetId} disabled={locked} className="detail-media-panel-row"><legend>패널 {index + 1}</legend><div className="detail-media-actions"><button type="button" className="btn btn-ghost" disabled={index === 0 || locked} aria-label={`패널 ${index + 1} 위로`} onClick={() => move(index, -1)}><ArrowUp size={16}/></button><button type="button" className="btn btn-ghost" disabled={index === draft.panels.length - 1 || locked} aria-label={`패널 ${index + 1} 아래로`} onClick={() => move(index, 1)}><ArrowDown size={16}/></button><button type="button" className="btn btn-ghost" onClick={() => edit({ panels: draft.panels.filter((_, i) => i !== index) })}>초안에서 제외</button></div><label>패널 카피<textarea className="inp" maxLength={2000} rows={3} value={p.copy} onChange={e => panelEdit(index, { copy: e.target.value })}/></label><label>이미지 대체 텍스트<input className="inp" maxLength={300} value={p.alt} onChange={e => panelEdit(index, { alt: e.target.value })}/></label></fieldset>)}
    {state.assets.some(a => a.status === 'READY' && !draft.panels.some(p => p.assetId === a.id)) && <details><summary>보관 중인 제외 이미지</summary>{state.assets.filter(a => a.status === 'READY' && !draft.panels.some(p => p.assetId === a.id)).map(a => <button key={a.id} type="button" className="btn btn-ghost" disabled={locked} onClick={() => edit({ panels: [...draft.panels, { assetId: a.id, copy: '', alt: '' }] })}>{a.displayName} 초안에 추가</button>)}</details>}
    <fieldset disabled={locked}><legend>내부 검수 · 판매 승인과 별개</legend>{Object.entries(checkLabels).map(([key, label]) => <label key={key} className="detail-media-check"><input type="checkbox" checked={draft.review.checks[key]} onChange={e => edit({ review: { ...draft.review, checks: { ...draft.review.checks, [key]: e.target.checked }, status: 'REVIEW_REQUIRED' } })}/>{label}</label>)}<label>검수 메모<textarea className="inp" maxLength={2000} rows={2} value={draft.review.note} onChange={e => edit({ review: { ...draft.review, note: e.target.value } })}/></label><label>검수 상태<select className="inp" value={draft.review.status} onChange={e => edit({ review: { ...draft.review, status: e.target.value } })}><option value="DRAFT">작성 중</option><option value="REVIEW_REQUIRED">검수 필요</option><option value="REVIEWED_INTERNAL" disabled={!draft.panels.length || Object.values(draft.review.checks).some(v => !v)}>내부 검수 완료 · 판매 승인 아님</option></select></label></fieldset>
   </div>{showPreview && <DetailMediaPreview draft={draft} urls={state.previewUrls} onRead={id => controller.current.preview(id)}/>}</div>
   <footer className="detail-media-footer"><button type="button" className="btn btn-primary" disabled={state.busy || state.conflict || !state.contentDirty} onClick={() => controller.current.save()}><Save size={16}/>{state.uncertain ? '같은 초안 저장 요청 확인' : '초안 저장'}</button><button type="button" className="btn btn-ghost" onClick={() => setShowPreview(v => !v)}>{showPreview ? '미리보기 접기' : '내부 미리보기'}</button><button type="button" className="btn btn-ghost" onClick={close}>닫기</button></footer>
  </>}
 </dialog>;
}
