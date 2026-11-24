// @vitest-environment jsdom
// CommandLine, by role, inside a real shadow root (ADR 0003): the command as written, its
// `$` hidden, and Copy, which says whether it worked; a refusal stays under the command
// and is said once by the announcer.

import { userEvent } from "@testing-library/user-event";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COMMAND_WORDS } from "../../panel-view/index.js";
import { axeViolations, cleanup, renderInSurface } from "../../surface/render.fixture.js";
import { listen } from "../../ui/announcer/announcer.fixture.js";
import { COMMAND, SECRET_LINE } from "../samples.js";
import { expectPatternCss } from "../css.fixture.js";
import { CommandLine } from "./command.js";
import CSS from "./command.css?inline";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("CommandLine", () => {
  it("shows the command as written after a hidden prompt, and copies it", async () => {
    const user = userEvent.setup({ document });
    const onCopy = vi.fn(() => Promise.resolve());
    const screen = renderInSurface(<CommandLine text={COMMAND} words={COMMAND_WORDS} onCopy={onCopy} />);
    expect(screen.getByText(COMMAND, { normalizer: (text) => text }).textContent).toBe(COMMAND);
    expect(screen.getByText("$").getAttribute("aria-hidden")).toBe("true");
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(onCopy).toHaveBeenCalledWith(COMMAND);
    expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();
  });

  it("copies what it was told to, without a prompt, and steps back from Copied", async () => {
    vi.useFakeTimers();
    const onCopy = vi.fn(() => Promise.resolve());
    const screen = renderInSurface(<CommandLine text={SECRET_LINE.text} copy={SECRET_LINE.copy} prompt={false} words={COMMAND_WORDS} onCopy={onCopy} />);
    expect(screen.queryByText("$")).toBeNull();
    await act(async () => screen.getByRole("button", { name: "Copy" }).click());
    expect(onCopy).toHaveBeenCalledWith(SECRET_LINE.copy);
    expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();
    await act(async () => vi.advanceTimersByTime(2000));
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
  });

  it("says what to do when the clipboard refuses it, under the command and once by the announcer, and keeps saying it", async () => {
    const user = userEvent.setup({ document });
    const screen = renderInSurface(
      <CommandLine
        text={COMMAND}
        words={COMMAND_WORDS}
        onCopy={() => {
          // A clipboard that isn't there throws rather than rejects.
          throw new TypeError("navigator.clipboard is undefined");
        }}
      />,
    );
    const heard = listen(screen.shadow);
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(screen.getByRole("button", { name: "Copy failed" })).toBeTruthy();
    expect(screen.getByText(COMMAND_WORDS.refused).tagName).toBe("P");
    await act(async () => await new Promise((resolve) => setTimeout(resolve, 200)));
    expect(heard.assertive).toEqual([COMMAND_WORDS.refused]);
  });

  it("has no axe violations", async () => {
    const screen = renderInSurface(<CommandLine text={COMMAND} words={COMMAND_WORDS} onCopy={() => Promise.resolve()} />);
    expect(await axeViolations(screen.host)).toEqual([]);
  });
});

describe("CommandLine's CSS", () => {
  it("sits in the patterns layer, written against attributes, its values the tokens'", () => {
    expectPatternCss(CSS);
    expect(CSS).toMatch(/\[data-command-text\] \{[^}]*white-space: pre-wrap/);
  });
});
