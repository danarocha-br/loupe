// State props held by an Override (PER-96, PER-123). Nothing is blocked: the app's
// `onXChange` keeps running and its own value keeps tracking it, so the runtime
// only has to say when the app and the Override disagree. Pure, like the store.

import { stateSiblingName } from "../state-prop.js";
import type { Props, Scope } from "./store.js";

export const STATE_SCOPE_REASON = "Change it on one Instance.";

/**
 * Why `prop` can't be overridden at `scope`, or null when it can. A State prop is
 * Instance-scope only: a group `open` would open every dialog at that call site
 * at once. The rule is uniform, so no State prop is exempt.
 */
export function stateScopeRefusal(
  scope: Scope,
  stateProps: readonly string[],
  prop: string,
): string | null {
  return scope !== "instance" && stateProps.includes(prop) ? STATE_SCOPE_REASON : null;
}

export type StateProp = {
  /** The call site writes it, so the app controls it; otherwise the component owns the state. */
  controlled: boolean;
  /** Present while an Override holds it. `appTried` is present once the app wants another value. */
  held?: { value: unknown; appTried?: unknown };
};

/**
 * Per Instance, what the app has tried to set instead of each held value since
 * the hold began: a value asked for through `onXChange`, or a change to the
 * app's own value by any other path. Holding a value the app never had is not an attempt.
 */
export type HoldTracker = {
  /** Per held prop, the value the app last tried; absent while it agrees with the Override. */
  attempts: Map<string, unknown>;
  /** Per held prop, the app's own value at the last commit (`undefined` when uncontrolled). */
  baselines: Map<string, unknown>;
  /** Per held prop, the attempt last reported, so each is said once. */
  reported: Map<string, unknown>;
};

export function createHoldTracker(): HoldTracker {
  return { attempts: new Map(), baselines: new Map(), reported: new Map() };
}

/** The app's attempt to change a held value, if there is one; boxed, as `undefined` is a value. */
export function appTried(held: unknown, attempts: ReadonlyMap<string, unknown>, prop: string): { value: unknown } | null {
  if (!attempts.has(prop)) return null;
  const attempted = attempts.get(prop);
  return Object.is(attempted, held) ? null : { value: attempted };
}

export type HeldAttempt = { prop: string; held: unknown; tried: unknown };

/** Updates the tracker after a commit; returns the attempts not reported yet. */
export function trackHeldStates(
  tracker: HoldTracker,
  stateProps: readonly string[],
  current: Props,
  held: Props,
): HeldAttempt[] {
  const fresh: HeldAttempt[] = [];
  for (const prop of stateProps) {
    if (!(prop in held)) {
      tracker.attempts.delete(prop);
      tracker.baselines.delete(prop);
      tracker.reported.delete(prop);
      continue;
    }
    const appValue = current[prop];
    if (!tracker.baselines.has(prop)) {
      tracker.baselines.set(prop, appValue);
    } else if (!Object.is(tracker.baselines.get(prop), appValue)) {
      // The app moved its own value while the Override held it.
      if (Object.is(appValue, held[prop])) tracker.attempts.delete(prop);
      else tracker.attempts.set(prop, appValue);
      tracker.baselines.set(prop, appValue);
    }
    const tried = appTried(held[prop], tracker.attempts, prop);
    if (tried === null) {
      tracker.reported.delete(prop);
      continue;
    }
    if (tracker.reported.has(prop) && Object.is(tracker.reported.get(prop), tried.value)) continue;
    tracker.reported.set(prop, tried.value);
    fresh.push({ prop, held: held[prop], tried: tried.value });
  }
  return fresh;
}

/** `current` is the app's own props, so a library-injected `X` doesn't count as controlled. */
export function describeStates(
  stateProps: readonly string[],
  current: Props,
  overrides: Props,
  attempts: ReadonlyMap<string, unknown>,
): Record<string, StateProp> {
  const states: Record<string, StateProp> = {};
  for (const prop of stateProps) {
    const controlled = prop in current;
    if (!(prop in overrides)) {
      states[prop] = { controlled };
      continue;
    }
    const held = overrides[prop];
    const tried = appTried(held, attempts, prop);
    states[prop] = { controlled, held: tried ? { value: held, appTried: tried.value } : { value: held } };
  }
  return states;
}

/**
 * The props to render while Overrides hold State props: each held prop's
 * `onXChange` records what was asked for, then calls the app's handler, if any.
 * Props are returned unchanged when nothing is held, so the app's handler
 * reaches the component as it is.
 */
export function holdStateHandlers(
  props: Props,
  overrides: Props,
  stateProps: readonly string[],
  attempts: Map<string, unknown>,
  onAttempt: () => void,
): Props {
  let result = props;
  for (const prop of stateProps) {
    if (!(prop in overrides)) continue;
    const handlerName = stateSiblingName(prop);
    const app = props[handlerName];
    const held = overrides[prop];
    if (result === props) result = { ...props };
    result[handlerName] = (value: unknown, ...rest: unknown[]) => {
      const had = attempts.has(prop);
      const was = attempts.get(prop);
      if (Object.is(value, held)) attempts.delete(prop);
      else attempts.set(prop, value);
      const changed = had !== attempts.has(prop) || !Object.is(was, attempts.get(prop));
      try {
        return typeof app === "function" ? app(value, ...rest) : undefined;
      } finally {
        // Only a changed attempt rerenders, so a library that calls the handler
        // from an effect can't loop.
        if (changed) onAttempt();
      }
    };
  }
  return result;
}

export function formatValue(value: unknown): string {
  if (typeof value === "function") return "a function";
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
