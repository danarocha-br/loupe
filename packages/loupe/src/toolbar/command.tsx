// A command for the reader to run, with Copy (PER-140). The Toolbar names commands
// and never runs them (PER-100 §5).

import { useEffect, useState } from "react";
import { CopyIcon } from "./ui/icon/icon.js";
import { Button, useAnnounce } from "./ui/index.js";

/** Said under the command when the clipboard refuses it: what failed, and what to do instead. */
export const COPY_REFUSED = "Couldn’t reach the clipboard. Select the command and copy it.";

/** The command in mono, after a `$`, with a Copy button that says whether it worked. */
export function Command({ text, copy = text, prompt = true }: { text: string; copy?: string; prompt?: boolean }) {
  const [copied, setCopied] = useState<boolean | null>(null);
  const announce = useAnnounce();
  // "Copied" steps back after a moment; a refusal stays until the next try, since it says what to do.
  useEffect(() => {
    if (copied !== true) return;
    const timer = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <div className="command-block">
      <div className="command">
        <span>
          {prompt && <span aria-hidden="true">$ </span>}
          <span className="mono verbatim">{text}</span>
        </span>
        <Button
          className="copy"
          onClick={() =>
            // Inside the promise: on an insecure origin `navigator.clipboard` is undefined and throws.
            Promise.resolve()
              .then(() => navigator.clipboard.writeText(copy))
              .then(
                () => setCopied(true),
                () => {
                  setCopied(false);
                  // Each refusal, a second one too: what to do instead.
                  announce(COPY_REFUSED, { politeness: "assertive" });
                },
              )
          }
        >
          <CopyIcon size={12} />
          {copied === null ? "Copy" : copied ? "Copied" : "Copy failed"}
        </Button>
      </div>
      {/* For the eye: the announcer says it as it lands. */}
      <p className="muted command-refused">{copied === false ? COPY_REFUSED : ""}</p>
    </div>
  );
}
