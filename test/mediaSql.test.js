import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mediaDatabase } from './helpers/mediaDatabase.js';
import { createMediaStore } from '../server/media/store.js';
import { createMediaHandler } from '../server/media/handler.js';
import { validateUploadedImage } from '../server/media/imageValidation.js';
import { createJsquashDecoder } from '../server/media/jsquashDecoder.js';
import { wasmBytes } from '../supabase/functions/seller-os-media/codecBytes.js';
const installed = existsSync(new URL('../.seller-os/sql-test/node_modules/@electric-sql/pglite/dist/index.js', import.meta.url));
const workspaceId = 'ccb5017e-7c70-414d-b103-38e17e48e799', actorId = '88888888-8888-4888-8888-888888888888', offerId = '675246155709', origin = 'http://127.0.0.1:5173';
test('optional actual local SQL migration, CAS/quota/owner RLS rollback suite', { skip: !installed && 'Install pinned ignored PGlite tool for local SQL evidence' }, async () => {
 const db = await mediaDatabase(); try { await db.exec(readFileSync(new URL('./sql/seller-os-media.sql', import.meta.url), 'utf8')); const { rows } = await db.query('select count(*)::int AS n from public.seller_os_detail_assets'); assert.equal(rows[0].n, 0); } finally { await db.close(); }
});
test('real handler+WASM+local SQL store upload/read/save/replay and source changes, no hosted or actual login claim', { skip: !installed && 'Install pinned ignored PGlite tool' }, async () => {
 const db = await mediaDatabase();
 try {
  await db.exec(`INSERT INTO public.seller_os_candidates(workspace_id,offer_id,revision,data) VALUES('${workspaceId}','${offerId}',4,'{"id":"${offerId}","revision":4,"publication":{"status":"NOT_PUBLISHED"}}'); INSERT INTO seller_os_private.media_budget(workspace_id,checked_at,enabled_until,checked_by) VALUES('${workspaceId}',clock_timestamp(),clock_timestamp()+interval '1 hour','LOCAL_TEST_ONLY');`);
  const writer = { rpc: async (name, args) => {
   assert.match(name, /^seller_os_media_[a-z_]+$/);
   const params = Object.values(args).map(v => v && typeof v === 'object' ? JSON.stringify(v) : v);
   try { const { rows } = await db.query(`select public.${name}(${params.map((_, i) => '$' + (i + 1)).join(',')}) as value`, params); return { data: rows[0].value }; } catch (e) { return { error: { code: e.code, message: e.message } }; }
  } };
  const store = createMediaStore({ writer, workspaceId, actorId }); const objects = new Map(); let writes = 0;
  const decoder = createJsquashDecoder({ wasmBytes });
  const handler = createMediaHandler({ allowedOrigins: [origin], authenticate: async () => ({ userId: actorId, workspaceId }), storeFor: () => store, validateImage: (b, m) => validateUploadedImage(b, m, decoder), storage: { upload: async (key, bytes, options) => { assert.equal(options.upsert, false); if (objects.has(key)) throw new Error('immutable collision'); objects.set(key, bytes); writes++; }, read: async key => { if (!objects.has(key)) throw Object.assign(new Error('missing'), { code: 'MEDIA_OBJECT_MISSING' }); return objects.get(key); } } });
  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==', 'base64');
  const requestId = crypto.randomUUID();
  const upload = () => { const f = new FormData(); f.set('meta', JSON.stringify({ action: 'upload', workspaceId, offerId, requestId, expectedCandidateRevision: 4, expectedDetailRevision: 0 })); f.set('file', new Blob([bytes], { type: 'image/png' }), 'TEST_ONLY.png'); return new Request('https://unit.test/media', { method: 'POST', headers: { origin }, body: f }); };
  let response = await handler(upload()); assert.equal(response.status, 200, await response.clone().text()); const first = await response.json(); assert.equal(first.draft.revision, 1); assert.equal(first.assets.length, 1);
  response = await handler(upload()); assert.equal(response.status, 200); assert.equal(writes, 1);
  const json = input => new Request('https://unit.test/media', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ workspaceId, offerId, ...input }) });
  response = await handler(json({ action: 'read', assetId: first.assets[0].id })); assert.equal(response.status, 200); assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes); assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const { revision, sourceCandidateRevision, ...draft } = first.draft; draft.intro = 'TEST_ONLY 카피';
  response = await handler(json({ action: 'save', requestId: crypto.randomUUID(), expectedCandidateRevision: 4, expectedDetailRevision: 1, draft })); assert.equal(response.status, 200, await response.clone().text()); assert.equal((await response.json()).draft.intro, 'TEST_ONLY 카피');
  // Source revision changes, but existing media/objects are retained.
  await db.exec(`UPDATE public.seller_os_candidates SET revision=5,data=jsonb_set(data,'{revision}','5') WHERE offer_id='${offerId}';`);
  const latest = await store.list(offerId); assert.equal(latest.stale, true); assert.equal(latest.draft.review.status, 'REVIEW_REQUIRED'); assert.equal(objects.size, 1);
 } finally { await db.close(); }
});
