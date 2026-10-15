// Own technical image only; never represents a product or ChatGPT output.
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pressurePng } from './probe-media-codecs.mjs';
const bytes = pressurePng();
const dir = new URL('../.seller-os/media-acceptance/', import.meta.url);
await mkdir(dir, { recursive: true });
await writeFile(new URL('TEST_ONLY_NOT_PRODUCT.png', dir), bytes);
console.log(JSON.stringify({ file: 'TEST_ONLY_NOT_PRODUCT.png', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }));
