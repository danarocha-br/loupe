// A command for the reader to run, with Copy (PER-140). The Toolbar names commands
// and never runs them (PER-100 §5).

import { useEffect, useState } from "react";
import { CopyIcon } from "./icons.js";

/** The command in mono, after a `$`, with a Copy button that says whether it worked. */
export function Command({ text, copy = text, prompt = true }: { text: string; copy?: string; prompt?: boolean }) {
  const [copied, setCopied] = useState<boolean | null>(null);
  useEffect(() => {
    if (copied === null) return;
    const timer = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <div className="command">
      <span>
        {prompt && <span aria-hidden="true">$ </span>}
        <span className="mono">{text}</span>
      </span>
      <button
        type="button"
        className="btn"
        onClick={() =>
          navigator.clipboard.writeText(copy).then(
            () => setCopied(true),
            () => setCopied(false),
          )
        }
      >
        <CopyIcon size={12} />
        {copied === null ? "Copy" : copied ? "Copied" : "Copy failed"}
      </button>
    </div>
  );
}

