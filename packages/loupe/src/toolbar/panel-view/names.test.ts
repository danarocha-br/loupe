// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screenName } from "./names.js";

const html = (markup: string): Element[] => {
  const holder = document.createElement("div");
  holder.innerHTML = markup;
  document.body.append(holder);
  return [...holder.children];
};

describe("screenName", () => {
  it("prefers the accessible name to the visible text", () => {
    expect(screenName(html(`<button aria-label="Actions for Ana Souza">⋯</button>`))).toBe("Actions for Ana Souza");
  });

  it("reads aria-labelledby, then an image's alt, then a field's label or placeholder", () => {
    expect(screenName(html(`<span id="t">Members</span><div aria-labelledby="t"></div>`).slice(1))).toBe("Members");
    expect(screenName(html(`<img alt="Ana's avatar">`))).toBe("Ana's avatar");
    expect(screenName(html(`<label for="e">Email</label><input id="e">`).slice(1))).toBe("Email");
    expect(screenName(html(`<input placeholder="Search members">`))).toBe("Search members");
  });

  it("puts visible text on one line and cuts a long one", () => {
    expect(screenName(html(`<div>Ana   Souza\n ana@example.com</div>`))).toBe("Ana Souza ana@example.com");
    const long = screenName(html(`<p>${"word ".repeat(30)}</p>`)) ?? "";
    expect(long.length).toBeLessThanOrEqual(48);
    expect(long.endsWith("…")).toBe(true);
  });

  it("takes an accessible name from any node before visible text, and spaces text apart", () => {
    // A menu: its open popup first, then its trigger.
    expect(screenName(html(`<div><p>Change role</p><p>Remove</p></div><button aria-label="Actions for Ana Souza">⋯</button>`))).toBe(
      "Actions for Ana Souza",
    );
    expect(screenName(html(`<div><p>Change role</p><p>Remove</p></div>`))).toBe("Change role Remove");
  });

  it("tries the next node when one shows nothing, and gives null when none does", () => {
    expect(screenName(html(`<div></div><span>Invite</span>`))).toBe("Invite");
    expect(screenName(html(`<div></div>`))).toBeNull();
  });
});
