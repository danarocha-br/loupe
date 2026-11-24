// The panel's view (PER-214): one call takes the page and the selection and
// returns, as typed data with its words, everything the panel shows. The Toolbar's
// components only render it. This file is the only one they import.

import { createReads } from "./reads.js";
import { inspectorBody } from "./inspector.js";
import { changeKeys } from "./keys.js";
import { changeItems, listBody, stateItems } from "./list.js";
import { readPage } from "./page.js";
import { present, scopeView } from "./scopes.js";
import type { PanelInput, PanelView } from "./types.js";
import { layerNotice, noticesSaid, overridesOffNotice } from "./notices.js";
import { changesWord, footerCount, headerReport, heldChip, pageName } from "./words.js";

export type * from "./types.js";
export { flagsCard } from "./flags.js";
export { COMMAND_WORDS, INSPECTOR_WORDS, isolate, LIST_WORDS, sourceText, TEXT, THIS_INSTANCE } from "./words.js";

/**
 * Reads the page through `input.debug`, each Instance at most once, and decides
 * what the panel shows. It writes nothing, and never throws because an Instance
 * has gone: the selected one then reads "Not on the page now".
 */
export function panelView(input: PanelInput): PanelView {
  const { selected } = input;
  const reads = createReads(input.debug);
  const page = readPage(input.debug, input.seen, input.layer);
  const row = selected === null ? null : (page.rows.find((candidate) => candidate.id === selected) ?? null);
  // The picked scope applies while the Instance has it: mounted, adapted, with a call
  // site for a group, and Overrides on. Otherwise This instance does.
  const view =
    row !== null && row.adapted && input.scope !== "instance" && page.status.overrides
      ? scopeView(page.rows, page.records, row, input.scope)
      : null;
  const scoped = view && present(view, reads);
  const scope = scoped ? input.scope : "instance";
  const keys = changeKeys(page.records, page.rows, page.route);
  const changes = changeItems(keys, page, reads);
  // State props an Instance Override holds: Overrides, but shown as states, not numbered changes.
  const states = stateItems(page, reads);
  const layer = layerNotice(input.layer);
  const overridesOff = page.status.overrides ? null : overridesOffNotice(page.status.reason);
  return {
    scope,
    seen: page.seen,
    // An Adapter carries its own metadata.
    metaAnchor: row && !row.adapted ? row.anchor : null,
    outline: {
      label: selected === null ? null : (reads.inspect(selected)?.component ?? null),
      members: scoped?.members ?? null,
    },
    instanceCount: page.instanceCount,
    marks: keys.marks,
    header: { route: page.route, page: pageName(page.route), report: headerReport(page.route, changes.length, states.length) },
    notices: [layer, overridesOff].filter((notice) => notice !== null),
    said: noticesSaid(input.layer, overridesOff),
    footer: {
      countText: footerCount(changes.length, states.length),
      hasOverrides: page.overrideCount > 0,
      copyEnabled: page.records.length > 0,
      // `discard` takes a record's target, so it also drops a record whose Instance
      // isn't mounted, where `reset(id)` throws (PER-128).
      resetAll: page.overrideCount > 0 && page.status.overrides ? page.records.map((record) => record.target) : [],
      changes: { count: changes.length, word: changesWord(changes.length) },
      states: { chip: heldChip(states.length), title: states.map((state) => `${state.detail} · ${state.where}`).join("\n") },
    },
    body: selected === null ? listBody(page, reads, keys) : inspectorBody(selected, row, page, reads, { scope, scoped }, keys),
  };
}
