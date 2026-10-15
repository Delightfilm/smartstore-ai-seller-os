export function revealCloseConfirmation(element) {
 element?.scrollIntoView({ block: 'nearest' });
 element?.focus({ preventScroll: true });
}
export function restoreEditorFocus(element) {
 if (element?.isConnected) element.focus();
}
