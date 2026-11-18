// Feature-flag preview (PER-132): reading and writing a preview against a request.
// Discovery sends an access proof to the Flags SDK's endpoint, and a preview is the
// encrypted `vercel-flag-overrides` cookie `flags/next` reads.
//
// The request is a seam (PER-216): the Toolbar's Server Actions pass Next's
// (`flags-server.ts`), and tests pass an in-memory one (`flags.fixture.ts`).
// Server only: the browser imports this module's types and nothing else.

import { accessProof, decryptOverrides, encryptOverrides } from "./flags-crypto.js";
import { PREVIEW_SECONDS } from "./flags-lifetime.js";

export type FlagValue = string | number | boolean | null | FlagValue[] | { [key: string]: FlagValue };
export type FlagOption = { value: FlagValue; label?: string };
export type FlagDefinition = { key: string; description?: string; origin?: string; options?: FlagOption[] };
export type FlagOverrides = Record<string, FlagValue>;

export type FlagsResult =
  | { ok: true; definitions: FlagDefinition[]; overrides: FlagOverrides }
  | { ok: false; reason: string };

export type OverridesResult = { ok: true; overrides: FlagOverrides } | { ok: false; reason: string };

/** What reading and writing a preview needs from the dev server's request. */
export type FlagRequest = {
  /** The app's `FLAGS_SECRET`; empty or undefined when it isn't set. */
  secret: string | undefined;
  /** The cookie jar, as Next's `cookies()` gives it in a Server Action. Asked for only once there is a secret. */
  cookies(): Promise<CookieJar>;
  /** The request's headers, as Next's `headers()` gives them. Asked for only once there is a secret. */
  headers(): Promise<Pick<Headers, "get">>;
  /** Reaches the app's discovery endpoint. */
  fetch(url: string, init: RequestInit): Promise<Response>;
};

export type CookieJar = {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options: CookieOptions): void;
  delete(name: string): void;
};

export type CookieOptions = { path: string; sameSite: "lax"; maxAge: number };

/** The cookie `flags/next` reads overrides from. */
export const OVERRIDES_COOKIE = "vercel-flag-overrides";
/** The Flags SDK's discovery endpoint, the one the Flags Explorer reads. */
const ENDPOINT = "/.well-known/vercel/flags";
/** A string only the flag preview holds: `loupe doctor --build` looks for it to prove the Server Actions stayed out. */
const MARKER = "loupe-flag-preview";

const NO_SECRET =
  "FLAGS_SECRET isn't set on the dev server. The Flags SDK encrypts flag overrides with it, so previews need it.";

/** The app's flags, from its discovery endpoint, and the overrides the cookie holds now. */
export async function readPreview(request: FlagRequest): Promise<FlagsResult> {
  const { secret } = request;
  if (!secret) return { ok: false, reason: NO_SECRET };
  try {
    const incoming = await request.headers();
    const port = portOf(incoming);
    if (!port) return { ok: false, reason: "The request names no port, so the discovery endpoint can't be reached." };
    // Loopback, never the Host header: a page that rebinds its own name to this
    // server would otherwise receive the access proof and the session cookie.
    const response = await request.fetch(`http://127.0.0.1:${port}${ENDPOINT}`, {
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
    const token = (await request.cookies()).get(OVERRIDES_COOKIE)?.value;
    const overrides = ((await decryptOverrides(token, secret)) ?? {}) as FlagOverrides;
    return { ok: true, definitions, overrides };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Sets some overrides and clears others ("all": every override in the cookie), then
 * writes the cookie back, or deletes it once nothing is overridden. Each write
 * restarts the cookie's PREVIEW_SECONDS, and the token inside expires with it.
 */
export async function writePreview(
  request: FlagRequest,
  set: FlagOverrides,
  clear: string[] | "all",
): Promise<OverridesResult> {
  const { secret } = request;
  if (!secret) return { ok: false, reason: NO_SECRET };
  try {
    const jar = await request.cookies();
    const current = clear === "all" ? {} : ((await decryptOverrides(jar.get(OVERRIDES_COOKIE)?.value, secret)) ?? {});
    const next: FlagOverrides = { ...(current as FlagOverrides) };
    if (clear !== "all") for (const key of clear) delete next[key];
    Object.assign(next, set);
    if (Object.keys(next).length === 0) jar.delete(OVERRIDES_COOKIE);
    else {
      jar.set(OVERRIDES_COOKIE, await encryptOverrides(next, secret, PREVIEW_SECONDS), {
        path: "/",
        sameSite: "lax",
        maxAge: PREVIEW_SECONDS,
      });
    }
    return { ok: true, overrides: next };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

/** The port the dev server took this request on, from the Host header. */
function portOf(incoming: Pick<Headers, "get">): string | null {
  const host = incoming.get("host");
  if (!host) return null;
  try {
    const url = new URL(`http://${host}`);
    return url.port || "80";
  } catch {
    return null;
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
