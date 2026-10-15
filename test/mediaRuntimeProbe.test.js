import test from 'node:test';
import assert from 'node:assert/strict';
const mod = await import('../server/media/runtimeProbe.js').catch(() => ({}));
test('runtime readiness requires actual decode of own 3 formats and 8MP fixture; errors fail closed', async () => {
 assert.equal(typeof mod.probeMediaRuntime, 'function');
 let calls = 0;
 const fixtures = ['image/png','image/jpeg','image/webp','image/png'].map((mime, i) => ({ mime, bytes: new Uint8Array([i]), width: i === 3 ? 2000 : 2, height: i === 3 ? 4000 : 3 }));
 const result = await mod.probeMediaRuntime({ fixtures, validate: async (bytes, mime) => { calls++; const f = fixtures[bytes[0]]; return { width: f.width, height: f.height, mime }; } });
 assert.equal(calls, 4); assert.equal(result.ready, true);
 await assert.rejects(mod.probeMediaRuntime({ fixtures, validate: async () => { throw new Error('decoder failed'); } }), { code: 'MEDIA_RUNTIME_UNAVAILABLE' });
});
