import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
const mod = await import('../server/media/imageValidation.js').catch(() => ({}));

// Self-made TEST_ONLY 2x3 RGBA PNG, never a product or GPT result.
function crc(bytes) { let c = -1; for (const b of bytes) { c ^= b; for (let n = 0; n < 8; n++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (c ^ -1) >>> 0; }
function chunk(name, data) { const b = Buffer.alloc(data.length + 12); b.writeUInt32BE(data.length); b.write(name, 4); b.set(data, 8); b.writeUInt32BE(crc(b.subarray(4, -4)), b.length - 4); return b; }
export function png(width = 2, height = 3, animated = false) {
  const h = Buffer.alloc(13); h.writeUInt32BE(width); h.writeUInt32BE(height, 4); h[8] = 8; h[9] = 6;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', h), ...(animated ? [chunk('acTL', Buffer.alloc(8))] : []), chunk('IDAT', deflateSync(Buffer.alloc(27, 0))), chunk('IEND', Buffer.alloc(0))]);
}
test('reject oversized bytes, MIME spoof, truncation and animation before decode', () => {
  assert.equal(typeof mod.inspectImage, 'function');
  assert.throws(() => mod.inspectImage(new Uint8Array(4194305), 'image/png'), { code: 'MEDIA_IMAGE_TOO_LARGE' });
  for (const [bytes, mime] of [[Buffer.from('<html>login</html>'), 'image/png'], [png(), 'image/jpeg'], [png().subarray(0, 25), 'image/png'], [png(2, 3, true), 'image/png']]) {
    assert.throws(() => mod.inspectImage(bytes, mime), { code: 'MEDIA_IMAGE_INVALID' });
  }
});
test('reject dimension and operational decode limits before invoking raster decoder', async () => {
  assert.equal(typeof mod.validateUploadedImage, 'function');
  let calls = 0;
  for (const [w, h] of [[16385, 1], [8001, 4000], [8000001, 1], [3000, 3000]]) {
    await assert.rejects(mod.validateUploadedImage(png(w, h), 'image/png', { decode: () => { calls++; } }), e => ['MEDIA_IMAGE_INVALID', 'MEDIA_DECODE_LIMIT'].includes(e.code));
  }
  assert.equal(calls, 0);
});
test('validated raster dimensions must match header and SHA covers unchanged input', async () => {
  assert.equal(typeof mod.validateUploadedImage, 'function');
  const bytes = png();
  const before = Buffer.from(bytes);
  const result = await mod.validateUploadedImage(bytes, 'image/png', { decode: async () => ({ width: 2, height: 3, data: new Uint8ClampedArray(24) }) });
  assert.equal(result.width, 2); assert.equal(result.height, 3);
  assert.equal(result.sha256, Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex'));
  assert.deepEqual(bytes, before);
  await assert.rejects(mod.validateUploadedImage(bytes, 'image/png', { decode: async () => ({ width: 3, height: 2, data: new Uint8Array(24) }) }), { code: 'MEDIA_IMAGE_INVALID' });
});
