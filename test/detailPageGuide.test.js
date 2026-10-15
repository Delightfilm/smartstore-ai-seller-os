import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import * as kit from '../src/export/gptImageKit.js';

const candidate = () => ({ id: '675246155709', revision: 4, product: { title: '투명 정리함', images: ['https://cbu01.alicdn.com/one.webp'], variants: [{ id: 'long', name: '긴 형태', priceCny: 3.5 }, { id: 'square', name: '사각형' }] }, listing: { description: '검증하지 않은 방수 주장' }, terms: { imageRightsConfirmed: false }, review: { status: 'HOLD' } });
const image = new Uint8Array([82,73,70,70,4,0,0,0,87,69,66,80,86,80,56,32]);
const build = c => kit.buildImageKit(c, { fetchImpl: async () => new Response(image, { headers: { 'content-type': 'image/webp' } }), prepare: async () => [{ bytes: new Uint8Array([1,2,3]), width: 800, height: 600, sourceRect: { x: 0, y: 0, width: 800, height: 600 } }] });
const parse = (files, path) => { assert.ok(files[path], `missing consumer artifact: ${path}`); return JSON.parse(strFromU8(files[path])); };

test('export includes a versioned full-production brief and explicit user handoff outside reference data', async () => {
 const c = candidate(), before = structuredClone(c), result = await build(c), files = unzipSync(result.bytes);
 assert.ok(files['00_ChatGPT_제작요청.txt'], 'explicit paste request missing');
 assert.ok(files['제작가이드.md']); assert.ok(files['검수표.md']);
 const brief = parse(files, '패널구성안.json');
 assert.equal(brief.guideVersion, 2); assert.equal(brief.product.id, '675246155709');
 assert.equal(brief.product.revision, 4); assert.equal(brief.modules.length, 13);
 assert.deepEqual(brief.production.targetPanels, { min: 8, max: 12 });
 assert.equal(brief.production.maxPanelPixels, 8000000);
 assert.equal(brief.production.widthIsTargetNotMeasured, true);
 assert.deepEqual(c, before);
 assert.equal(result.request, strFromU8(files['00_ChatGPT_제작요청.txt']));
 assert.match(result.filename, /-guide-v2\.zip$/);
});

test('photo mapping never guesses which SKU a downloaded source depicts', async () => {
 const files = unzipSync((await build(candidate())).bytes), mapping = parse(files, '사진옵션매칭표.json');
 assert.deepEqual(mapping.options.map(v => v.id), ['long', 'square']);
 assert.equal(mapping.images[0].sourceIndex, 1);
 assert.deepEqual(mapping.images[0].uploadPaths, ['upload/01-01.jpg']);
 assert.equal(mapping.images[0].confirmedSkuId, null);
 assert.equal(mapping.images[0].visualReview, 'PENDING');
 assert.equal(mapping.options[0].sellerConfirmed, false);
 assert.equal(JSON.stringify(mapping).includes('3.5'), false);
});

test('missing photos keep all module obligations visible and explicitly blocked', async () => {
 const c = candidate(); c.product.images = [];
 const files = unzipSync((await kit.buildImageKit(c)).bytes), brief = parse(files, '패널구성안.json');
 assert.equal(brief.modules.length, 13);
 assert.ok(brief.modules.every(m => m.status === 'BLOCKED_MISSING_IMAGES'));
 assert.ok(brief.blockers.some(b => b.code === 'SOURCE_IMAGES_MISSING'));
 assert.ok(brief.blockers.some(b => b.code === 'IMAGE_RIGHTS_UNCONFIRMED'));
 assert.ok(brief.modules.find(m => m.id === 'size').requiredEvidence.includes('PRODUCT_DIMENSIONS_BY_SKU'));
});

test('operator notes and supplier option labels are never promoted to verified customer claims', async () => {
 const files = unzipSync((await build(candidate())).bytes), brief = parse(files, '패널구성안.json');
 assert.deepEqual(brief.verifiedClaims, []);
 assert.equal(brief.referenceData.operatorDraft.description, '검증하지 않은 방수 주장');
 assert.equal(brief.referenceDataStatus, 'UNVERIFIED');
 assert.equal(brief.publication, 'NOT_PUBLISHED');
 assert.ok(brief.modules.every(m => m.customerCopy === null && Array.isArray(m.claimEvidence)));
});

test('copy-only export rechecks saved identity/revision without fetching supplier images', async () => {
 assert.equal(typeof kit.exportSavedKitRequest, 'function');
 const calls = [], c = candidate();
 const client = { request: async payload => { calls.push(payload); return { candidate: c }; } };
 const result = await kit.exportSavedKitRequest(client, c);
 assert.equal(typeof result, 'string'); assert.ok(result.length > 100);
 assert.deepEqual(calls, [{ action: 'export', id: '675246155709' }]);
 await assert.rejects(kit.exportSavedKitRequest({ request: async () => ({ candidate: { ...c, revision: 5 } }) }, c), /변경/);
});
