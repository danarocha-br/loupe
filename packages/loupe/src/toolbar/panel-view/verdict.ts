// Supported or Inspect only (PER-214): one rule for an Instance, the list's
// component rows and the Inspector's badge alike.
//
// An Instance is Supported when it is rendered in the browser, has an Adapter, has
// Overrides on, and has at least one Editable prop. Otherwise it is Inspect only,
// for the first of these that holds: not mounted, not generated yet, on the server,
// Overrides off, no Adapter, no Editable prop. A component is Supported when one of
// its mounted Instances is; otherwise it takes the reason of the Instance closest
// to Supported, the latest in that order.

import type { InstanceRow } from "../../runtime/debug.js";
import type { Inspection } from "../../runtime/inspect.js";
import type { ComponentGroup, Page } from "./page.js";
import type { Reads } from "./reads.js";
import type { InspectOnlyReason, Verdict } from "./types.js";
import { inspectOnlyTag, REASON_TEXT, SUPPORTED } from "./words.js";

/** The order reasons are checked in: a later one is closer to Supported. */
const ORDER: readonly InspectOnlyReason[] = ["not-mounted", "not-generated", "server", "overrides-off", "no-adapter", "no-editable"];

const supported = (): Verdict => ({ supported: true, status: SUPPORTED });

const inspectOnly = (reason: InspectOnlyReason): Verdict => ({
  supported: false,
  reason,
  reasonText: REASON_TEXT[reason],
  status: inspectOnlyTag(reason),
});

type Judged = Pick<Page, "status" | "notGenerated">;

/**
 * Why a mounted Instance is inspect only, judged from its list row, or null while
 * it may be Supported: only an inspection can tell whether it has an Editable prop.
 */
function rowReason(row: Pick<InstanceRow, "component" | "rendered" | "adapted">, page: Judged): InspectOnlyReason | null {
  if (page.notGenerated.has(row.component)) return "not-generated";
  if (row.rendered === "server") return "server";
  if (!page.status.overrides) return "overrides-off";
  if (!row.adapted) return "no-adapter";
  return null;
}

/** An inspected Instance's verdict, for the Inspector's badge. */
export function instanceVerdict(inspection: Inspection, adapted: boolean, page: Judged): Verdict {
  const reason = rowReason({ component: inspection.component, rendered: inspection.rendered, adapted }, page);
  if (reason) return inspectOnly(reason);
  return inspection.coverage.editable > 0 ? supported() : inspectOnly("no-editable");
}

/**
 * A component's verdict, for its row in the list. Only an Instance that may be
 * Supported is inspected, and the first Supported one ends the search: each
 * inspection walks React's tree.
 */
export function componentVerdict(group: ComponentGroup, reads: Reads, page: Judged): Verdict {
  let closest: InspectOnlyReason = "not-mounted";
  for (const row of group.instances) {
    const reason = rowReason(row, page) ?? (reads.inspect(row.id)?.coverage.editable ? null : "no-editable");
    if (reason === null) return supported();
    if (ORDER.indexOf(reason) > ORDER.indexOf(closest)) closest = reason;
  }
  return inspectOnly(closest);
}
