// @vitest-environment jsdom
// Announcer, by role, inside a real shadow root (ADR 0003, ADR 0008): one polite and
// one assertive region, there and empty before any message; a message emptied then
// written, so the same one twice is read twice; emptied again a while later; and
// nothing announced for what a view shows as it mounts.

import { act, useLayoutEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axeViolations, cleanup, renderInSurface } from "../surface/render.fixture.js";
import { type Announce, CLEAR_AFTER_MS, useAnnounce, useAnnounceChange, WRITE_AFTER_MS } from "./announcer.js";
import { listen } from "./announcer.fixture.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Hands the test the surface's `announce`. */
function Speaker({ into }: { into: { announce?: Announce } }) {
  into.announce = useAnnounce();
  return null;
}

/** Shows a count and announces it as it changes; `again` makes the same offer a second time. */
function Counter({ initial = 0 }: { initial?: number }) {
  const [count, setCount] = useState(initial);
  const [offer, setOffer] = useState({});
  useAnnounceChange(count === 0 ? "" : `${count} changes`);
  useAnnounceChange("Reset 1 Override", { key: offer });
  return (
    <>
      <p>{count} changes</p>
      <button type="button" onClick={() => setCount(count + 1)}>
        Add
      </button>
      <button type="button" onClick={() => setCount(0)}>
        Clear
      </button>
      <button type="button" onClick={() => setOffer({})}>
        Offer again
      </button>
    </>
  );
}

const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe("Announcer", () => {
  beforeEach(() => vi.useFakeTimers());

  it("is one polite status and one assertive alert, in the surface and empty before the first message", () => {
    const screen = renderInSurface(<p>Panel</p>);
    const status = screen.getByRole("status");
    const alert = screen.getByRole("alert");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(alert.getAttribute("aria-live")).toBe("assertive");
    expect(status.getAttribute("aria-atomic")).toBe("true");
    expect(alert.getAttribute("aria-atomic")).toBe("true");
    expect(status.textContent).toBe("");
    expect(alert.textContent).toBe("");
  });

  it("writes a message after emptying its region, by politeness, and empties it again a while later", () => {
    const into: { announce?: Announce } = {};
    const screen = renderInSurface(<Speaker into={into} />);
    act(() => into.announce?.("Copied", {}));
    expect(screen.getByRole("status").textContent).toBe("");
    wait(WRITE_AFTER_MS);
    expect(screen.getByRole("status").textContent).toBe("Copied");
    expect(screen.getByRole("alert").textContent).toBe("");

    act(() => into.announce?.("  Couldn’t copy.\n Try again. ", { politeness: "assertive" }));
    wait(WRITE_AFTER_MS);
    expect(screen.getByRole("alert").textContent).toBe("Couldn’t copy. Try again.");
    expect(screen.getByRole("status").textContent).toBe("Copied");

    wait(CLEAR_AFTER_MS);
    expect(screen.getByRole("status").textContent).toBe("");
    expect(screen.getByRole("alert").textContent).toBe("");
  });

  it("says what a child announces as it first mounts, before the regions after it are in the page", () => {
    // A boundary's componentDidCatch, or a layout effect, runs before the regions' refs attach.
    function Failing() {
      const announce = useAnnounce();
      useLayoutEffect(() => announce("Loupe couldn’t open.", { politeness: "assertive" }), [announce]);
      return null;
    }
    const screen = renderInSurface(<Failing />);
    wait(WRITE_AFTER_MS);
    expect(screen.getByRole("alert").textContent).toBe("Loupe couldn’t open.");
  });

  it("reads the same message twice when it is announced twice", () => {
    const into: { announce?: Announce } = {};
    const screen = renderInSurface(<Speaker into={into} />);
    const heard = listen(screen.shadow);
    act(() => into.announce?.("Copied “Calmer rows”"));
    wait(WRITE_AFTER_MS);
    act(() => into.announce?.("Copied “Calmer rows”"));
    wait(WRITE_AFTER_MS);
    // Emptied in between: two additions, which a screen reader reads as two messages.
    return Promise.resolve().then(() => expect(heard.polite).toEqual(["Copied “Calmer rows”", "Copied “Calmer rows”"]));
  });

  it("lets a newer message replace one not yet written, and says nothing for empty text", async () => {
    const into: { announce?: Announce } = {};
    const screen = renderInSurface(<Speaker into={into} />);
    const heard = listen(screen.shadow);
    act(() => into.announce?.("1 change"));
    act(() => into.announce?.("2 changes"));
    act(() => into.announce?.("   "));
    wait(WRITE_AFTER_MS);
    await Promise.resolve();
    expect(heard.polite).toEqual(["2 changes"]);
  });

  it("announces shown text as it changes, never as it mounts, and an offer each time it is made", async () => {
    const screen = renderInSurface(<Counter initial={3} />);
    const heard = listen(screen.shadow);
    wait(WRITE_AFTER_MS);
    await Promise.resolve();
    expect(heard.polite).toEqual([]);
    expect(heard.assertive).toEqual([]);

    act(() => screen.getByRole("button", { name: "Add" }).click());
    wait(WRITE_AFTER_MS);
    act(() => screen.getByRole("button", { name: "Clear" }).click());
    wait(WRITE_AFTER_MS);
    act(() => screen.getByRole("button", { name: "Offer again" }).click());
    wait(WRITE_AFTER_MS);
    act(() => screen.getByRole("button", { name: "Offer again" }).click());
    wait(WRITE_AFTER_MS);
    await Promise.resolve();
    act(() => screen.getByRole("button", { name: "Add" }).click());
    wait(WRITE_AFTER_MS);
    act(() => screen.getByRole("button", { name: "Add" }).click());
    wait(WRITE_AFTER_MS);
    await Promise.resolve();
    // Cleared to nothing says nothing; the same offer made twice is said twice.
    expect(heard.polite).toEqual(["4 changes", "Reset 1 Override", "Reset 1 Override", "1 changes", "2 changes"]);
    expect(heard.assertive).toEqual([]);
  });

  it("says nothing, and throws nothing, drawn outside a surface", () => {
    const into: { announce?: Announce } = {};
    // A bare React root: no Announcer above it.
    const container = document.createElement("div");
    document.body.append(container);
    return import("react-dom/client").then(({ createRoot }) => {
      const root = createRoot(container);
      act(() => root.render(<Speaker into={into} />));
      expect(() => into.announce?.("Copied")).not.toThrow();
      act(() => root.unmount());
      container.remove();
    });
  });

  it("puts nothing in the host's document outside the surface", () => {
    const into: { announce?: Announce } = {};
    const screen = renderInSurface(<Speaker into={into} />);
    act(() => into.announce?.("Copied"));
    wait(WRITE_AFTER_MS);
    expect(document.body.querySelectorAll("[role=status], [role=alert], [aria-live]")).toHaveLength(0);
    expect(screen.getByRole("status").textContent).toBe("Copied");
  });

  it("passes axe with a message in each region", async () => {
    vi.useRealTimers();
    const into: { announce?: Announce } = {};
    const screen = renderInSurface(<Speaker into={into} />);
    act(() => {
      into.announce?.("Copied");
      into.announce?.("Couldn’t copy", { politeness: "assertive" });
    });
    await act(() => new Promise((resolve) => setTimeout(resolve, WRITE_AFTER_MS + 10)));
    expect(screen.getByRole("alert").textContent).toBe("Couldn’t copy");
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});
