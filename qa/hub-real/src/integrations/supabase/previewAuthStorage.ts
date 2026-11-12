// Owned deployment storage only; no third-party editor or postMessage.
export function brokeredPreviewStorage() {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage;
}
