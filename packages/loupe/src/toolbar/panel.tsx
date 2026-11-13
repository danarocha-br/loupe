// The panel of the 2e sketch (PER-140): a pinned header (Export Proposal, light or
// dark, Hide) and footer (the Override count, Copy as Markdown, Reset all), and a
// scrolling middle whose last card stretches. The middle holds either the
// component list (nothing selected) or the inspector, at This instance or a group
// or page scope (PER-134). Notices sit below the page or Instance card.

import { type ReactNode, useEffect, useState } from "react";
import { callSiteLabels, parseHint } from "../call-site.js";
import type { InstanceRow, LoupeDebug, RecordRow } from "../runtime/debug.js";
import type { Inspection } from "../runtime/inspect.js";
import { NO_META_NOTE, overridesOffNote, SERVER_NOTE, SPREADS_NOTE, UNADAPTED_NOTE } from "../runtime/inspect.js";
import type { LastSeen } from "../runtime/registry.js";
import type { Scope, ScopeTarget, Suspension } from "../runtime/store.js";
import type { PageSnapshot } from "./page.js";
import { attempt, type Editing, PropRowView, ScopeRowView } from "./controls.js";
import { hasInstanceRecord, instanceRecord, safeInspect, safeProps } from "./page.js";
import { formatCurrent } from "./format.js";
import { fallbacks, labelsOf, PAGE_LABEL, scopeChips, type ScopeView, scopeView } from "./scopes.js";
import { FlagsCard } from "./flags.js";
import { ExportButton } from "./export-dialog.js";
import { BackIcon, CheckIcon, ChevronIcon, CopyIcon, InfoIcon, ResetIcon, SunIcon } from "./icons.js";
import { copyProposalMarkdown } from "./proposal.js";
import { SnapshotsCard } from "./snapshots-card.js";
import {
  LayerNotices,
  NotGeneratedNotice,
  notGeneratedComponents,
  staleComponents,
  useLayerStatus,
} from "./notices.js";

/** What the list and the inspector flag from the Product layer's status (PER-133, PER-179). */
type LayerFlags = {
  stale: Set<string>;
  /** Components on the page `generate` hasn't read yet. */
  notGenerated: string[];
  /** The command that rewrites the Product layer; empty while it can't be read. */
  command: string;
};

type PanelProps = {
  debug: LoupeDebug;
  version: number;
  page: PageSnapshot;
  selected: string | null;
  onSelect(id: string | null): void;
  /** The scope the inspector edits at; a new selection always opens at This instance. */
  scope: Scope;
  onScope(scope: Scope): void;
  /** The group or page scope being edited, or null at This instance. */
  view: ScopeView | null;
  onHover(ids: string[]): void;
  onHide(): void;
  theme: "light" | "dark";
  onTheme(): void;
};

type BodyProps = PanelProps & { flags: LayerFlags; notices: ReactNode };

export function Panel(props: PanelProps) {
  const { page, selected } = props;
  const layer = useLayerStatus(props.version);
  const flags: LayerFlags = {
    stale: staleComponents(layer),
    notGenerated: notGeneratedComponents(layer, page.groups),
    command: layer?.command ?? "",
  };
  const notices = (
    <>
      <LayerNotices status={layer} />
      {!page.status.overrides && <OverridesOff reason={page.status.reason} />}
    </>
  );
  return (
    <section className="panel" aria-label="Loupe">
      <header className="header">
        <ExportButton disabled={page.records.length === 0} />
        <div className="end">
          <button
            type="button"
            className="btn round"
            aria-pressed={props.theme === "dark"}
            onClick={props.onTheme}
            title={props.theme === "dark" ? "Switch to light" : "Switch to dark"}
          >
            <SunIcon />
            <span className="sr-only">Dark theme</span>
          </button>
          <button type="button" className="btn" onClick={props.onHide}>
            Hide
          </button>
        </div>
      </header>
      <div className="middle">
        {selected === null ? (
          <ComponentList {...props} flags={flags} notices={notices} />
        ) : (
          <Inspector {...props} id={selected} flags={flags} notices={notices} />
        )}
      </div>
      <Footer {...props} />
    </section>
  );
}

/** The React self-check failed (PER-184: said here once, not again on the Instance). */
function OverridesOff({ reason }: { reason: string }) {
  // The title says "Overrides are off"; the body is the rest of the note, whatever its wording.
  const note = overridesOffNote(reason);
  const rest = note.replace(/^Overrides are off,\s*/, "");
  const sentence = rest === note ? note : rest.charAt(0).toUpperCase() + rest.slice(1);
  return (
    <div className="card notice-card banner" role="status">
      <div className="head">
        <div className="title">
          <span className="dot red" />
          Overrides are off
        </div>
      </div>
      <p className="body">{sentence}</p>
    </div>
  );
}

/**
 * The page's name from its route's last segment: `/org/acme/settings/billing`
 * reads Billing. Titles put the app's name first as often as last, so the route
 * is the steadier source.
 */
function pageName(): string {
  const segment = decodeURIComponent(location.pathname.split("/").filter(Boolean).at(-1) ?? "");
  if (segment === "") return "Home";
  const words = segment.replace(/[-_]+/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function ComponentList({ debug, page, onSelect, onHover, flags, notices }: BodyProps) {
  const instances = page.groups.reduce((sum, group) => sum + group.instances.length, 0);
  return (
    <>
      <div className="card identity">
        <div className="head">
          <div className="title">
            <span className="name">{pageName()}</span>
            <span className="chip-label">{location.pathname}</span>
          </div>
        </div>
        <p className="body">Nothing selected. Pick a component below or click one on the page.</p>
      </div>
      {notices}
      <NotGeneratedNotice names={flags.notGenerated} command={flags.command} />
      <FlagsCard />
      <SnapshotsCard />
      <HeldForReviewCard debug={debug} records={page.records} />
      <div className={page.interaction.length === 0 ? "card list-card stretch" : "card list-card"}>
        <div className="head">
          <h3>On this page</h3>
          <span className="meta">
            {page.groups.length} component{page.groups.length === 1 ? "" : "s"} · {instances} Instance
            {instances === 1 ? "" : "s"}
          </span>
        </div>
        <ul className="list" aria-label="Components on this page">
          {page.groups.map((group) => {
            const notGenerated = flags.notGenerated.includes(group.component);
            return (
              <li key={group.component} className="group">
                <details>
                  <summary
                    onMouseEnter={() => onHover(group.instances.map((row) => row.id))}
                    onMouseLeave={() => onHover([])}
                  >
                    <span className="cname">{group.component}</span>{" "}
                    <span className="times">×{group.instances.length}</span>
                    <span className="sub">
                      {group.overrides > 0 && (
                        <span>
                          <span className="dot small purple" />
                          {group.overrides} override{group.overrides === 1 ? "" : "s"}
                        </span>
                      )}
                      {flags.stale.has(group.component) && (
                        <span className="stale">
                          <span className="dot small amber" />
                          Source changed
                        </span>
                      )}
                      {group.held.length > 0 && <span>{group.held.length} not mounted</span>}
                      {!group.supported && group.reason && !notGenerated && group.reason !== "No Instance mounted" && (
                        <span>{group.reason}</span>
                      )}
                    </span>
                    <span className="status">
                      {group.instances.length === 0 ? null : notGenerated ? (
                        <span className="tag status stale" title={flags.command}>
                          Not generated yet
                        </span>
                      ) : group.supported ? (
                        <span className="tag status supported">Supported</span>
                      ) : (
                        <span className="tag status" title={group.reason ?? undefined}>
                          Inspect only
                        </span>
                      )}
                    </span>
                    <ChevronIcon />
                  </summary>
                  <ul className="list instances">
                    {group.instances.map((row) => (
                      <li key={row.id}>
                        <button
                          type="button"
                          data-instance={row.id}
                          onClick={() => onSelect(row.id)}
                          onMouseEnter={() => onHover([row.id])}
                          onMouseLeave={() => onHover([])}
                        >
                          <span>{instanceLabel(row.id, row.hint)}</span>
                          {row.rendered === "server" && <span className="tag status">On the server</span>}
                          {instanceRecord(page.records, row.id)?.suspended && (
                            <span className="tag status held">Held for review</span>
                          )}
                        </button>
                      </li>
                    ))}
                    {group.held.map((entry) => (
                      <li key={entry.id}>
                        <button type="button" data-instance={entry.id} onClick={() => onSelect(entry.id)}>
                          <span>{instanceLabel(entry.id, entry.lastSeen?.hint ?? null)}</span>{" "}
                          {entry.record.suspended ? (
                            <span className="tag status held">Held for review</span>
                          ) : (
                            <span className="tag status dashed">No Instance mounted</span>
                          )}
                        </button>
                        {/* A held-for-review record's values are on its card above. */}
                        {!entry.record.suspended && <HeldValues record={entry.record} lastSeen={entry.lastSeen} />}
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            );
          })}
        </ul>
      </div>
      {page.interaction.length > 0 && (
        <div className="card list-card soft stretch">
          <div className="head">
            <h3>Appears on interaction</h3>
            <span className="meta">Not on screen yet</span>
          </div>
          <ul className="list interaction">
            {page.interaction.map((component) => (
              <li key={component}>
                {component}
                <span className="muted">Seen on this page, not mounted now: open its menu or dialog to inspect it.</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/**
 * A held record's values, each beside the Current value its Instance last
 * rendered with: an unmounted Instance's Current value is only ever last seen.
 */
function HeldValues({ record, lastSeen }: { record: RecordRow; lastSeen: LastSeen | null }) {
  return (
    <ul className="list held-values" data-testid="held-values">
      {Object.entries(record.values).map(([prop, value]) => (
        <li key={prop}>{`${prop} ${formatCurrent(value)}${currentLastSeen(lastSeen, prop)}`}</li>
      ))}
    </ul>
  );
}

/** Nothing when there is no last-seen value: the id may be mounted again, on another element. */
function currentLastSeen(lastSeen: LastSeen | null, prop: string): string {
  if (lastSeen === null) return "";
  const value = prop in lastSeen.current ? formatCurrent(lastSeen.current[prop]) : "not set";
  return ` · Current ${value} (last seen)`;
}

/**
 * Records suspended for review (PER-95): the call site's total changed, or the id
 * names more than one Instance. They apply to nothing until discarded, which the
 * hollow purple ring says (PER-140). Nothing here opens a menu or dialog to reach one.
 */
function HeldForReviewCard({ debug, records }: { debug: LoupeDebug; records: RecordRow[] }) {
  const held = records.filter((record) => record.suspended !== null);
  if (held.length === 0) return null;
  return (
    <div className="card list-card" data-testid="held-for-review">
      <div className="head">
        <div className="title">
          <span className="dot ring" />
          <h3>Held for review</h3>
        </div>
        <span className="meta">{held.length} · apply to nothing</span>
      </div>
      <ul className="list held-list">
        {held.map((record) => (
          <li key={JSON.stringify(record.target)} className="held-item">
            <div className="target">
              <span>{targetLabel(record.target)}</span>
              <button type="button" className="btn small" onClick={() => attempt(() => debug.discard(record.target))}>
                Discard
              </button>
            </div>
            <div className="muted">{suspensionReason(record.suspended as Suspension)}</div>
            <HeldValues record={record} lastSeen={record.target.scope === "instance" ? debug.lastSeen(record.target.id) : null} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Why a record is held, in the words of PER-95's decision. */
function suspensionReason(suspended: Suspension): string {
  return suspended.reason === "ambiguous"
    ? `Matches more than one Instance (${suspended.ids.join(", ")}): discard it and set it again on the one you mean.`
    : `Code changed here: this call site had ${suspended.was} uses, now ${suspended.now}.`;
}

/** What a record names: an Instance, every Instance from a call site, or a component on a page. */
function targetLabel(target: ScopeTarget): string {
  const short = (idOrAnchor: string) => callSiteLabels(idOrAnchor).short;
  switch (target.scope) {
    case "instance":
      return short(target.id);
    case "group":
      return `All from ${short(target.anchor)}`;
    case "page":
      return `${target.component} on ${target.route}`;
  }
}

/** The call site's file and line, then the key path that tells repeated Instances apart. */
function instanceLabel(id: string, hint: string | null): string {
  const site = parseHint(hint);
  const where = site ? `${site.path.split("/").at(-1)}:${site.line}` : id;
  return `${where}${callSiteLabels(id).key}`;
}

/** An Instance's card-level note, under a title that names its kind. */
const NOTE_TITLE: Record<string, string> = {
  [UNADAPTED_NOTE]: "Inspect only · No Adapter",
  [SERVER_NOTE]: "On the server",
  [SPREADS_NOTE]: "Props spread here",
  [NO_META_NOTE]: "No prop metadata",
};

function Inspector(props: BodyProps & { id: string }) {
  const { debug, id, onSelect, page, scope, onScope, view, notices } = props;
  const inspection = safeInspect(debug, id);
  const recorded = debug.status.overrides && hasInstanceRecord(debug, id);
  const resetInstance = (
    <button
      type="button"
      className="btn small"
      disabled={!recorded}
      onClick={() => {
        // `discard` also drops the record of an Instance that isn't mounted, where `reset(id)` throws (PER-128).
        debug.discard({ scope: "instance", id });
      }}
    >
      Reset this Instance
    </button>
  );
  const back = (
    <button type="button" className="btn circle" onClick={() => onSelect(null)} title="Back to every component on this page">
      <BackIcon />
      <span className="sr-only">All components</span>
    </button>
  );
  if (inspection === null) {
    const record = instanceRecord(page.records, id);
    return (
      <>
        <div className="card identity">
          <div className="head">
            <div className="title">
              <span className="name">Not on the page now</span>
            </div>
            {back}
          </div>
          <div className="id">{id}</div>
        </div>
        {notices}
        <div className="card stretch">
          <h3>Not on the page now</h3>
          {record && Object.keys(record.values).length > 0 && (
            <>
              <span>
                {record.suspended ? (
                  <span className="tag status held">Held for review</span>
                ) : (
                  <span className="tag status dashed">No Instance mounted</span>
                )}
              </span>
              <HeldValues record={record} lastSeen={debug.lastSeen(id)} />
            </>
          )}
          <p className="body">It shows here again when it mounts, for example when its menu or dialog opens.</p>
          <div className="actions">
            {recorded && resetInstance}
            <button type="button" className="btn small" onClick={() => onSelect(null)}>
              Back to the list
            </button>
          </div>
        </div>
      </>
    );
  }
  const ancestors = debug.ancestors(id);
  const rows = page.rows;
  const row = rows.find((candidate) => candidate.id === id) ?? null;
  // Null for a server-rendered Instance or while Overrides are off: no controls then.
  const live = inspection.rendered === "client" && debug.status.overrides ? safeProps(debug, id) : null;
  const labels = row ? labelsOf(row) : { instance: "This instance", group: null, page: PAGE_LABEL };
  const editing: Editing | null = live ? { debug, id, live, labels, fallback: row ? fallbacks(page.records, row) : {} } : null;
  const scoped = editing !== null && view !== null && scope !== "instance";
  const editable = inspection.rows.filter((candidate) => candidate.editable);
  const inspectOnly = inspection.rows.filter((candidate) => !candidate.editable);
  const injected = Object.entries(inspection.injected);
  const chips = row ? scopeChips(page.records, row, labels) : [];
  const notGenerated = props.flags.notGenerated.includes(inspection.component);
  // Never generated: its Coverage line says so; the note's "no Editable prop" would be a guess.
  // Overrides off: the panel's banner already says it (PER-184).
  const note =
    inspection.note === null ||
    (inspection.note === UNADAPTED_NOTE && notGenerated) ||
    (!page.status.overrides && inspection.note === overridesOffNote(page.status.reason))
      ? null
      : inspection.note;
  return (
    <>
      <div className="card identity">
        <div className="head">
          <div className="title">
            <span className="name">{inspection.component}</span>
            {inspection.coverage.editable > 0 ? (
              <span className="tag status supported">
                <CheckIcon />
                Supported
              </span>
            ) : (
              <span className="tag status">Inspect only</span>
            )}
            {inspection.rendered === "server" && <span className="tag status">On the server</span>}
            {props.flags.stale.has(inspection.component) && <span className="tag status stale">Source changed</span>}
          </div>
          {back}
        </div>
        <div className="id" data-testid="instance-id">
          {inspection.id}
        </div>
        {chips.length > 0 && (
          <div className="chips" data-testid="chips">
            {chips.map((chip) => (
              <span key={chip} className="tag">
                {chip}
              </span>
            ))}
          </div>
        )}
        {ancestors.length > 0 && (
          <div className="crumbs">
            Inside
            {ancestors.map((ancestor) => (
              <button key={ancestor} type="button" onClick={() => onSelect(ancestor)}>
                {safeInspect(debug, ancestor)?.component ?? ancestor}
              </button>
            ))}
          </div>
        )}
        {editing && <div className="actions">{resetInstance}</div>}
        {editing && row && <ScopePicker debug={debug} page={page} scope={scope} onScope={onScope} row={row} />}
      </div>
      {notices}
      {scoped && <MembersCard debug={debug} id={id} view={view} rows={rows} onHover={props.onHover} />}
      {note && (
        <div className="card note-card" role="note">
          <InfoIcon />
          <div className="text">
            <h3>{NOTE_TITLE[note] ?? "Note"}</h3>
            <p className="body">{note}</p>
          </div>
        </div>
      )}
      <CoverageCard inspection={inspection} flags={props.flags} />
      {editable.map((candidate) => (
        <div className="card prop" key={candidate.name}>
          {scoped ? (
            <ScopeRowView row={candidate} editing={editing} view={view} onSelect={onSelect} onHover={props.onHover} />
          ) : (
            <PropRowView row={candidate} editing={editing} />
          )}
        </div>
      ))}
      <div className="card soft stretch inspect">
        <div className="head">
          <h3>Inspect only</h3>
          {!page.status.overrides && <span className="meta">Overrides off</span>}
        </div>
        {inspectOnly.length === 0 ? (
          <div className="muted">None</div>
        ) : (
          inspectOnly.map((candidate) => (
            <PropRowView key={candidate.name} row={candidate} editing={scoped ? null : editing} />
          ))
        )}
        {injected.length > 0 && (
          <details>
            <summary>
              <ChevronIcon />
              {injected.length} set by the library
            </summary>
            {injected.map(([name, value]) => (
              <div className="row" key={name}>
                <div className="line">
                  <span className="name">{name}</span>
                  <span className="value">{formatCurrent(value)}</span>
                </div>
              </div>
            ))}
          </details>
        )}
      </div>
    </>
  );
}

/** Editable against inspect-only as a bar, and the call site under it: one card (PER-140). */
function CoverageCard({ inspection, flags }: { inspection: Inspection; flags: LayerFlags }) {
  const { editable, inspectOnly } = inspection.coverage;
  const total = editable + inspectOnly;
  const site = inspection.callSite;
  const file = site ? `${site.path.split("/").at(-1)}:${site.line}` : null;
  return (
    <div className="card coverage">
      <div className="head">
        <h3>Coverage</h3>
        <span className="meta" data-testid="coverage">
          {editable} editable prop{editable === 1 ? "" : "s"} · {inspectOnly} inspect only
        </span>
      </div>
      {total > 0 && (
        <div className="bar" aria-hidden="true">
          {total <= 12 ? (
            Array.from({ length: total }, (_, index) => <span key={index} className={index < editable ? "on" : undefined} />)
          ) : (
            <>
              {editable > 0 && <span className="on" style={{ flex: editable }} />}
              {inspectOnly > 0 && <span style={{ flex: inspectOnly }} />}
            </>
          )}
        </div>
      )}
      <div className="site">
        <span className="meta">Call site</span>
        {site ? (
          <span className="mono" title={`${site.path}:${site.line}:${site.column}\n${inspection.anchor}`}>
            {file} · use {site.ordinal} of {site.total}
          </span>
        ) : (
          <span className="muted">No call site was anchored here.</span>
        )}
      </div>
      {flags.notGenerated.includes(inspection.component) && (
        <div className="warn" data-testid="not-generated">
          <span className="dot" />
          <span>
            <span className="tag status stale">Not generated yet</span> Run <span className="mono">{flags.command}</span>{" "}
            to read its props.
          </span>
        </div>
      )}
    </div>
  );
}

/** APPLY TO: this instance, every Instance from this call site, every Instance on this page, each with its size. */
function ScopePicker({
  debug,
  page,
  scope,
  onScope,
  row,
}: Pick<PanelProps, "debug" | "page" | "scope" | "onScope"> & { row: InstanceRow }) {
  const options = (["instance", "group", "page"] as const).map((option) => ({
    option,
    view: scopeView(debug, page.rows, page.records, row, option),
  }));
  return (
    <div className="apply">
      <span className="meta">Apply to</span>
      <div className="scopes" role="group" aria-label="Scope">
        {options.map(({ option, view }) => (
          <button
            key={option}
            type="button"
            data-scope={option}
            aria-pressed={scope === option}
            disabled={view === null}
            title={view === null ? "No call site was anchored here, so it has no group." : undefined}
            onClick={() => onScope(option)}
          >
            {view?.label ?? "No call site group"}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Who a group or page change reaches, with a box to leave each one out. A page
 * scope groups them by call site, so one box leaves a whole call site out.
 */
function MembersCard({
  debug,
  id,
  view,
  rows,
  onHover,
}: Pick<PanelProps, "debug" | "onHover"> & { id: string; view: ScopeView; rows: InstanceRow[] }) {
  const scope = view.scope as "group" | "page";
  const anchorOf = new Map(rows.map((candidate) => [candidate.id, candidate.anchor]));
  const toggle = (memberId: string, out: boolean) =>
    attempt(() => (out ? debug.include(memberId, scope) : debug.exclude(memberId, scope)));
  const suspended = view.record?.suspended != null;
  const bySite = new Map<string, ScopeView["members"]>();
  for (const member of view.members) {
    const anchor = anchorOf.get(member.id) ?? "";
    bySite.set(anchor, [...(bySite.get(anchor) ?? []), member]);
  }
  const included = view.members.filter((member) => !member.out).length;
  const memberItem = (member: ScopeView["members"][number]) => (
    <li key={member.id} onMouseEnter={() => onHover([member.id])} onMouseLeave={() => onHover([])}>
      <label>
        <input
          type="checkbox"
          data-member={member.id}
          checked={!member.out}
          disabled={suspended}
          onChange={() => toggle(member.id, member.out)}
        />
        <span className={member.out ? "mono muted" : "mono"}>{member.id === id ? "This instance" : keyOf(member.id)}</span>
        {member.out && <span className="tag status">Left out</span>}
      </label>
    </li>
  );
  return (
    <div className="card members" data-testid="members">
      <div className="head">
        <h3>Instances</h3>
        <span className="meta">
          {included} of {view.members.length} previewed
        </span>
      </div>
      <div className="muted">Untick one to leave it out: it keeps its own value.</div>
      {scope === "group" ? (
        <ul className="list">{view.members.map(memberItem)}</ul>
      ) : (
        [...bySite].map(([anchor, members]) => {
          const allIn = members.every((member) => !member.out);
          return (
            <fieldset key={anchor} className="site">
              <legend>
                <label onMouseEnter={() => onHover(members.map((member) => member.id))} onMouseLeave={() => onHover([])}>
                  <input
                    type="checkbox"
                    data-site={anchor}
                    checked={allIn}
                    disabled={suspended}
                    onChange={() => {
                      for (const member of members) if (member.out !== allIn) toggle(member.id, member.out);
                    }}
                  />
                  <span className="mono" title={anchor}>
                    {anchor ? callSiteLabels(anchor).short : "No call site"}
                  </span>
                  <span className="muted">· {members.length}</span>
                </label>
              </legend>
              <ul className="list">{members.map(memberItem)}</ul>
            </fieldset>
          );
        })
      )}
      {view.server.length > 0 && (
        <ul className="list" aria-label="Server-rendered">
          {view.server.map((server) => (
            <li key={server.id}>
              <span className="mono">{server.id}</span> <span className="tag status">On the server</span>
            </li>
          ))}
        </ul>
      )}
      {view.outUnmounted.length > 0 && (
        <ul className="list" aria-label="Left out, not mounted">
          {view.outUnmounted.map((outId) => (
            <li key={outId}>
              <span className="mono muted">{outId}</span> <span className="tag status dashed">Left out · not mounted</span>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="btn small"
        style={{ alignSelf: "flex-start" }}
        disabled={view.record === null}
        onClick={() => attempt(() => debug.discard(view.target))}
      >
        <ResetIcon />
        Reset this scope
      </button>
    </div>
  );
}

/** The key path that tells repeated Instances apart, or the whole id when there is none. */
function keyOf(id: string): string {
  return callSiteLabels(id).key || id;
}

function Footer({ page, debug }: PanelProps) {
  const count = page.overrideCount;
  return (
    <footer className="footer">
      <span className="count">
        <span className={count > 0 ? "dot purple" : "dot none"} />
        <span className="text">
          {count} Override{count === 1 ? "" : "s"} on this page
        </span>
      </span>
      <CopyMarkdown disabled={page.records.length === 0} />
      <button
        type="button"
        className="btn tall"
        disabled={count === 0 || !page.status.overrides}
        onClick={() => {
          // `discard` takes a record's target, so it also drops a record whose
          // Instance isn't mounted, where `reset(id)` throws (PER-128).
          for (const record of debug.records()) debug.discard(record.target);
        }}
      >
        <ResetIcon />
        Reset all
      </button>
    </footer>
  );
}

/** Copy as Markdown (PER-135): the Proposal's summary, for a ticket. Clears nothing. */
function CopyMarkdown({ disabled }: { disabled: boolean }) {
  const [state, setState] = useState<"idle" | "copying" | "copied" | { failed: string }>("idle");
  useEffect(() => {
    if (state === "idle" || state === "copying") return;
    const timer = setTimeout(() => setState("idle"), 2500);
    return () => clearTimeout(timer);
  }, [state]);
  const failed = typeof state === "object" ? state.failed : null;
  const said = state === "copied" ? "Copied" : failed !== null ? "Copy failed" : null;
  return (
    <button
      type="button"
      className={said ? "btn tall" : "btn round tall"}
      disabled={disabled || state === "copying"}
      title={failed ?? "Copy as Markdown: a short summary of every Override, to paste into a ticket"}
      onClick={() => {
        setState("copying");
        copyProposalMarkdown().then(
          () => setState("copied"),
          (error: unknown) => {
            console.warn("[loupe] Copy as Markdown failed:", error);
            setState({ failed: error instanceof Error ? error.message : String(error) });
          },
        );
      }}
    >
      {state === "copied" ? <CheckIcon size={14} /> : <CopyIcon />}
      {said ?? <span className="sr-only">Copy as Markdown</span>}
    </button>
  );
}
