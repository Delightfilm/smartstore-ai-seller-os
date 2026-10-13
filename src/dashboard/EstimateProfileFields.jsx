import React from 'react';
export default function EstimateProfileFields({profile,onChange,disabled,error}) {
 const labels={salePriceKrw:'추정 판매가 (원)',fxKrwPerCny:'가정 환율 (원/CNY)',chinaShippingCny:'가정 중국 배송비 (CNY)',shippingLowKrw:'배송비 하한 (원)',shippingBaseKrw:'배송비 기준 (원)',shippingHighKrw:'배송비 상한 (원)',otherCostKrw:'기타·포장비 가정 (원)',feePercent:'플랫폼 수수료 가정 (%)',returnPercent:'반품 충당 가정 (%)',minProfitKrw:'후보 최소 기여이익 (원)',minMarginPercent:'후보 최소 이익률 (%)'};
 return <details className="surf" style={{padding:16}} open>
  <summary>추정 후보 선별 가정 · 확정 견적 아님</summary>
  <p className="t3">판매가와 근거를 입력한 뒤 발굴하세요. 배송비 기본값은 예시 예산이며 퀵스타 요금표가 아닙니다. 값이 유효한 조사에서 MOQ1·공급가·재고가 확인되고 기준 마진이 목표를 충족하는 옵션이 있으면 보류 후보로 저장합니다.</p>
  {error&&<p role="alert">{error}</p>}
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10}}>{Object.entries(labels).map(([key,label])=><label key={key}>{label}<input className="inp" aria-label={label} type="number" min="0" step="any" disabled={disabled} value={profile[key]} onChange={e=>onChange({...profile,[key]:e.target.value})}/></label>)}</div>
  <label style={{display:'block',marginTop:10}}>추정 근거 · 판매가·배송비 가정의 출처/제외 비용<textarea className="inp" aria-label="추정 근거" rows={2} maxLength={1000} disabled={disabled} value={profile.basis} onChange={e=>onChange({...profile,basis:e.target.value})}/></label>
 </details>;
}
