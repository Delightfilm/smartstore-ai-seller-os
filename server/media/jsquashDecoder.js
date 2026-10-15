import jpeg, { init as initJpeg } from '@jsquash/jpeg/decode.js';
import png, { init as initPng } from '@jsquash/png/decode.js';
import webp, { init as initWebp } from '@jsquash/webp/decode.js';
import { inspectImage } from './imageValidation.js';
import { MEDIA_LIMITS } from '../../src/domain/detailMedia.js';

// Codecs require ImageData but do not require DOM/canvas. No pixel transforms.
if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData {
    constructor(data, width, height) {
      if (!Number.isInteger(width) || !Number.isInteger(height) || width * height > MEDIA_LIMITS.decodePixels || data.length !== width * height * 4) throw new Error('Invalid raster');
      this.data = data; this.width = width; this.height = height;
    }
  };
}
// jSquash modules are singletons; serialize across factory instances as well.
let chain = Promise.resolve();
let initialized;
export function createJsquashDecoder({ wasmBytes }) {
  return { decode(bytes, mime) {
    const meta = inspectImage(bytes, mime);
    if (meta.width * meta.height > MEDIA_LIMITS.decodePixels) return Promise.reject(Object.assign(new Error('이미지를 8MP 이하로 분할해 주세요.'), { code: 'MEDIA_DECODE_LIMIT' }));
    const work = chain.then(async () => {
      initialized ??= Promise.all([
        WebAssembly.compile(wasmBytes.jpeg).then(module => initJpeg(module)),
        initPng(wasmBytes.png),
        WebAssembly.compile(wasmBytes.webp).then(module => initWebp(module)),
      ]);
      await initialized;
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      // Validate encoded SOF dimensions, not EXIF-rotated presentation. Original
      // bytes/EXIF are retained; the browser remains responsible for display.
      return mime === 'image/png' ? png(buffer) : mime === 'image/jpeg' ? jpeg(buffer, { preserveOrientation: false }) : webp(buffer);
    });
    chain = work.catch(() => {}); return work;
  } };
}
