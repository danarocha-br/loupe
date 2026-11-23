// The test host (surface/): renders any primitive inside a real shadow root, under the
// toolbar's stylesheet, and hands back Testing Library's queries bound to it.

import { type BoundFunctions, type queries, within } from "@testing-library/dom";
import axe from "axe-core";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Surface, SURFACE_ATTRIBUTE, type Theme } from "./index.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export type Rendered = BoundFunctions<typeof queries> & {
  host: HTMLElement;
  shadow: ShadowRoot;
  rerender(ui: ReactNode): void;
  unmount(): void;
};

const mounted = new Set<() => void>();

/** Draws `ui` in a surface on the body; `cleanup()` (or `unmount()`) takes it away. */
export function renderInSurface(ui: ReactNode, { theme = "light" }: { theme?: Theme } = {}): Rendered {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const draw = (next: ReactNode) => act(() => root.render(<Surface theme={theme}>{next}</Surface>));
  draw(ui);
  const host = container.querySelector<HTMLElement>(`[${SURFACE_ATTRIBUTE}]`);
  if (!host?.shadowRoot) throw new Error("The surface has no shadow root.");
  const shadow = host.shadowRoot;
  // Testing Library queries any node with `querySelectorAll`: the shadow root is one.
  const queries = within(shadow as unknown as HTMLElement);
  const unmount = () => {
    act(() => root.unmount());
    container.remove();
    mounted.delete(unmount);
  };
  mounted.add(unmount);
  return { ...queries, host, shadow, rerender: draw, unmount };
}

export function cleanup(): void {
  for (const unmount of [...mounted]) unmount();
}

/**
 * axe's violations for what a surface draws, read inside its shadow root. Colour
 * contrast needs layout, which jsdom doesn't do: the tokens' contrast is
 * colors.test.ts's, read from the module.
 */
export async function axeViolations(host: HTMLElement): Promise<axe.Result[]> {
  const results = await axe.run(host, { rules: { "color-contrast": { enabled: false } } });
  return results.violations;
}
