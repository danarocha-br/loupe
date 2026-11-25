// @vitest-environment jsdom
// The Sheet's workbench page, by keyboard: Hide makes the sheet inert while it closes, so
// focus moves to Open, which stands in for the pill; Open gives it back to the sheet's Hide.

import { cleanup, renderInSurface } from "@loupe/ui/testing";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { STYLESHEET } from "../../src/stylesheet.js";
import { SheetStates } from "./sheet.js";

afterEach(cleanup);

describe("the Sheet's workbench page", () => {
  it("moves focus to Open as the sheet closes, and back to Hide as it opens", async () => {
    const user = userEvent.setup();
    const screen = renderInSurface(<SheetStates />, { stylesheet: STYLESHEET });
    const region = screen.getByRole("region", { name: "Loupe" });
    const hide = screen.getByRole("button", { name: "Hide panel" });
    hide.focus();
    await user.keyboard("{Enter}");
    const open = screen.getByRole("button", { name: "Open" });
    expect(region.hasAttribute("inert")).toBe(true);
    expect(screen.shadow.activeElement).toBe(open);
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("button", { name: "Open" })).toBeNull();
    expect(region.hasAttribute("inert")).toBe(false);
    expect(screen.shadow.activeElement).toBe(screen.getByRole("button", { name: "Hide panel" }));
  });
});
