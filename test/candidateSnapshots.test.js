import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeCandidateSnapshots } from '../src/data/candidateSnapshots.js';
test('an older delayed research poll cannot undo the newer saved review or source revision',()=>{
 const initial={id:'123',revision:1,review:{note:'old'}};
 const saved={id:'123',revision:2,review:{note:'saved'}};
 let rows=mergeCandidateSnapshots([initial],[saved]);
 rows=mergeCandidateSnapshots(rows,[initial]);assert.equal(rows[0].review.note,'saved');assert.equal(rows[0].revision,2);
 const research={id:'123',revision:3,review:{note:'source refreshed'}};
 rows=mergeCandidateSnapshots(rows,[research]);rows=mergeCandidateSnapshots(rows,[saved]);assert.equal(rows[0].revision,3);
 assert.equal(mergeCandidateSnapshots(rows,[{id:'456',revision:1}]).length,2);
});
