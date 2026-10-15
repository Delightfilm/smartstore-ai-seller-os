export async function probeMediaRuntime({ fixtures, validate }) {
 const start = performance.now();
 try {
  for (const f of fixtures) {
   const meta = await validate(f.bytes, f.mime);
   if (meta.width !== f.width || meta.height !== f.height || (f.sha256 && meta.sha256 !== f.sha256)) throw new Error('Probe mismatch');
  }
  return { ready: true, fixtures: fixtures.length, elapsedMs: Math.round(performance.now() - start) };
 } catch { throw Object.assign(new Error('MEDIA_RUNTIME_UNAVAILABLE'), { code: 'MEDIA_RUNTIME_UNAVAILABLE' }); }
}
