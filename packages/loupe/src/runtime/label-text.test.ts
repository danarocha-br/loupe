// @vitest-environment jsdom
// PER-137 (decided in PER-113): label text is one line, and it is changed per
// Instance or per call site, never for the whole page.
import { act, createElement as h, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { encodeCallSiteWrites } from "../writes.js";
import { createAdapter } from "./adapter.js";
import { createDebug, type LoupeDebug } from "./debug.js";
import { singleLine, textScopeRefusal } from "./label-text.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const Button = createAdapter("Button", (props: Record<string, unknown>) => h("button", props));
const anchor = "invite-dialog.tsx › InviteDialog › Button[1]";

let container: HTMLDivElement;
let root: Root;
let loupe: LoupeDebug;

beforeEach(() => {
  delete (globalThis as { __loupeRegistry?: unknown }).__loupeRegistry;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  loupe = createDebug();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (element: ReactElement) => act(() => root.render(element));
const cancel = () =>
  render(
    h(
      Button,
      { "data-ds-anchor": anchor, "data-ds-writes": encodeCallSiteWrites({ attributes: [], spreads: false, children: "text" }) },
      "Cancelar",
    ),
  );

describe("label text", () => {
  it("is refused at page scope only, and only for children", () => {
    expect(textScopeRefusal("page", "children")).toBe("Change it per call site.");
    expect(textScopeRefusal("group", "children")).toBeNull();
    expect(textScopeRefusal("instance", "children")).toBeNull();
    expect(textScopeRefusal("page", "variant")).toBeNull();
  });

  it("refuses a page-scope children Override through __loupe, and sets nothing", () => {
    cancel();
    expect(() => loupe.set(anchor, "children", "Voltar", "page")).toThrow("children is label text: Change it per call site.");
    expect(loupe.records()).toEqual([]);
    expect(container.textContent).toBe("Cancelar");
    for (const scope of ["instance", "group"] as const) {
      act(() => {
        loupe.set(anchor, "children", `Voltar ${scope}`, scope);
      });
    }
    expect(container.textContent).toBe("Voltar instance");
  });

  it("renders an empty Override as no text", () => {
    cancel();
    act(() => {
      loupe.set(anchor, "children", "");
    });
    expect(container.textContent).toBe("");
    expect(loupe.props(anchor).overrides).toEqual({ children: "" });
  });

  it("keeps to one line: a line break becomes a space", () => {
    expect(singleLine("Voltar\nao início")).toBe("Voltar ao início");
    expect(singleLine("a\r\nb\rc")).toBe("a b c");
    expect(singleLine("")).toBe("");
  });
});
