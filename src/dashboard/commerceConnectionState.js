import { projectCommerceStatus } from '../../server/commerce/snapshot.js';
export function commerceConnectionView({snapshot,localState,localAvailable,now=Date.now()}){
 const localStatus=localAvailable?localState?.status:null;
 const status=localStatus&&['NOT_CONFIGURED','VERIFYING','CONFIRM_REQUIRED','FAILED','SYNC_PENDING'].includes(localStatus)?localStatus:projectCommerceStatus(snapshot,now);
 return {status,notice:localAvailable?'이 PC에서 명시적으로 재확인할 때만 갱신됩니다.':'PC 상태 확인 불가 · 저장 결과만 조회하며 네이버 실시간 상태가 아닙니다.'};
}
