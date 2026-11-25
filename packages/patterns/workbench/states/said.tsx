// What a pattern's callbacks would do, said under its frames rather than done: the workbench
// makes no write. `said` names the last one; `<Said />` shows it.

import { useState } from "react";

/** The last callback a page's patterns made, and a line that says it. */
export function useSaid(): { say: (what: string) => void; Said: () => React.JSX.Element } {
  const [last, setLast] = useState("—");
  return { say: setLast, Said: () => <p className="wb-note">Last: {last}</p> };
}
