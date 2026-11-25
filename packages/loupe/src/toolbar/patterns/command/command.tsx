// CommandLine (ADR 0003, DESIGN.md "Notices and status"): a command for the reader to run,
// in mono after a `$`, with Copy (PER-140). The Toolbar names commands and never runs them
// (PER-100 §5). Copy says whether it worked; a refusal stays under the command, and is said
// once by the announcer, since it says what to do instead.
//
// It draws the command and `CommandWords` and builds none. The copy is the view's: `onCopy`
// writes to the clipboard, and its promise says whether it could. See command.md.

import { useEffect, useState } from "react";
import type { CommandWords } from "../../panel-view/index.js";
import { Button, CopyIcon, useAnnounce } from "@loupe/ui";

export type CommandLineProps = {
  /** The command as shown, its spaces kept as written. */
  text: string;
  /** What Copy puts on the clipboard, when it differs from what is shown. */
  copy?: string;
  /** The `$` before it: off for a line that isn't a shell command. */
  prompt?: boolean;
  words: CommandWords;
  /** Put `text` on the clipboard; rejects when the clipboard refuses it. */
  onCopy(text: string): Promise<void>;
};

/** How long "Copied" stays before Copy comes back. */
const COPIED_MS = 2000;

export function CommandLine({ text, copy = text, prompt = true, words, onCopy }: CommandLineProps) {
  const [copied, setCopied] = useState<boolean | null>(null);
  const announce = useAnnounce();
  // "Copied" steps back after a moment; a refusal stays until the next try, since it says what to do.
  useEffect(() => {
    if (copied !== true) return;
    const timer = setTimeout(() => setCopied(null), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <div data-command-block="">
      <div data-command="">
        <span>
          {prompt && <span aria-hidden="true">{words.prompt}</span>}
          <span data-command-text="">{text}</span>
        </span>
        <Button
          data-command-copy=""
          onClick={() =>
            // Inside the promise: a clipboard that isn't there throws rather than rejects.
            Promise.resolve()
              .then(() => onCopy(copy))
              .then(
                () => setCopied(true),
                () => {
                  setCopied(false);
                  // Each refusal, a second one too: what to do instead.
                  announce(words.refused, { politeness: "assertive" });
                },
              )
          }
        >
          <CopyIcon size={12} />
          {copied === null ? words.copy : copied ? words.copied : words.failed}
        </Button>
      </div>
      {/* For the eye: the announcer says it as it lands. */}
      <p data-command-refused="">{copied === false ? words.refused : ""}</p>
    </div>
  );
}
