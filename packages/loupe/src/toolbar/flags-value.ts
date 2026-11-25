// Whether two flag values are the same (PER-132): a flag's option and the override it is
// previewed with. Its own module, so the Feature flags card's words (`panel-view/flags.ts`)
// don't pull the store's Server Actions into their import graph.

export function sameFlagValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
