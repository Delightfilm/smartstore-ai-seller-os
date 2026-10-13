import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSnapshot, validateSnapshot, planImport } from '../server/cloud/dataTransfer.js';
const workspace='ccb5017e-7c70-414d-b103-38e17e48e799';
const record={id:'123',revision:7,product:{offerId:'123',source:'CURATED_RESEARCH'},terms:{costsConfirmed:false},market:null,research:{salePriceKrw:14900},review:{status:'HOLD',reasons:['부가비용 미확정'],note:''},listing:{},publication:{status:'NOT_PUBLISHED'}};
test('backup detects tampering and mismatched workspace without changing original records',()=>{
 const snapshot=makeSnapshot({workspaceId:workspace,records:[record],events:[]});
 assert.equal(validateSnapshot(snapshot,workspace).records[0].review.status,'HOLD');
 const changed=structuredClone(snapshot);changed.records[0].research.salePriceKrw=0;
 assert.throws(()=>validateSnapshot(changed,workspace));
 assert.throws(()=>validateSnapshot(snapshot,'00000000-0000-4000-8000-000000000001'));
 assert.equal(record.revision,7);
});
test('import plans canonical offer identity, repeated data skips and user edits conflict',()=>{
 const snapshot=makeSnapshot({workspaceId:workspace,records:[record],events:[]});
 assert.deepEqual(planImport(snapshot,[]),{create:['123'],skip:[],conflict:[]});
 assert.deepEqual(planImport(snapshot,[{...record,revision:1,product:{...record.product,source:'LOCAL_BROWSER_COLLECTOR'}}]),{create:[],skip:['123'],conflict:[]});
 assert.deepEqual(planImport(snapshot,[{...record,review:{...record.review,note:'사용자가 수정'}}]),{create:[],skip:[],conflict:['123']});
});
test('database JSON key order does not turn repeated import into a conflict',()=>{
 const snapshot=makeSnapshot({workspaceId:workspace,records:[record],events:[]});
 const database={...record,product:{source:'CURATED_RESEARCH',offerId:'123'},review:{note:'',reasons:['부가비용 미확정'],status:'HOLD'}};
 assert.deepEqual(planImport(snapshot,[database]),{create:[],skip:['123'],conflict:[]});
});
