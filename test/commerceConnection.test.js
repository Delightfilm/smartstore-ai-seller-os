import test from 'node:test';
import assert from 'node:assert/strict';
import { commerceConnectionView } from '../src/dashboard/commerceConnectionState.js';
test('external view cannot claim unsent PC failure or live connectivity',()=>{
 const snapshot={status:'VERIFIED',channel:{name:'Store'},succeededAt:'2026-10-15T00:00:00Z'};
 const now=Date.parse(snapshot.succeededAt)+900001;
 const external=commerceConnectionView({snapshot,localState:{status:'SYNC_PENDING'},localAvailable:false,now});
 assert.equal(external.status,'STALE');assert.match(external.notice,/PC 상태 확인 불가/);
 const local=commerceConnectionView({snapshot,localState:{status:'SYNC_PENDING'},localAvailable:true,now});assert.equal(local.status,'SYNC_PENDING');
 assert.equal(commerceConnectionView({snapshot:{...snapshot,status:'FAILED',errorCode:'AUTH_FAILED'},localAvailable:false,now}).status,'FAILED');
});
