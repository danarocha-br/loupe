// @vitest-environment jsdom
import { within } from "@testing-library/dom";
import { decryptOverrides as sdkDecryptOverrides } from "flags";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FlagsCard } from "./flags.js";
import { cleanup, renderInSurface } from "./surface/render.fixture.js";
import { listen } from "./ui/announcer/announcer.fixture.js";
import { decryptJwe } from "./flags-crypto.js";
import { type FlagRequest, type FlagsResult, readPreview, writePreview } from "./flags-preview.js";
import { flagsView, loadFlags, previewedFlags, setFlagSource } from "./flags-store.js";
import { type MemoryRequest, type MemorySeed, memoryRequest, memorySource } from "./flags.fixture.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Spelled out rather than imported: it is the contract with `flags/next`.
const COOKIE = "vercel-flag-overrides";
const DEFINITIONS = {
  definitions: {
    showBetaFeature: {},
    plan: { description: "Pricing plan", options: [{ value: "starter", label: "Starter" }, { value: "pro", label: "Pro" }] },
  },
};
const declared = { endpoint: { body: DEFINITIONS } };

/** The overrides the cookie holds, as the Flags SDK itself decrypts them. */
const overridesIn = (request: MemoryRequest) => sdkDecryptOverrides(request.jar.get(COOKIE)?.value as string, request.secret);

describe("readPreview", () => {
  it("discovers flags through the endpoint with an access proof and reads the overrides the cookie holds", async () => {
    const request = memoryRequest({ ...declared, overrides: { showBetaFeature: true } });

    const result = await readPreview(request);

    expect(result).toEqual({
      ok: true,
      definitions: [
        { key: "plan", description: "Pricing plan", options: DEFINITIONS.definitions.plan.options },
        { key: "showBetaFeature" },
      ],
      overrides: { showBetaFeature: true },
    });
    const [call] = request.calls;
    expect(call?.url).toBe("http://127.0.0.1:3131/.well-known/vercel/flags");
    const sent = new Headers(call?.init.headers);
    expect(sent.get("authorization")).toMatch(/^Bearer [\w-]+\.\.[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(sent.get("cookie")).toBe("__session=abc");
  });

  it("sends the proof to the loopback port, never to the host the request names", async () => {
    const request = memoryRequest({ ...declared, headers: { host: "rebound.example:3131", "x-forwarded-proto": "https" } });
    await readPreview(request);
    expect(request.calls[0]?.url).toBe("http://127.0.0.1:3131/.well-known/vercel/flags");
  });

  it("says why when there is no secret, no endpoint, or the endpoint refuses the proof", async () => {
    expect(await readPreview(memoryRequest({ endpoint: { status: 404, body: null } }))).toEqual({
      ok: false,
      reason: expect.stringContaining("no flags discovery endpoint"),
    });
    expect(await readPreview(memoryRequest({ endpoint: { status: 401, body: null } }))).toEqual({
      ok: false,
      reason: expect.stringContaining("refused Loupe's access proof"),
    });
    // With no secret the request is never asked for, so where there is no Next request
    // (any other test that renders the Toolbar) the default source just says why.
    const untouchable: FlagRequest = {
      ...memoryRequest({ secret: "" }),
      cookies: () => Promise.reject(new Error("asked for the cookies")),
      headers: () => Promise.reject(new Error("asked for the headers")),
    };
    expect(await readPreview(untouchable)).toEqual({ ok: false, reason: expect.stringContaining("FLAGS_SECRET isn't set") });
    expect(await writePreview(untouchable, { plan: "pro" }, [])).toEqual({
      ok: false,
      reason: expect.stringContaining("FLAGS_SECRET isn't set"),
    });
  });
});

describe("writePreview", () => {
  it("keeps other overrides, clears the named ones, and deletes the cookie once nothing is overridden", async () => {
    const request = memoryRequest({ overrides: { fromVercelToolbar: "x" } });

    expect(await writePreview(request, { plan: "pro" }, [])).toEqual({ ok: true, overrides: { fromVercelToolbar: "x", plan: "pro" } });
    await expect(overridesIn(request)).resolves.toEqual({ fromVercelToolbar: "x", plan: "pro" });

    expect(await writePreview(request, {}, ["plan"])).toEqual({ ok: true, overrides: { fromVercelToolbar: "x" } });
    expect(await writePreview(request, {}, ["fromVercelToolbar"])).toEqual({ ok: true, overrides: {} });
    expect(request.jar.has(COOKIE)).toBe(false);

    await writePreview(request, { a: true, b: false }, []);
    expect(await writePreview(request, {}, "all")).toEqual({ ok: true, overrides: {} });
    expect(request.jar.has(COOKIE)).toBe(false);
  });

  it("lets a preview expire after 8 hours, so it can't outlive the app that set it (PER-182)", async () => {
    // Cookies ignore the port: one left on localhost reaches every other app there, and
    // flags/next throws on it when that app has no FLAGS_SECRET.
    const request = memoryRequest();
    const before = Math.floor(Date.now() / 1000);
    await writePreview(request, { plan: "pro" }, []);

    expect(request.jar.get(COOKIE)?.options).toEqual({ path: "/", sameSite: "lax", maxAge: 8 * 3600 });
    // The token expires with the cookie, so a cookie kept past its Max-Age reads as no preview.
    const exp = (await decryptJwe(request.jar.get(COOKIE)?.value as string, request.secret))?.exp as number;
    expect(exp - before).toBeGreaterThanOrEqual(8 * 3600);
    expect(exp - before).toBeLessThanOrEqual(8 * 3600 + 5);
  });
});

describe("the flag store", () => {
  it("drops an answer from a source it has since left, as a page load would", async () => {
    let answer: (result: FlagsResult) => void = () => {};
    setFlagSource({ read: () => new Promise((resolve) => (answer = resolve)), write: async () => ({ ok: true, overrides: {} }) });
    const stale = loadFlags();

    setFlagSource(memorySource(memoryRequest(declared)));
    await loadFlags();
    answer({ ok: true, definitions: [], overrides: { plan: "starter" } });
    await stale;

    const view = flagsView();
    expect(view.status === "ready" && view.overrides).toEqual({});
  });

  describe("when a read fails during an export (PER-226)", () => {
    const PRO = { key: "plan", value: "pro", label: "Pro", description: "Pricing plan" };
    let warn: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    });
    afterEach(() => vi.restoreAllMocks());

    /**
     * A page whose flags have been read once, holding `plan: pro`, and the ways its next read can go wrong.
     * `warnOnce` says a message once per page, so each test fails with a reason of its own.
     */
    const readyPage = async () => {
      const request = memoryRequest({ ...declared, overrides: { plan: "pro" } });
      const source = memorySource(request);
      const fetched = request.fetch;
      let refusal: string | null = null;
      setFlagSource({ ...source, read: () => (refusal ? Promise.reject(new Error(refusal)) : source.read()) });
      await loadFlags();
      expect(flagsView().status).toBe("ready");
      return {
        request,
        /** The call is refused, as a restarting dev server does. */
        refuse: (message: string) => void (refusal = message),
        /** Discovery answers with `status`. */
        discoveryAnswers: (status: number) => void (request.fetch = async () => new Response("boom", { status })),
        repair: () => {
          refusal = null;
          request.fetch = fetched;
        },
      };
    };

    it("keeps a ready view, and records what it showed, when the call is refused", async () => {
      const page = await readyPage();
      page.refuse("fetch failed");

      expect(await previewedFlags()).toEqual([PRO]);

      expect(flagsView().status).toBe("ready");
      expect(warn).toHaveBeenCalledWith("[loupe] Couldn't re-read the flag previews: fetch failed");
    });

    it("keeps a ready view, and records what it showed, when discovery answers badly", async () => {
      const page = await readyPage();
      page.discoveryAnswers(500);

      expect(await previewedFlags()).toEqual([PRO]);

      expect(flagsView().status).toBe("ready");
      expect(warn).toHaveBeenCalledWith("[loupe] Couldn't re-read the flag previews: /.well-known/vercel/flags answered 500.");
    });

    it("says so once, however many exports fail", async () => {
      const page = await readyPage();
      page.refuse("connection reset");

      await previewedFlags();
      await previewedFlags();

      expect(warn).toHaveBeenCalledTimes(1);
    });

    it("reads again at the next export, so a recovered server's cookie is what gets recorded", async () => {
      const page = await readyPage();
      page.refuse("link down");
      await previewedFlags();

      page.repair();
      await writePreview(page.request, { plan: "starter" }, []);

      expect(await previewedFlags()).toEqual([{ key: "plan", value: "starter", label: "Starter", description: "Pricing plan" }]);
    });

    it("drops a failure from a source it has since left, without a warning", async () => {
      let refuse: (error: Error) => void = () => {};
      setFlagSource({ read: () => new Promise((_, reject) => (refuse = reject)), write: async () => ({ ok: true, overrides: {} }) });
      const stale = loadFlags();

      setFlagSource(memorySource(memoryRequest(declared)));
      await loadFlags();
      refuse(new Error("the old page's server is gone"));
      await stale;

      expect(flagsView().status).toBe("ready");
      expect(warn).not.toHaveBeenCalled();
    });

    it("still says why when the first read fails, since there is no view to keep", async () => {
      setFlagSource({ read: () => Promise.reject(new Error("first load refused")), write: async () => ({ ok: true, overrides: {} }) });

      expect(await previewedFlags()).toEqual([]);

      expect(flagsView()).toEqual({ status: "unavailable", reason: "first load refused" });
      expect(warn).not.toHaveBeenCalled();
    });
  });
});

describe("the Feature flags card", () => {
  let container: HTMLDivElement;
  let root: Root;
  let request: MemoryRequest;

  /** A fresh page load, with this cookie and this discovery endpoint. */
  const pageLoad = (seed: MemorySeed = {}) => {
    request = memoryRequest({ ...declared, ...seed });
    setFlagSource(memorySource(request));
  };

  beforeEach(() => {
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
   * Waits until the card is loaded and no write is in flight. A write marks every flag's
   * options busy (they stay enabled, so focus stays on them), and a click made before it
   * ends is dropped: that is how a fixed number of ticks failed on CI.
   */
  const idle = () =>
    until(() => {
      const groups = within(container).queryAllByRole("radiogroup");
      if (groups.length === 0 || groups.some((group) => group.getAttribute("aria-busy") === "true")) throw new Error("card busy");
    });
  /** A flag's option: a radio in the flag's group, none checked while the app decides. */
  const pill = (flag: string, text: string) => within(within(container).getByRole("radiogroup", { name: flag })).getByRole("radio", { name: text });
  const button = (text: string) => [...container.querySelectorAll("button")].find((b) => b.textContent === text) as HTMLButtonElement;

  it("previews a flag, records it for the Proposal, and clearing gives the app its value back", async () => {
    pageLoad();
    act(() => root.render(<FlagsCard />));
    await idle();

    expect(container.querySelector('[data-flag="showBetaFeature"]')?.textContent).toContain("App decides");
    // Declared without options: offered as on and off, neither checked while the app decides.
    expect(pill("showBetaFeature", "On").getAttribute("aria-checked")).toBe("false");
    expect(pill("showBetaFeature", "Off").getAttribute("aria-checked")).toBe("false");
    expect(await previewedFlags()).toEqual([]);

    act(() => pill("showBetaFeature", "On").click());
    await idle();
    await expect(overridesIn(request)).resolves.toEqual({ showBetaFeature: true });
    expect(pill("showBetaFeature", "On").getAttribute("aria-checked")).toBe("true");
    expect(container.querySelector('[data-flag="showBetaFeature"]')?.textContent).toMatch(/Previewing on/i);

    act(() => pill("plan", "Pro").click());
    await idle();
    expect(await previewedFlags()).toEqual([
      { key: "plan", value: "pro", label: "Pro", description: "Pricing plan" },
      { key: "showBetaFeature", value: true },
    ]);

    act(() => (container.querySelector('[data-flag="plan"] .reset') as HTMLButtonElement).click());
    await idle();
    expect(await previewedFlags()).toEqual([{ key: "showBetaFeature", value: true }]);
    expect(container.querySelector('[data-flag="plan"]')?.textContent).toContain("App decides");

    act(() => button("Clear flag previews").click());
    await idle();
    expect(request.jar.has(COOKIE)).toBe(false);
    expect(await previewedFlags()).toEqual([]);
    expect(button("Clear flag previews").disabled).toBe(true);
  });

  it("reads a preview back after a reload, and lists an override the app doesn't declare", async () => {
    pageLoad({ overrides: { showBetaFeature: true, retired: 1 } });
    act(() => root.render(<FlagsCard />));
    await idle();

    expect(pill("showBetaFeature", "On").getAttribute("aria-checked")).toBe("true");
    expect(container.querySelector('[data-flag="retired"]')?.textContent).toContain("Not declared");
    expect((await previewedFlags()).map((flag) => flag.key)).toEqual(["retired", "showBetaFeature"]);
  });

  it("gives the Proposal the cookie's previews without the card ever mounting", async () => {
    pageLoad({ overrides: { plan: "pro" } });
    expect(await previewedFlags()).toEqual([{ key: "plan", value: "pro", label: "Pro", description: "Pricing plan" }]);
  });

  it("says a preview lasts 8 hours in a cookie every app on localhost shares (PER-182)", async () => {
    pageLoad();
    act(() => root.render(<FlagsCard />));
    await idle();
    expect(container.querySelector(".card.flags")?.textContent).toContain(
      "A preview lasts 8 hours, in a cookie every app on localhost shares. Clear it before switching projects.",
    );
  });

  it("stays ready when a read fails during an export, since the page still has the preview (PER-226)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    pageLoad({ overrides: { plan: "pro" } });
    act(() => root.render(<FlagsCard />));
    await idle();

    request.fetch = async () => new Response("boom", { status: 502 });
    await act(async () => void (await previewedFlags()));

    expect(container.textContent).not.toContain("Flag previews are off");
    expect(pill("plan", "Pro").getAttribute("aria-checked")).toBe("true");
  });

  it("says a refused write through the announcer, once each time, and shows it on the card", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    // Reads work; every write is refused, as a server gone away refuses it.
    const loaded = memorySource(memoryRequest(declared));
    setFlagSource({ ...loaded, write: () => Promise.reject(new Error("The flags endpoint went away.")) });
    const screen = renderInSurface(<FlagsCard />);
    const heard = listen(screen.shadow);
    const radio = (flag: string, text: string) => within(screen.getByRole("radiogroup", { name: flag })).getByRole("radio", { name: text });
    await until(() => radio("plan", "Pro"));
    act(() => radio("plan", "Pro").click());
    await until(() => expect(heard.assertive).toHaveLength(1));
    const said = heard.assertive[0] as string;
    expect(said).toContain("The flags endpoint went away.");
    // Shown on the card, apart from the announcer's own region.
    expect(screen.getByText(said, { ignore: "[role=alert], script, style" })).toBeDefined();
    act(() => radio("plan", "Starter").click());
    await until(() => expect(heard.assertive).toEqual([said, said]));
    expect(heard.polite).toEqual([]);
    cleanup();
  });

  it("explains why previews are unavailable", async () => {
    pageLoad({ secret: "" });
    act(() => root.render(<FlagsCard />));
    await until(() => expect(container.textContent).toContain("FLAGS_SECRET isn't set"));
    // Folded to one line, with the chevron every fold in the panel carries (layout review 2026-11-20).
    const fold = within(container).getByRole("button", { name: "Flag previews are off · why", expanded: false });
    expect(fold.querySelector("[data-fold-chevron]")).not.toBeNull();
  });
});
