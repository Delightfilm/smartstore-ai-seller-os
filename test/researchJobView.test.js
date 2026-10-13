import test from 'node:test';
import assert from 'node:assert/strict';
import { researchJobView } from '../src/dashboard/researchJobView.js';
test('human/offline/failed work is explicit, not success or zero stock',()=>{
 const human=researchJobView({status:'WAITING_HUMAN',result:{code:'BROWSER_VERIFY_REQUIRED'}});
 assert.match(human.label,/로그인·보안/);assert.match(human.outcome,/직접 완료/);assert.equal(human.retryable,true);
 assert.match(researchJobView({status:'RUNNING'}).label,/작업자 대기/);
 assert.match(researchJobView({status:'FAILED',result:{code:'READ_FAILED'}}).outcome,/읽지 못했습니다/);
 assert.ok(!JSON.stringify(human).includes('재고 0'));
});
test('rejected new data stays job-only; existing holds and eligible candidate revisions are distinguished',()=>{
 assert.match(researchJobView({status:'SUCCEEDED',result:{status:'HOLD',reasons:['gross missing']}}).outcome,/새 후보 미저장/);
 assert.match(researchJobView({status:'SUCCEEDED',result:{status:'HOLD',existingCandidateHeld:true}}).outcome,/기존 후보 보류/);
 assert.match(researchJobView({status:'SUCCEEDED',result:{candidateId:'123',revision:2}}).outcome,/revision 2/);
});
