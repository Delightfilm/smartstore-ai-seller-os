import test from 'node:test';
import assert from 'node:assert/strict';
const enabled = process.env.SELLER_OS_LIVE_MEDIA_TEST === '1';
const base = 'https://dzgczkwwezzsfqnjdqen.supabase.co';
for (const [name, headers] of [['anonymous', {}], ['forged JWT', { authorization: 'Bearer forged-not-a-real-token' }]]) test(`explicit live media ${name} is denied (read only)`, { skip: !enabled && 'Live gate not enabled' }, async () => {
 const response = await fetch(base + '/functions/v1/seller-os-media', { method: 'POST', headers: { origin: 'https://seller-os-delightfilm.pages.dev', 'content-type': 'application/json', ...headers }, body: JSON.stringify({ action: 'list', workspaceId: 'ccb5017e-7c70-414d-b103-38e17e48e799', offerId: '675246155709' }), redirect: 'error' });
 assert.ok([401, 403].includes(response.status));
});
test('explicit live private bucket public listing/read are denied', { skip: !enabled && 'Live gate not enabled' }, async () => {
 for (const path of ['/storage/v1/object/public/seller-os-detail-media/permission-probe.png', '/storage/v1/object/list/seller-os-detail-media']) {
  const response = await fetch(base + path, { method: path.includes('/list/') ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, ...(path.includes('/list/') ? { body: '{}' } : {}), redirect: 'error' });
  assert.ok([400, 401, 403, 404].includes(response.status));
 }
});
test('live owner read/CAS tests require separately provided credential; never extract browser JWT', { skip: true }, () => {});
