import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorkflowStore } from '../server/workflowStore.js';

test('candidate changes reject stale revisions and survive server restart', async () => {
  const dir = await mkdtemp(join(tmpdir(),'seller-os-test-'));
  try {
    const store = new WorkflowStore(dir);
    const created = store.create({offerId:'123456',title:'상품'});
    store.update(created.id,created.revision,{terms:{salePriceKrw:10000}});
    assert.throws(()=>store.update(created.id,created.revision,{terms:{salePriceKrw:1}}),/변경/);
    assert.equal(new WorkflowStore(dir).get(created.id).terms.salePriceKrw,10000);
    assert.throws(()=>store.get('../outside'),/후보/);
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('registration reservation blocks duplicates and remains locked after restart', async () => {
  const dir = await mkdtemp(join(tmpdir(),'seller-os-test-'));
  try {
    const store = new WorkflowStore(dir);
    const c = store.create({offerId:'123456'});
    store.reserve(c.id,c.revision);
    assert.throws(()=>store.reserve(c.id,c.revision),/등록|변경/);
    assert.throws(()=>store.update(c.id,store.get(c.id).revision,{listing:{}}),/등록/);
    assert.equal(new WorkflowStore(dir).get(c.id).publication.status,'REGISTERING');
  } finally { await rm(dir,{recursive:true,force:true}); }
});
