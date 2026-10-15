// Real Node/Deno raster compatibility probe. Self-made technical fixtures only.
import { createJsquashDecoder } from '../server/media/jsquashDecoder.js';
import { validateUploadedImage } from '../server/media/imageValidation.js';
import { wasmBytes } from '../supabase/functions/seller-os-media/codecBytes.js';
import { deflateSync } from 'node:zlib';
export const fixtures = [
 ['image/png', 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==',1,1],
 ['image/jpeg', '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAgICAgJCAkKCgkNDgwODRMREBARExwUFhQWFBwrGx8bGx8bKyYuJSMlLiZENS8vNUROQj5CTl9VVV93cXecnNEBCAgICAkICQoKCQ0ODA4NExEQEBETHBQWFBYUHCsbHxsbHxsrJi4lIyUuJkQ1Ly81RE5CPkJOX1VVX3dxd5yc0f/CABEIAAMAAgMBIgACEQEDEQH/xAAnAAEBAAAAAAAAAAAAAAAAAAAAAQEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEAMQAAAAgP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8Af//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Af//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Af//Z',2,3],
 ['image/webp', 'UklGRkYAAABXRUJQVlA4WAoAAAAQAAAAAQAAAgAAQUxQSAcAAAAAf39/f39/AFZQOCAYAAAAUAEAnQEqAgADAAIANCWkAAR0AAD+AAAA',2,3],
];
const decoder = createJsquashDecoder({ wasmBytes });
const start = performance.now();
for (const [mime, encoded, width, height] of fixtures) {
 const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
 const result = await validateUploadedImage(bytes, mime, decoder);
 if (result.width !== width || result.height !== height) throw new Error('Fixture dimensions changed');
 console.log(JSON.stringify({ runtime: typeof Deno === 'undefined' ? 'Node' : 'Deno', mime, width: result.width, height: result.height, sha256: result.sha256 }));
}
export function pressurePng() {
 const crc = bytes => { let c = -1; for (const b of bytes) { c ^= b; for (let n = 0; n < 8; n++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (c ^ -1) >>> 0; };
 const chunk = (name, data) => { const b = Buffer.alloc(data.length + 12); b.writeUInt32BE(data.length); b.write(name, 4); b.set(data, 8); b.writeUInt32BE(crc(b.subarray(4, -4)), b.length - 4); return b; };
 const h = Buffer.alloc(13); h.writeUInt32BE(2000); h.writeUInt32BE(4000, 4); h[8] = 8; h[9] = 6;
 const bytes = Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',h),chunk('IDAT',deflateSync(Buffer.alloc(8001*4000))),chunk('IEND',Buffer.alloc(0))]);
 return bytes;
}
if (process.argv.includes('--pressure')) {
 const bytes = pressurePng();
 const result = await validateUploadedImage(bytes,'image/png',decoder);
 if (result.width * result.height !== 8000000) throw new Error('Pressure fixture mismatch');
 console.log(JSON.stringify({ pixels: 8000000, encodedBytes: bytes.length, memory: process.memoryUsage(), note:'Self-made local TEST_ONLY pressure raster, not hosted limits' }));
}
console.log(JSON.stringify({ elapsedMs: Math.round(performance.now() - start), note: 'Local runtime only, not hosted CPU/memory proof' }));
