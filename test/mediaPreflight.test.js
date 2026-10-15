import test from 'node:test';
import assert from 'node:assert/strict';
const mod = await import('../scripts/check-media-preflight.mjs').catch(() => ({}));
test('media enable gate rejects unknown, stale, insufficient or paid usage evidence', () => {
 assert.equal(typeof mod.assessMediaPreflight, 'function');
 const now = Date.now(), evidence = { projectRef: 'dzgczkwwezzsfqnjdqen', organizationId: 'ayericfklynxhwgqjutn', plan: 'Free', checkedAt: new Date(now).toISOString(), periodStart: new Date(now - 100000).toISOString(), periodEnd: new Date(now + 100000).toISOString(), policiesSafe: true, hostedDecoderPass: true, usage: Object.fromEntries(['storageBytes','egressBytes','databaseBytes','edgeInvocations'].map(k => [k, { used: 0, limit: 1024 ** 3 }])) };
 assert.equal(mod.assessMediaPreflight(evidence, now).enabled, true);
 for (const invalid of [null, { ...evidence, plan: 'Pro' }, { ...evidence, checkedAt: new Date(now - 86400001).toISOString() }, { ...evidence, policiesSafe: false }, { ...evidence, hostedDecoderPass: false }, { ...evidence, usage: {} }, { ...evidence, usage: { ...evidence.usage, storageBytes: { used: 1024 ** 3, limit: 1024 ** 3 } } }]) assert.equal(mod.assessMediaPreflight(invalid, now).enabled, false);
});
