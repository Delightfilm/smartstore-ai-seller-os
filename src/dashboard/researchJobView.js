const labels={QUEUED:'조사 대기',RUNNING:'조사 중',WAITING_HUMAN:'로그인·보안 검증 대기',WAITING_WORKER:'로컬 작업자 대기',FAILED:'조사 실패',SUCCEEDED:'조사 완료'};
const errors={BROWSER_VERIFY_REQUIRED:'1688 보안 검증을 직접 완료해 주세요.',HUMAN_REQUIRED:'1688 로그인·보안 검증을 직접 완료해 주세요.',SIGN_IN_REQUIRED:'운영 계정 로그인이 필요합니다.',BROWSER_NOT_READY:'1688 전용 브라우저가 꺼져 있습니다.',READ_FAILED:'원문을 읽지 못했습니다. 확인 후 수동 재시도하세요.',RESULT_TOO_LARGE:'전체 옵션 조사 자료가 안전한 저장 크기를 초과했습니다. 옵션을 생략하지 않고 보류합니다.',RESULT_REJECTED:'서버가 조사 결과 저장을 거절했습니다. 확인 후 수동 재시도하세요.'};
export function researchJobView(job,{workerOnline=false}={}) {
  const offline=['QUEUED','RUNNING','WAITING_WORKER'].includes(job.status)&&!workerOnline;
  return {label:offline?'로컬 작업자 대기':labels[job.status]||'상태 미확인',
    outcome:job.result?.status==='HOLD'?(job.result.existingCandidateHeld?'조건 미충족 · 기존 후보 보류 유지':'조건 미충족 · 새 후보 미저장'):job.result?.candidateId?`후보 ${job.result.candidateId} 저장 · revision ${job.result.revision}`:job.result?.urls?`${job.result.urls.length}개 상세 조사 예약`:errors[job.result?.code]||'—',
    reasons:job.result?.reasons||[],retryable:['WAITING_HUMAN','FAILED'].includes(job.status)};
}
