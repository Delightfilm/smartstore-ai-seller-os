import { MEDIA_LIMITS } from '../../src/domain/detailMedia.js';
function fail(code = 'MEDIA_IMAGE_INVALID') { throw Object.assign(new Error(code === 'MEDIA_DECODE_LIMIT' ? '무료 런타임 검증 한도를 초과했습니다. 이미지를 8MP 이하 패널로 분할해 주세요.' : '정적 PNG/JPEG/WebP 이미지 형식과 크기를 확인해 주세요.'), { code, status: 400 }); }
const ascii = (b, from, size) => String.fromCharCode(...b.subarray(from, from + size));
const same = (b, expected, at = 0) => expected.every((v, i) => b[at + i] === v);
function pngHeader(b, view) {
  let pos = 8, width, height, idat = false, end = false;
  while (pos + 12 <= b.length) {
    const length = view.getUint32(pos), type = ascii(b, pos + 4, 4);
    if (pos + 12 + length > b.length || type === 'acTL' || type === 'fcTL' || type === 'fdAT') fail();
    if (pos === 8) { if (type !== 'IHDR' || length !== 13) fail(); width = view.getUint32(pos + 8); height = view.getUint32(pos + 12); }
    if (type === 'IDAT') idat = true;
    pos += 12 + length;
    if (type === 'IEND') { if (length || pos !== b.length) fail(); end = true; break; }
  }
  if (!idat || !end) fail(); return { width, height };
}
function jpegHeader(b, v) {
  let pos = 2, size;
  if (!same(b, [255, 217], b.length - 2)) fail();
  while (pos + 4 <= b.length) {
    if (b[pos++] !== 255) fail(); while (b[pos] === 255) pos++;
    const type = b[pos++]; if (type === 218) break;
    if (type === 216 || type === 1 || (type >= 208 && type <= 215)) continue;
    const length = v.getUint16(pos); if (length < 2 || pos + length > b.length) fail();
    if ([192, 193, 194].includes(type)) { if (length < 8 || size) fail(); size = { height: v.getUint16(pos + 3), width: v.getUint16(pos + 5) }; }
    pos += length;
  }
  if (!size) fail(); return size;
}
function webpHeader(b, v) {
  if (v.getUint32(4, true) + 8 !== b.length) fail();
  let pos = 12, size, raster = false;
  while (pos + 8 <= b.length) {
    const type = ascii(b, pos, 4), len = v.getUint32(pos + 4, true), p = pos + 8;
    if (p + len > b.length || ['ANIM', 'ANMF'].includes(type)) fail();
    if (type === 'VP8X') {
      if (len !== 10 || (b[p] & 2)) fail();
      const n = q => b[q] + b[q + 1] * 256 + b[q + 2] * 65536 + 1;
      size = { width: n(p + 4), height: n(p + 7) };
    } else if (type === 'VP8 ') {
      if (len < 10 || !same(b, [157, 1, 42], p + 3)) fail();
      size ??= { width: v.getUint16(p + 6, true) & 16383, height: v.getUint16(p + 8, true) & 16383 }; raster = true;
    } else if (type === 'VP8L') {
      if (len < 5 || b[p] !== 47) fail(); const bits = v.getUint32(p + 1, true);
      size ??= { width: (bits & 16383) + 1, height: ((bits >>> 14) & 16383) + 1 }; raster = true;
    }
    pos = p + len + (len % 2);
  }
  if (!size || !raster || pos !== b.length) fail(); return size;
}
export function inspectImage(bytes, mime) {
  if (!(bytes instanceof Uint8Array) || !bytes.length) fail();
  if (bytes.length > MEDIA_LIMITS.fileBytes) fail('MEDIA_IMAGE_TOO_LARGE');
  const b = bytes, v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let result, ext;
  try {
    if (mime === 'image/png' && same(b, [137, 80, 78, 71, 13, 10, 26, 10])) { result = pngHeader(b, v); ext = 'png'; }
    else if (mime === 'image/jpeg' && same(b, [255, 216])) { result = jpegHeader(b, v); ext = 'jpg'; }
    else if (mime === 'image/webp' && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') { result = webpHeader(b, v); ext = 'webp'; }
    else fail();
  } catch (e) { if (e.code) throw e; fail(); }
  if (!result.width || !result.height || result.width > MEDIA_LIMITS.dimension || result.height > MEDIA_LIMITS.dimension || result.width * result.height > MEDIA_LIMITS.pixels) fail();
  return { mime, ext, ...result };
}
export async function validateUploadedImage(bytes, mime, { decode }) {
  const meta = inspectImage(bytes, mime);
  if (meta.width * meta.height > MEDIA_LIMITS.decodePixels) fail('MEDIA_DECODE_LIMIT');
  let decoded;
  try { decoded = await decode(bytes, mime); } catch { fail(); }
  if (!decoded || decoded.width !== meta.width || decoded.height !== meta.height || decoded.data?.length !== meta.width * meta.height * 4) fail();
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return { ...meta, byteLength: bytes.length, sha256: Array.from(hash, n => n.toString(16).padStart(2, '0')).join('') };
}
