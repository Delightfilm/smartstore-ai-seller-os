import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { revealCloseConfirmation, restoreEditorFocus } from '../src/dashboard/mediaDialogFocus.js';

test('dirty-close recovery is revealed before focus without a second scroll', () => {
 const calls = [];
 revealCloseConfirmation({ scrollIntoView: opts => calls.push(['reveal', opts]), focus: opts => calls.push(['focus', opts]) });
 assert.deepEqual(calls, [['reveal', { block: 'nearest' }], ['focus', { preventScroll: true }]]);
});
test('continue editing restores only a connected invoking control', () => {
 let focused = 0;
 restoreEditorFocus({ isConnected: true, focus: () => focused++ });
 restoreEditorFocus({ isConnected: false, focus: () => focused++ });
 restoreEditorFocus(null);
 assert.equal(focused, 1);
});
test('scoped media action controls cannot shrink below 44 by 44', () => {
 const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
 assert.match(css, /\.detail-media-dialog \.btn\{[^}]*min-width:44px;[^}]*min-height:44px;/);
 assert.match(css, /\.detail-media-heading>\.btn\{[^}]*flex-shrink:0/);
});
