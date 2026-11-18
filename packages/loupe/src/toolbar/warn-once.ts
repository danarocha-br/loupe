// Says a message the first time it is seen and never again, for a check that repeats: on
// focus, on each selection, on each failed call. Its own module because the server actions
// need it too, and a "use server" file can only export async functions. The browser and the
// dev server each hold their own copy, which lasts as long as the page or the server does.
//
// What it remembers is bounded, because a server action's message can carry what a caller
// sent (a path in a filesystem error): the newest messages, by their first characters.

/** More than any page or dev server has distinct messages; past it the oldest is forgotten. */
const MAX_SEEN = 100;
/** Two messages that agree this far count as one. */
const MAX_KEY = 500;

const seen = new Set<string>();

/** `log` is read at the call, so a spy installed later still catches it. */
export function warnOnce(message: string, log: (message: string) => void = console.warn): void {
  const key = message.slice(0, MAX_KEY);
  if (seen.has(key)) return;
  if (seen.size >= MAX_SEEN) {
    const oldest = seen.values().next().value;
    if (oldest !== undefined) seen.delete(oldest);
  }
  seen.add(key);
  log(message);
}
