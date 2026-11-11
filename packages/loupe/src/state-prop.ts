// A State prop is `X` with an `onXChange` sibling (PER-96): `open`/`onOpenChange`,
// `value`/`onValueChange`, `checked`/`onCheckedChange`. `generate` finds them in the
// types and the runtime wraps the sibling while an Override holds `X`, so both
// read the pairing from here.

/** `open` → `onOpenChange`. */
export function stateSiblingName(name: string): string {
  return `on${name.charAt(0).toUpperCase()}${name.slice(1)}Change`;
}
