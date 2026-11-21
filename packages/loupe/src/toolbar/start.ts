// What the Toolbar starts when it mounts (PER-218). That's the Proposal tracker, the
// change numbering (`numbers.ts`), and the Toolbar's methods on `window.__loupe`, the
// acceptance surface, next to the runtime's (`debug.ts`):
//
//   __loupe.proposal(options?)      the Proposal JSON (`proposal.ts`)
//   __loupe.proposalText(options?)  its Copy Proposal text, not copied (`text.ts`)
//
// Starting again changes nothing: the tracker is one per page, and the methods are
// the same module functions. `resetLoupe()` takes both away, and the next mount
// starts them again. The methods are assigned each time, not kept, so the latest
// code answers once it has run.

import { debugOf } from "../runtime/debug.js";
import { pageNumbering } from "./numbers.js";
import { collectProposal, collectProposalText, startTracking } from "./proposal.js";

export function startToolbar(): void {
  // From the moment the Toolbar loads, not from the first copy: a record set on
  // another route, or an Instance that has since unmounted, is only known if seen.
  startTracking();
  // So changes number in the order they are made, even several made at once.
  pageNumbering();
  Object.assign(debugOf(), {
    proposal: collectProposal,
    proposalText: collectProposalText,
  });
}
