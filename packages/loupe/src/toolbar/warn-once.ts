// Says a message the first time it is seen and never again, for a check that repeats: on
// focus, on each selection, on each failed call. Its own module because the server actions
// need it too, and a "use server" file can only export async functions. The browser and the
// dev server each hold their own copy, which lasts as long as the page or the server does.

const seen = new Set<string>();

/** `log` is read at the call, so a spy installed later still catches it. */
export function warnOnce(message: string, log: (message: string) => void = console.warn): void {
  if (seen.has(message)) return;
  seen.add(message);
  log(message);
}
