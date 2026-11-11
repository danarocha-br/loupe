"use server";

// Feature-flag preview (PER-132): the two Server Actions behind the Toolbar's
// Feature flags card. They run on the dev server because both need the app's
// `FLAGS_SECRET`: discovery sends an access proof to the Flags SDK's endpoint, and
// a preview is the encrypted `vercel-flag-overrides` cookie `flags/next` reads.
// Setting a cookie in a Server Action re-renders the page, so it reflects the flag.
//
// Only the Toolbar imports this module, and the Toolbar reaches the page through
// `<LoupeMount />`'s development-only import, so a production build holds neither.

import { accessProof, decryptOverrides, encryptOverrides } from "./flags-crypto.js";

export type FlagValue = string | number | boolean | null | FlagValue[] | { [key: string]: FlagValue };
export type FlagOption = { value: FlagValue; label?: string };
export type FlagDefinition = { key: string; description?: string; origin?: string; options?: FlagOption[] };
export type FlagOverrides = Record<string, FlagValue>;

export type FlagsResult =
  | { ok: true; definitions: FlagDefinition[]; overrides: FlagOverrides }
  | { ok: false; reason: string };

export type OverridesResult = { ok: true; overrides: FlagOverrides } | { ok: false; reason: string };

/** The cookie `flags/next` reads overrides from. */
const COOKIE = "vercel-flag-overrides";
/** The Flags SDK's discovery endpoint, the one the Flags Explorer reads. */
const ENDPOINT = "/.well-known/vercel/flags";
/** Names Loupe's discovery request in the app's logs; `loupe doctor --build` also looks for it. */
const MARKER = "loupe-flag-preview";

const NO_SECRET =
  "FLAGS_SECRET isn't set on the dev server. The Flags SDK encrypts flag overrides with it, so previews need it.";

/** The app's flags, from its discovery endpoint, and the overrides the cookie holds now. */
export async function readFlags(): Promise<FlagsResult> {
  const secret = process.env.FLAGS_SECRET;
  if (!secret) return { ok: false, reason: NO_SECRET };
  try {
    const { cookies, headers } = await import("next/headers");
    const incoming = await headers();
    const host = incoming.get("host");
    if (!host) return { ok: false, reason: "The request has no Host header, so the discovery endpoint can't be reached." };
    const protocol = incoming.get("x-forwarded-proto") ?? "http";
    const response = await fetch(`${protocol}://${host}${ENDPOINT}`, {
      headers: {
        authorization: `Bearer ${await accessProof(secret)}`,
        // The signed-in session goes along, so an auth proxy treats it like the page.
        cookie: incoming.get("cookie") ?? "",
        "x-loupe": MARKER,
      },
      cache: "no-store",
      redirect: "manual",
    });
    if (response.status === 404) {
      return { ok: false, reason: `The app has no flags discovery endpoint at ${ENDPOINT}.` };
    }
    if (response.status === 401) {
      return { ok: false, reason: `${ENDPOINT} refused Loupe's access proof: does it check the same FLAGS_SECRET?` };
    }
    if (!response.ok) return { ok: false, reason: `${ENDPOINT} answered ${response.status}.` };
    const definitions = definitionsOf(await response.json());
    const overrides = ((await decryptOverrides((await cookies()).get(COOKIE)?.value, secret)) ?? {}) as FlagOverrides;
    return { ok: true, definitions, overrides };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Sets some overrides and clears others ("all": every override in the cookie), then
 * writes the cookie back, or deletes it once nothing is overridden.
 */
export async function writeFlagOverrides(set: FlagOverrides, clear: string[] | "all"): Promise<OverridesResult> {
  const secret = process.env.FLAGS_SECRET;
  if (!secret) return { ok: false, reason: NO_SECRET };
  try {
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    const current = clear === "all" ? {} : ((await decryptOverrides(jar.get(COOKIE)?.value, secret)) ?? {});
    const next: FlagOverrides = { ...(current as FlagOverrides) };
    if (clear !== "all") for (const key of clear) delete next[key];
    Object.assign(next, set);
    if (Object.keys(next).length === 0) jar.delete(COOKIE);
    else jar.set(COOKIE, await encryptOverrides(next, secret), { path: "/", sameSite: "lax" });
    return { ok: true, overrides: next };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

/** The endpoint's `ApiData.definitions`, as a sorted list; anything malformed is dropped. */
function definitionsOf(data: unknown): FlagDefinition[] {
  const raw = (data as { definitions?: unknown } | null)?.definitions;
  if (typeof raw !== "object" || raw === null) return [];
  return Object.entries(raw as Record<string, Record<string, unknown> | null>)
    .map(([key, definition]): FlagDefinition => {
      const options = Array.isArray(definition?.options)
        ? (definition.options as unknown[]).filter(
            (option): option is FlagOption => typeof option === "object" && option !== null && "value" in option,
          )
        : undefined;
      return {
        key,
        ...(typeof definition?.description === "string" ? { description: definition.description } : {}),
        ...(typeof definition?.origin === "string" ? { origin: definition.origin } : {}),
        ...(options && options.length > 0 ? { options } : {}),
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}
