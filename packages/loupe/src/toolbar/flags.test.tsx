// @vitest-environment jsdom
import { randomBytes } from "node:crypto";
import { decryptOverrides as sdkDecryptOverrides } from "flags";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptJwe, encryptOverrides } from "./flags-crypto.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The Server Actions' only Next dependency: a cookie jar and the request's headers.
const jar = new Map<string, string>();
/** The options each cookie was last set with. */
const cookieOptions = new Map<string, unknown>();
let requestHeaders = new Headers({ host: "localhost:3131", cookie: "__session=abc" });
// Each request takes real time, as on a slow CI runner: no test may count ticks to wait for a write.
const slow = () => new Promise((resolve) => setTimeout(resolve, 20));
vi.mock("next/headers", () => ({
  cookies: async () => {
    await slow();
    return {
      get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
      set: (name: string, value: string, options?: unknown) => {
        jar.set(name, value);
        cookieOptions.set(name, options);
      },
      delete: (name: string) => void jar.delete(name),
    };
  },
  headers: async () => requestHeaders,
}));

const secret = randomBytes(32).toString("base64url");
const COOKIE = "vercel-flag-overrides";
const DEFINITIONS = {
  definitions: {
    showBetaFeature: {},
    plan: { description: "Pricing plan", options: [{ value: "starter", label: "Starter" }, { value: "pro", label: "Pro" }] },
  },
};

let endpoint: { status: number; body: unknown };
const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify(endpoint.body), { status: endpoint.status }));

beforeEach(() => {
  jar.clear();
  cookieOptions.clear();
  endpoint = { status: 200, body: DEFINITIONS };
  fetchMock.mockClear();
  requestHeaders = new Headers({ host: "localhost:3131", cookie: "__session=abc" });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("FLAGS_SECRET", secret);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const overridesInCookie = () => sdkDecryptOverrides(jar.get(COOKIE) as string, secret);

describe("readFlags", () => {
  it("discovers flags through the endpoint with an access proof and reads the overrides the cookie holds", async () => {
    const { readFlags } = await import("./flags-server.js");
    jar.set(COOKIE, await encryptOverrides({ showBetaFeature: true }, secret));

    const result = await readFlags();

    expect(result).toEqual({
      ok: true,
      definitions: [
        { key: "plan", description: "Pricing plan", options: DEFINITIONS.definitions.plan.options },
        { key: "showBetaFeature" },
      ],
      overrides: { showBetaFeature: true },
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:3131/.well-known/vercel/flags");
    const sent = new Headers(init.headers);
    expect(sent.get("authorization")).toMatch(/^Bearer [\w-]+\.\.[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(sent.get("cookie")).toBe("__session=abc");
  });

  it("sends the proof to the loopback port, never to the host the request names", async () => {
    const { readFlags } = await import("./flags-server.js");
    requestHeaders = new Headers({ host: "rebound.example:3131", "x-forwarded-proto": "https" });
    await readFlags();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:3131/.well-known/vercel/flags");
  });

  it("says why when there is no secret, no endpoint, or the endpoint refuses the proof", async () => {
    const { readFlags } = await import("./flags-server.js");
    endpoint = { status: 404, body: null };
    expect(await readFlags()).toEqual({ ok: false, reason: expect.stringContaining("no flags discovery endpoint") });
    endpoint = { status: 401, body: null };
    expect(await readFlags()).toEqual({ ok: false, reason: expect.stringContaining("refused Loupe's access proof") });
    vi.stubEnv("FLAGS_SECRET", "");
    expect(await readFlags()).toEqual({ ok: false, reason: expect.stringContaining("FLAGS_SECRET isn't set") });
  });
});

describe("writeFlagOverrides", () => {
  it("keeps other overrides, clears the named ones, and deletes the cookie once nothing is overridden", async () => {
    const { writeFlagOverrides } = await import("./flags-server.js");
    jar.set(COOKIE, await encryptOverrides({ fromVercelToolbar: "x" }, secret));

    expect(await writeFlagOverrides({ plan: "pro" }, [])).toEqual({ ok: true, overrides: { fromVercelToolbar: "x", plan: "pro" } });
    await expect(overridesInCookie()).resolves.toEqual({ fromVercelToolbar: "x", plan: "pro" });

    expect(await writeFlagOverrides({}, ["plan"])).toEqual({ ok: true, overrides: { fromVercelToolbar: "x" } });
    expect(await writeFlagOverrides({}, ["fromVercelToolbar"])).toEqual({ ok: true, overrides: {} });
    expect(jar.has(COOKIE)).toBe(false);

    await writeFlagOverrides({ a: true, b: false }, []);
    expect(await writeFlagOverrides({}, "all")).toEqual({ ok: true, overrides: {} });
    expect(jar.has(COOKIE)).toBe(false);
  });

  it("lets a preview expire after 8 hours, so it can't outlive the app that set it (PER-182)", async () => {
    // Cookies ignore the port: one left on localhost reaches every other app there, and
    // flags/next throws on it when that app has no FLAGS_SECRET.
    const { writeFlagOverrides } = await import("./flags-server.js");
    const before = Math.floor(Date.now() / 1000);
    await writeFlagOverrides({ plan: "pro" }, []);

    expect(cookieOptions.get(COOKIE)).toEqual({ path: "/", sameSite: "lax", maxAge: 8 * 3600 });
    // The token expires with the cookie, so a cookie kept past its Max-Age reads as no preview.
    const exp = (await decryptJwe(jar.get(COOKIE) as string, secret))?.exp as number;
    expect(exp - before).toBeGreaterThanOrEqual(8 * 3600);
    expect(exp - before).toBeLessThanOrEqual(8 * 3600 + 5);
  });
});

describe("the Feature flags card", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // Each test is a fresh page load: the card's store is module state.
    vi.resetModules();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  /** Waits until `check` passes; each try first lets React commit what has settled. */
  const until = (check: () => unknown) =>
    vi.waitFor(
      async () => {
        await act(async () => {});
        check();
      },
      { timeout: 2000, interval: 10 },
    );
  /**
   * Waits until the card is loaded and no write is in flight. A write disables every
   * pill, so a click made before it ends is dropped: that is how a fixed number of
   * ticks failed on CI.
   */
  const idle = () =>
    until(() => {
      const pills = container.querySelectorAll(".pills button");
      if (pills.length === 0 || container.querySelector(".pills button:disabled")) throw new Error("card busy");
    });
  const pill = (flag: string, text: string) =>
    [...container.querySelectorAll(`[data-flag="${flag}"] .pills button`)].find((b) => b.textContent === text) as HTMLButtonElement;
  const button = (text: string) => [...container.querySelectorAll("button")].find((b) => b.textContent === text) as HTMLButtonElement;

  it("previews a flag, records it for the Proposal, and clearing gives the app its value back", async () => {
    const { FlagsCard, previewedFlags } = await import("./flags.js");
    act(() => root.render(<FlagsCard />));
    await idle();

    expect(container.querySelector('[data-flag="showBetaFeature"]')?.textContent).toContain("The app decides");
    // Declared without options: offered as on and off.
    expect(pill("showBetaFeature", "On")).toBeTruthy();
    expect(await previewedFlags()).toEqual([]);

    act(() => pill("showBetaFeature", "On").click());
    await idle();
    await expect(overridesInCookie()).resolves.toEqual({ showBetaFeature: true });
    expect(pill("showBetaFeature", "On").getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector('[data-flag="showBetaFeature"]')?.textContent).toContain("Previewing true");

    act(() => pill("plan", "Pro").click());
    await idle();
    expect(await previewedFlags()).toEqual([
      { key: "plan", value: "pro", label: "Pro", description: "Pricing plan" },
      { key: "showBetaFeature", value: true },
    ]);

    act(() => (container.querySelector('[data-flag="plan"] .reset') as HTMLButtonElement).click());
    await idle();
    expect(await previewedFlags()).toEqual([{ key: "showBetaFeature", value: true }]);
    expect(container.querySelector('[data-flag="plan"]')?.textContent).toContain("The app decides");

    act(() => button("Clear flag previews").click());
    await idle();
    expect(jar.has(COOKIE)).toBe(false);
    expect(await previewedFlags()).toEqual([]);
    expect(button("Clear flag previews").disabled).toBe(true);
  });

  it("reads a preview back after a reload, and lists an override the app doesn't declare", async () => {
    jar.set(COOKIE, await encryptOverrides({ showBetaFeature: true, retired: 1 }, secret));
    const { FlagsCard, previewedFlags } = await import("./flags.js");
    act(() => root.render(<FlagsCard />));
    await idle();

    expect(pill("showBetaFeature", "On").getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector('[data-flag="retired"]')?.textContent).toContain("Not declared");
    expect((await previewedFlags()).map((flag) => flag.key)).toEqual(["retired", "showBetaFeature"]);
  });

  it("gives the Proposal the cookie's previews without the card ever mounting", async () => {
    jar.set(COOKIE, await encryptOverrides({ plan: "pro" }, secret));
    const { previewedFlags } = await import("./flags.js");
    expect(await previewedFlags()).toEqual([{ key: "plan", value: "pro", label: "Pro", description: "Pricing plan" }]);
  });

  it("says a preview lasts 8 hours in a cookie every app on localhost shares (PER-182)", async () => {
    const { FlagsCard } = await import("./flags.js");
    act(() => root.render(<FlagsCard />));
    await idle();
    expect(container.querySelector('[aria-label="Feature flags"]')?.textContent).toContain(
      "A preview lasts 8 hours, in a cookie every app on localhost shares. Clear it before switching projects.",
    );
  });

  it("explains why previews are unavailable", async () => {
    vi.stubEnv("FLAGS_SECRET", "");
    const { FlagsCard } = await import("./flags.js");
    act(() => root.render(<FlagsCard />));
    await until(() => expect(container.textContent).toContain("FLAGS_SECRET isn't set"));
  });
});
