// @vitest-environment jsdom
import { randomBytes } from "node:crypto";
import { decryptOverrides as sdkDecryptOverrides } from "flags";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encryptOverrides } from "./flags-crypto.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The Server Actions' only Next dependency: a cookie jar and the request's headers.
const jar = new Map<string, string>();
let requestHeaders = new Headers({ host: "localhost:3131", cookie: "__session=abc" });
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
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

  const settle = async () => {
    for (let i = 0; i < 5; i++) await act(async () => {});
  };
  const pill = (flag: string, text: string) =>
    [...container.querySelectorAll(`[data-flag="${flag}"] .pills button`)].find((b) => b.textContent === text) as HTMLButtonElement;
  const button = (text: string) => [...container.querySelectorAll("button")].find((b) => b.textContent === text) as HTMLButtonElement;

  it("previews a flag, records it for the Proposal, and clearing gives the app its value back", async () => {
    const { FlagsCard, previewedFlags } = await import("./flags.js");
    act(() => root.render(<FlagsCard />));
    await settle();

    expect(container.querySelector('[data-flag="showBetaFeature"]')?.textContent).toContain("The app decides");
    // Declared without options: offered as on and off.
    expect(pill("showBetaFeature", "On")).toBeTruthy();
    expect(await previewedFlags()).toEqual([]);

    act(() => pill("showBetaFeature", "On").click());
    await settle();
    await expect(overridesInCookie()).resolves.toEqual({ showBetaFeature: true });
    expect(pill("showBetaFeature", "On").getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector('[data-flag="showBetaFeature"]')?.textContent).toContain("Previewing true");

    act(() => pill("plan", "Pro").click());
    await settle();
    expect(await previewedFlags()).toEqual([
      { key: "plan", value: "pro", label: "Pro", description: "Pricing plan" },
      { key: "showBetaFeature", value: true },
    ]);

    act(() => (container.querySelector('[data-flag="plan"] .reset') as HTMLButtonElement).click());
    await settle();
    expect(await previewedFlags()).toEqual([{ key: "showBetaFeature", value: true }]);
    expect(container.querySelector('[data-flag="plan"]')?.textContent).toContain("The app decides");

    act(() => button("Clear flag previews").click());
    await settle();
    expect(jar.has(COOKIE)).toBe(false);
    expect(await previewedFlags()).toEqual([]);
    expect(button("Clear flag previews").disabled).toBe(true);
  });

  it("reads a preview back after a reload, and lists an override the app doesn't declare", async () => {
    jar.set(COOKIE, await encryptOverrides({ showBetaFeature: true, retired: 1 }, secret));
    const { FlagsCard, previewedFlags } = await import("./flags.js");
    act(() => root.render(<FlagsCard />));
    await settle();

    expect(pill("showBetaFeature", "On").getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector('[data-flag="retired"]')?.textContent).toContain("Not declared");
    expect((await previewedFlags()).map((flag) => flag.key)).toEqual(["retired", "showBetaFeature"]);
  });

  it("gives the Proposal the cookie's previews without the card ever mounting", async () => {
    jar.set(COOKIE, await encryptOverrides({ plan: "pro" }, secret));
    const { previewedFlags } = await import("./flags.js");
    expect(await previewedFlags()).toEqual([{ key: "plan", value: "pro", label: "Pro", description: "Pricing plan" }]);
  });

  it("explains why previews are unavailable", async () => {
    vi.stubEnv("FLAGS_SECRET", "");
    const { FlagsCard } = await import("./flags.js");
    act(() => root.render(<FlagsCard />));
    await settle();
    expect(container.textContent).toContain("FLAGS_SECRET isn't set");
  });
});
