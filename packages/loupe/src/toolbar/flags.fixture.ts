// In-memory adapters for the flag preview's two seams (PER-216), for tests only:
// the build leaves `*.fixture.ts` out. `memoryRequest` stands in for Next's request
// under the preview core. `memorySource` runs that core in-process as the store's
// source, where the page calls the Server Actions.

import { randomBytes } from "node:crypto";
import { encryptOverrides } from "./flags-crypto.js";
import {
  type CookieJar,
  type CookieOptions,
  type FlagOverrides,
  type FlagRequest,
  OVERRIDES_COOKIE,
  readPreview,
  writePreview,
} from "./flags-preview.js";
import type { FlagSource } from "./flags-store.js";

export type MemoryRequest = FlagRequest & {
  secret: string;
  /** Each cookie, and the options it was last set with. */
  jar: Map<string, { value: string; options?: CookieOptions }>;
  /** Every request to the discovery endpoint. */
  calls: { url: string; init: RequestInit }[];
};

/** What the request starts out holding. */
export type MemorySeed = {
  /** The cookie already holds these, encrypted with `secret`. */
  overrides?: FlagOverrides;
  /** What the discovery endpoint answers: 200 with no flags declared by default. */
  endpoint?: { status?: number; body?: unknown };
  headers?: HeadersInit;
  /** A fresh 256-bit key by default; "" when `FLAGS_SECRET` isn't set. */
  secret?: string;
};

export function memoryRequest(seed: MemorySeed = {}): MemoryRequest {
  const secret = seed.secret ?? randomBytes(32).toString("base64url");
  const endpoint = { status: 200, body: { definitions: {} }, ...seed.endpoint };
  const headers = new Headers(seed.headers ?? { host: "localhost:3131", cookie: "__session=abc" });
  const jar: MemoryRequest["jar"] = new Map();
  const calls: MemoryRequest["calls"] = [];
  const cookies: CookieJar = {
    get: (name) => {
      const cookie = jar.get(name);
      return cookie && { value: cookie.value };
    },
    set: (name, value, options) => void jar.set(name, { value, options }),
    delete: (name) => void jar.delete(name),
  };
  // Encrypting is async, so the seed lands on the first read and the factory stays synchronous.
  let seeded: Promise<void> | undefined;
  return {
    secret,
    jar,
    calls,
    async cookies() {
      // Each request takes real time, as on a slow CI runner: no test may count ticks to wait for a write.
      await new Promise((resolve) => setTimeout(resolve, 20));
      seeded ??= seed.overrides
        ? encryptOverrides(seed.overrides, secret).then((value) => void jar.set(OVERRIDES_COOKIE, { value }))
        : Promise.resolve();
      await seeded;
      return cookies;
    },
    headers: async () => headers,
    async fetch(url, init) {
      calls.push({ url, init });
      return new Response(JSON.stringify(endpoint.body), { status: endpoint.status });
    },
  };
}

export function memorySource(request: FlagRequest): FlagSource {
  return {
    read: () => readPreview(request),
    write: (set, clear) => writePreview(request, set, clear),
  };
}
