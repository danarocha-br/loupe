// The view's copy for a command's Copy button (patterns/command/): the Toolbar names
// commands and never runs them (PER-100 §5). On an insecure origin `navigator.clipboard`
// is undefined, so this throws; CommandLine calls it inside a promise and says so.

/** Puts `text` on the clipboard; rejects, or throws, when the clipboard refuses it. */
export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
