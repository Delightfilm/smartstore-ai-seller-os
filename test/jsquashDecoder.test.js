import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createJsquashDecoder } from '../server/media/jsquashDecoder.js';
import { validateUploadedImage } from '../server/media/imageValidation.js';
import { wasmBytes } from '../supabase/functions/seller-os-media/codecBytes.js';
import { png } from './imageValidation.test.js';

// Encoders are used only to create our own tiny TEST_ONLY fixtures, never products.
async function selfMadeFixtures() {
  const raster = { width: 2, height: 3, data: new Uint8ClampedArray(24).fill(127) };
  const jpeg = await import('@jsquash/jpeg/encode.js');
  await jpeg.init(await WebAssembly.compile(await readFile(new URL('../node_modules/@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm', import.meta.url))));
  const webp = await import('@jsquash/webp/codec/enc/webp_enc_simd.js');
  const bytes = await readFile(new URL('../node_modules/@jsquash/webp/codec/enc/webp_enc_simd.wasm', import.meta.url));
  const { initEmscriptenModule } = await import('@jsquash/webp/utils.js');
  const module = await initEmscriptenModule(webp.default, await WebAssembly.compile(bytes));
  const { defaultOptions } = await import('@jsquash/webp/meta.js');
  return [
    [png(), 'image/png'],
    [new Uint8Array(await jpeg.default(raster)), 'image/jpeg'],
    [new Uint8Array(module.encode(raster.data, 2, 3, defaultOptions)), 'image/webp'],
  ];
}
test('actual WASM decodes self-made PNG/JPEG/WebP, input hashes unchanged, concurrent calls serialize', async () => {
  const decoder = createJsquashDecoder({ wasmBytes });
  const fixtures = await selfMadeFixtures();
  const results = await Promise.all(fixtures.map(([b, mime]) => validateUploadedImage(b, mime, decoder)));
  for (let i = 0; i < results.length; i++) {
    assert.equal(results[i].width, 2); assert.equal(results[i].height, 3);
    assert.equal(results[i].sha256, createHash('sha256').update(fixtures[i][0]).digest('hex'));
  }
  // Keep a valid header/chunk structure but break compressed raster/CRC.
  const broken = Buffer.from(png()); broken[45] ^= 255;
  await assert.rejects(validateUploadedImage(broken, 'image/png', decoder), { code: 'MEDIA_IMAGE_INVALID' });
});

test('JPEG EXIF rotation is validated in encoded coordinates without rejecting or altering original bytes', async () => {
  const [, [jpeg]] = await selfMadeFixtures();
  // APP1 Exif, little-endian TIFF orientation=6 (90 degrees), original SOF 2x3.
  const exif = Buffer.from('ffe1002245786966000049492a0008000000010012010300010000000600000000000000', 'hex');
  const bytes = Buffer.concat([jpeg.subarray(0, 2), exif, jpeg.subarray(2)]);
  const decoder = createJsquashDecoder({ wasmBytes });
  const meta = await validateUploadedImage(bytes, 'image/jpeg', decoder);
  assert.equal(meta.width, 2); assert.equal(meta.height, 3);
  assert.equal(meta.sha256, createHash('sha256').update(bytes).digest('hex'));
});

test('JPEG decoder corruption recovery warnings must reject incomplete entropy data', async () => {
  const encoder = await import('@jsquash/jpeg/encode.js');
  await encoder.init(await WebAssembly.compile(await readFile(new URL('../node_modules/@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm', import.meta.url))));
  const source = new Uint8Array(await encoder.default({ width: 64, height: 64, data: new Uint8ClampedArray(64 * 64 * 4).fill(100) }));
  const sos = source.findIndex((b, i) => b === 255 && source[i + 1] === 218);
  const broken = Buffer.concat([source.subarray(0, sos + 20), Buffer.from([255, 217])]);
  await assert.rejects(validateUploadedImage(broken, 'image/jpeg', createJsquashDecoder({ wasmBytes })), { code: 'MEDIA_IMAGE_INVALID' });
});
