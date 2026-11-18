// How the Proposal names a call site and a change in words. A leaf: the builder, the
// Markdown summary, the HTML report and the export dialog all read from it, and it
// reads nothing but the Proposal's own types.

import type { ProposalCallSite, ProposalChange, ProposalProp } from "./types.js";

/** "1st", "2nd", "3rd", "11th". */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}

/** "3rd of 4", or "3rd" when the page didn't say how many uses there are. */
export function siteCount(site: Pick<ProposalCallSite, "nth" | "total">): string {
  return site.total === null ? ordinal(site.nth) : `${ordinal(site.nth)} of ${site.total}`;
}

/** What a caption reads of a change. */
type Captioned = Pick<ProposalChange, "scope" | "component" | "callSites"> & { props: readonly Pick<ProposalProp, "name">[] };

/** "variant on 1st of 4 <Button> in MemberRowMenu", plain text for a caption. */
export function changeInWords(change: Captioned): string {
  const props = change.props.map((prop) => (prop.name === "children" ? "text" : prop.name)).join(", ");
  if (change.scope === "page") return `${props} on every <${change.component}> on the page`;
  const site = change.callSites[0];
  if (!site) return `${props} on <${change.component}>`;
  const where = site.enclosing ? ` in ${site.enclosing}` : "";
  return `${props} on ${siteCount(site)} <${site.component}>${where}${change.scope === "call-site" ? ", every Instance" : ""}`;
}
