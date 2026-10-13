import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecordUpdater } from '../src/data/recordUpdates.js';
test('a delayed initial load cannot overwrite newer saved dashboard records',async()=>{
 let rows=[],release;
 const updater=createRecordUpdater(next=>{rows=typeof next==='function'?next(rows):next;});
 const loading=updater.load(()=>new Promise(r=>{release=r;}));
 updater.publish([{id:'123',review:{status:'REVIEW_REQUIRED'}}]);
 release([{id:'123',review:{status:'HOLD'}}]);
 assert.equal(await loading,false);
 assert.equal(rows[0].review.status,'REVIEW_REQUIRED');
});
