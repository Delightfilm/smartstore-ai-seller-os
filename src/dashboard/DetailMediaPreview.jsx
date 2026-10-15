import React from 'react';
export default function DetailMediaPreview({ draft, urls, onRead }) {
 return <section className="detail-media-preview" aria-label="로그인 내부 상세페이지 미리보기">
  <h3>{draft.title || '제목을 입력해 주세요'}</h3><p className="detail-preserve-lines">{draft.intro}</p>
  {!draft.panels.length && <p>저장된 이미지가 없습니다. ChatGPT에서 만든 결과물을 업로드한 뒤 순서를 확인하세요.</p>}
  {draft.panels.map((p, i) => <figure key={p.assetId}>
   {urls[p.assetId] ? <img src={urls[p.assetId]} alt={p.alt || `상세페이지 패널 ${i + 1}`} /> : <button type="button" className="btn btn-ghost" onClick={() => onRead(p.assetId)}>패널 {i + 1} 이미지 불러오기</button>}
   <figcaption className="detail-preserve-lines">{p.copy}</figcaption>
  </figure>)}
  <p className="t2">로그인된 내부 검토용입니다. 공개 등록 URL이나 판매 승인 자료가 아닙니다.</p>
 </section>;
}
