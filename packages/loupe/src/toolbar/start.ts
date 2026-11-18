// What the Toolbar starts when it mounts (PER-218). That's the Proposal tracker,
// and the Toolbar's methods on `window.__loupe`, the acceptance surface, next to
// the runtime's (`debug.ts`):
//
//   __loupe.proposal(options?)          the Proposal JSON (`proposal.ts`)
//   __loupe.proposalMarkdown(options?)  its Copy as Markdown text
//   __loupe.report(options)             the HTML report, not downloaded (`export.ts`)
//   __loupe.exportProposal(options)     the report, downloaded as Export does
//   __loupe.capture()                   Capture screen: a Snapshot of the screen in view (`snapshots.ts`)
//   __loupe.retake(id)                  takes Snapshot `id` again, in its place
//   __loupe.snapshots()                 every Snapshot this page load, each as it reads now
//   __loupe.removeSnapshot(id)          drops a Snapshot
//
// Starting again changes nothing: the tracker is one per page, and the methods are
// the same functions. `resetLoupe()` takes both away, and the next mount starts
// them again. The methods are assigned each time, not kept, so the latest code
// answers once it has run.

import { proposalMarkdown } from "../proposal/markdown.js";
import { debugOf } from "../runtime/debug.js";
import { buildExport, exportProposal } from "./export.js";
import { collectProposal, type ProposalOptions, startTracking } from "./proposal.js";
import { captureScreen, removeSnapshot, retakeSnapshot, snapshots } from "./snapshots.js";

export function startToolbar(): void {
  // From the moment the Toolbar loads, not from the first export: a record set on
  // another route, or an Instance that has since unmounted, is only known if seen.
  startTracking();
  Object.assign(debugOf(), {
    proposal: collectProposal,
    proposalMarkdown: (options?: ProposalOptions) => collectProposal(options).then(proposalMarkdown),
    report: buildExport,
    exportProposal,
    // It once took `{ replace }` and `{ auto }`. A call that still passes them says
    // so, rather than quietly taking a new Snapshot.
    capture: (options?: unknown) =>
      options === undefined
        ? captureScreen()
        : Promise.reject(
            new Error(
              "[loupe] __loupe.capture() takes no options. Retake a Snapshot with __loupe.retake(id); " +
                "__loupe.proposal({ capture: true }) takes the export's own.",
            ),
          ),
    retake: retakeSnapshot,
    snapshots,
    removeSnapshot,
  });
}
