import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { callSiteId } from "../call-site.js";
import { loaderContext } from "../loader-runtime.js";
import { howToApply, type Proposal, type ProposalChange } from "../proposal/types.js";
import { applied, type ChangeReport, locateProposal } from "./locate.js";

// The real fixture, read the way the dev loader reads it: what `loupe locate` sees.
const ROOT = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.."));
const ADAPT_LIST = path.join(ROOT, "fixture/app/loupe/adapt-list.json");
const MENU = "fixture/app/components/product/member-row-menu.tsx";
const PAGE = "fixture/app/app/page.tsx";
const REMOVE = callSiteId({ path: MENU, enclosing: "MemberRowMenu", component: "DropdownMenuItem", ordinal: 2 });
const CANCEL = callSiteId({ path: MENU, enclosing: "MemberRowMenu", component: "AlertDialogCancel", ordinal: 1 });
const BADGE = callSiteId({ path: PAGE, enclosing: "MembersPage", component: "Badge", ordinal: 1 });

type Draft = Partial<ProposalChange> & Pick<ProposalChange, "id" | "component" | "props"> & { anchor: string; total?: number | null };

function change({ anchor, total = null, ...draft }: Draft): ProposalChange {
  const [path, enclosing, rest] = anchor.split(" › ");
  const nth = Number(/\[(\d+)\]$/.exec(rest ?? "")?.[1] ?? 1);
  return {
    action: "apply",
    askFirst: [],
    scope: "call-site",
    origin: null,
    callSites: [{ path: path ?? "", enclosing: enclosing ?? "", component: draft.component, nth, total, anchor, lineHint: null }],
    instances: [],
    needsCondition: null,
    serverRendered: [],
    overriddenBy: [],
    alsoRendersOn: [],
    onScreenAtExport: true,
    note: null,
    ...draft,
  };
}

function proposalOf(...changes: ProposalChange[]): Proposal {
  const project = { repo: "loupe", commit: null, dirty: null, playgroundVersion: null, install: { app: "fixture/app", layer: "fixture/app/loupe" } };
  return {
    formatVersion: 2,
    title: "Fixture",
    createdAt: "2026-11-20T10:00:00.000Z",
    designer: null,
    project,
    howToApply: howToApply(project.install),
    routes: [{ url: null, route: "/", viewport: null, dpr: null, theme: null, flags: {}, capturedAt: null, changes, statesShown: [] }],
    heldForReview: [],
  };
}

/** The fixture from disk, with some files replaced by edited source. */
function locate(proposal: Proposal, edited: Record<string, string> = {}) {
  return locateProposal(proposal, {
    context: loaderContext({ root: ROOT, adaptList: ADAPT_LIST }),
    readFile: (file) => {
      const relative = path.relative(ROOT, file);
      if (relative in edited) return edited[relative] ?? null;
      try {
        return readFileSync(file, "utf8");
      } catch {
        return null;
      }
    },
  });
}

const menu = () => readFileSync(path.join(ROOT, MENU), "utf8");
const toDefault = change({ id: "c1", component: "DropdownMenuItem", anchor: REMOVE, total: 2, props: [{ name: "variant", current: "destructive", proposed: "default", writtenAs: "literal" }] });

describe("loupe locate", () => {
  it("finds a call site by its anchor and says a literal edit is still to do", () => {
    const report = locate(proposalOf(toDefault));
    const [site] = report.changes[0]?.sites ?? [];
    expect(site).toMatchObject({ status: "found", path: MENU, line: 43, column: 11, total: 2 });
    expect(site?.props).toEqual([{ name: "variant", proposed: '"default"', status: { kind: "to-do", written: '"destructive"' } }]);
    expect(report.changes.map(applied)).toEqual([false]);
  });

  it("says a change is in the code once the source writes the proposed value", () => {
    const edited = menu().replace('variant="destructive"\n            disabled', 'variant="default"\n            disabled');
    const report = locate(proposalOf(toDefault), { [MENU]: edited });
    expect(report.changes[0]?.sites[0]?.props[0]?.status).toEqual({ kind: "in-code" });
    expect(report.changes.map(applied)).toEqual([true]);
  });

  it("says the code changed when the call site's component has another use, and reads nothing there", () => {
    const edited = menu().replace(
      "<DropdownMenuItem disabled={isSoleAdmin}>Change role</DropdownMenuItem>",
      "<DropdownMenuItem>Copy email</DropdownMenuItem>\n          <DropdownMenuItem disabled={isSoleAdmin}>Change role</DropdownMenuItem>",
    );
    const [site] = locate(proposalOf(toDefault), { [MENU]: edited }).changes[0]?.sites ?? [];
    expect(site).toMatchObject({ status: "code-changed", total: 3, props: [] });
    expect(site?.detail).toBe("Code changed here, review: this call site had 2 uses and now has 3.");
  });

  it("says a call site is gone, and why", () => {
    const gone = callSiteId({ path: MENU, enclosing: "MemberRowMenu", component: "DropdownMenuItem", ordinal: 5 });
    const [site] = locate(proposalOf(change({ id: "c1", component: "DropdownMenuItem", anchor: gone, props: toDefault.props }))).changes[0]?.sites ?? [];
    expect(site).toMatchObject({ status: "not-found", detail: "MemberRowMenu has 2 uses of <DropdownMenuItem> now, no 5th." });
    const [missing] = locate(proposalOf(toDefault), { [MENU]: "" }).changes[0]?.sites ?? [];
    expect(missing).toMatchObject({ status: "not-found", detail: "No <DropdownMenuItem> in MemberRowMenu any more." });
    const nowhere = callSiteId({ path: "fixture/app/gone.tsx", enclosing: "Gone", component: "Button", ordinal: 1 });
    const [file] = locate(proposalOf(change({ id: "c1", component: "Button", anchor: nowhere, props: toDefault.props }))).changes[0]?.sites ?? [];
    expect(file).toMatchObject({ status: "not-found", detail: "The file is gone." });
  });

  it("says a file that doesn't parse can't be read, rather than that the call site is gone", () => {
    const [site] = locate(proposalOf(toDefault), { [MENU]: `${menu()}\n<` }).changes[0]?.sites ?? [];
    expect(site?.status).toBe("unreadable");
    expect(site?.detail).toMatch(/^The file doesn't parse: /);
  });

  it("names the expression a value comes from, for the designer to decide", () => {
    const badge = change({
      id: "c1",
      action: "ask-first",
      askFirst: ["`variant` is written as an expression"],
      scope: "page",
      component: "Badge",
      anchor: BADGE,
      props: [{ name: "variant", proposed: "outline", writtenAs: "expression" }],
    });
    const [site] = locate(proposalOf(badge)).changes[0]?.sites ?? [];
    expect(site).toMatchObject({ status: "found", line: 28 });
    expect(site?.props[0]?.status).toEqual({ kind: "expression", expression: 'member.role === "admin" ? "default" : "muted"' });
  });

  it("reads label text as React renders it", () => {
    const cancel = change({ id: "c1", component: "AlertDialogCancel", anchor: CANCEL, props: [{ name: "children", current: "Cancel", proposed: "Keep member", writtenAs: "literal" }] });
    expect(locate(proposalOf(cancel)).changes[0]?.sites[0]?.props[0]?.status).toEqual({ kind: "to-do", written: '"Cancel"' });
    const edited = menu().replace("<AlertDialogCancel>Cancel</AlertDialogCancel>", "<AlertDialogCancel>\n              Keep member\n            </AlertDialogCancel>");
    expect(locate(proposalOf(cancel), { [MENU]: edited }).changes[0]?.sites[0]?.props[0]?.status).toEqual({ kind: "in-code" });
  });

  it("asks to add a prop the call site doesn't write, and counts removing one as done once it is gone", () => {
    const size = change({ id: "c1", component: "DropdownMenuItem", anchor: REMOVE, props: [{ name: "size", proposed: "sm", writtenAs: "unset" }] });
    expect(locate(proposalOf(size)).changes[0]?.sites[0]?.props[0]?.status).toEqual({ kind: "to-do", written: null });
    const unset = change({ id: "c1", component: "DropdownMenuItem", anchor: REMOVE, props: [{ name: "variant", proposedUnset: true, writtenAs: "literal" }] });
    expect(locate(proposalOf(unset)).changes[0]?.sites[0]?.props[0]).toMatchObject({ proposed: "unset", status: { kind: "to-do", written: '"destructive"' } });
    const edited = menu().replace('variant="destructive"\n            disabled', "disabled");
    expect(locate(proposalOf(unset), { [MENU]: edited }).changes[0]?.sites[0]?.props[0]?.status).toEqual({ kind: "in-code" });
  });

  it("checks a prop a narrower Apply change sets at the same call site against that change's value", () => {
    const page = change({ id: "c1", scope: "page", component: "DropdownMenuItem", anchor: REMOVE, props: [{ name: "variant", proposed: "default", writtenAs: "literal" }] });
    const instance = change({ id: "c2", scope: "instance", component: "DropdownMenuItem", anchor: REMOVE, props: [{ name: "variant", proposed: "ghost", writtenAs: "literal" }] });
    const before = locate(proposalOf(page, instance));
    expect(before.changes[0]?.sites[0]?.props[0]?.status).toEqual({ kind: "overridden", by: "c2", status: { kind: "to-do", written: '"destructive"' } });
    expect(before.changes[1]?.sites[0]?.props[0]?.status).toEqual({ kind: "to-do", written: '"destructive"' });
    // Not done until the code says so: neither change is applied yet.
    expect(before.changes.map(applied)).toEqual([false, false]);

    const edited = menu().replace('variant="destructive"\n            disabled', 'variant="ghost"\n            disabled');
    const after = locate(proposalOf(page, instance), { [MENU]: edited });
    expect(after.changes[0]?.sites[0]?.props[0]?.status).toEqual({ kind: "overridden", by: "c2", status: { kind: "in-code" } });
    expect(after.changes.map(applied)).toEqual([true, true]);
  });

  it("never lets a narrower change that asks first stand in for the code", () => {
    const page = change({ id: "c1", scope: "page", component: "DropdownMenuItem", anchor: REMOVE, props: [{ name: "variant", proposed: "default", writtenAs: "literal" }] });
    const instance = change({
      id: "c2",
      action: "ask-first",
      askFirst: ["1 of 4 from this call site (m2), needs a condition"],
      scope: "instance",
      component: "DropdownMenuItem",
      anchor: REMOVE,
      props: [{ name: "variant", proposed: "ghost", writtenAs: "literal" }],
    });
    const report = locate(proposalOf(page, instance));
    expect(report.changes[0]?.sites[0]?.props[0]?.status).toEqual({ kind: "to-do", written: '"destructive"' });
    expect(applied(report.changes[0] as ChangeReport)).toBe(false);
  });
});
