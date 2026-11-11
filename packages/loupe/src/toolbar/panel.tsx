// The panel of the 2e sketch: pinned header and footer, a scrolling middle whose
// last card stretches, and either the component list (nothing selected) or the
// inspector, at This instance or a group or page scope (PER-134). Functional
// only; the visual pass is PER-140.

import type { InstanceRow, LoupeDebug } from "../runtime/debug.js";
import type { Inspection } from "../runtime/inspect.js";
import { overridesOffNote } from "../runtime/inspect.js";
import type { Scope } from "../runtime/store.js";
import type { PageSnapshot } from "./page.js";
import { attempt, type Editing, PropRowView, ScopeRowView } from "./controls.js";
import { hasInstanceRecord, safeInspect, safeProps } from "./page.js";
import { formatCurrent } from "./format.js";
import { fallbacks, labelsOf, PAGE_LABEL, scopeChips, type ScopeView, scopeView } from "./scopes.js";

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
  picking: boolean;
  onPick(): void;
  onHide(): void;
};

export function Panel(props: PanelProps) {
  const { page, selected } = props;
  return (
    <section className="panel" aria-label="Loupe">
      <header className="header">
        <span className="title">Loupe</span>
        <button type="button" aria-pressed={props.picking} onClick={props.onPick} title="Click an Instance on the page (Esc cancels)">
          Pick
        </button>
        <button type="button" onClick={props.onHide}>
          Hide
        </button>
      </header>
      <div className="middle">
        {!page.status.overrides && (
          <div className="banner" role="status">
            {overridesOffNote(page.status.reason)}
          </div>
        )}
        {selected === null ? (
          <ComponentList {...props} />
        ) : (
          <Inspector {...props} id={selected} />
        )}
      </div>
      <Footer {...props} />
    </section>
  );
}

function ComponentList({ page, onSelect, onHover }: PanelProps) {
  const instances = page.groups.reduce((sum, group) => sum + group.instances.length, 0);
  return (
    <>
      <div className="card">
        <h3>Nothing selected</h3>
        <div className="muted">
          {instances} Instances of {page.groups.length} components on this page. Pick one on the page or below.
        </div>
      </div>
      <div className={page.interaction.length === 0 ? "card stretch" : "card"}>
        <h3>On this page</h3>
        <ul className="list" aria-label="Components on this page">
          {page.groups.map((group) => (
            <li key={group.component}>
              <details>
                <summary
                  onMouseEnter={() => onHover(group.instances.map((row) => row.id))}
                  onMouseLeave={() => onHover([])}
                >
                  {group.component} ×{group.instances.length}{" "}
                  {group.overrides > 0 && <span className="tag">{group.overrides} override{group.overrides === 1 ? "" : "s"}</span>}{" "}
                  {group.supported ? (
                    <span className="tag supported">Supported</span>
                  ) : (
                    <span className="tag" title={group.reason ?? undefined}>
                      Inspect only
                    </span>
                  )}
                  {!group.supported && group.reason && <span className="muted"> · {group.reason}</span>}
                </summary>
                <ul className="list">
                  {group.instances.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        data-instance={row.id}
                        onClick={() => onSelect(row.id)}
                        onMouseEnter={() => onHover([row.id])}
                        onMouseLeave={() => onHover([])}
                      >
                        <span className="mono">{instanceLabel(row.id, row.hint)}</span>
                        {row.rendered === "server" && <span className="tag">On the server</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      </div>
      {page.interaction.length > 0 && (
        <div className="card stretch">
          <h3>Appears on interaction</h3>
          <div className="muted">Seen on this page, not mounted now: open the menu or dialog to inspect them.</div>
          <ul className="list">
            {page.interaction.map((component) => (
              <li key={component}>{component}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/** The call site's file and line, then the key path that tells repeated Instances apart. */
function instanceLabel(id: string, hint: string | null): string {
  const where = hint ? hint.replace(/:\d+ \d+\/\d+$/, "").split("/").at(-1) : id;
  const key = id.includes("#") ? id.slice(id.indexOf("#")) : "";
  return `${where}${key}`;
}

function Inspector(props: PanelProps & { id: string }) {
  const { debug, id, onSelect, page, scope, onScope, view } = props;
  const inspection = safeInspect(debug, id);
  const recorded = debug.status.overrides && hasInstanceRecord(debug, id);
  const resetInstance = (
    <button
      type="button"
      disabled={!recorded}
      onClick={() => {
        // `discard` also drops the record of an Instance that isn't mounted, where `reset(id)` throws (PER-128).
        debug.discard({ scope: "instance", id });
      }}
    >
      Reset this Instance
    </button>
  );
  if (inspection === null) {
    return (
      <div className="card stretch">
        <h3>Not on the page now</h3>
        <p className="mono">{id}</p>
        <p className="muted">It shows here again when it mounts, for example when its menu or dialog opens.</p>
        {recorded && resetInstance}
        <button type="button" onClick={() => onSelect(null)}>
          Back to the list
        </button>
      </div>
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
  return (
    <>
      <div className="card">
        <button type="button" onClick={() => onSelect(null)}>
          ← All components
        </button>
        <h3>Instance</h3>
        <div>
          <strong>{inspection.component}</strong>{" "}
          {inspection.coverage.editable > 0 ? (
            <span className="tag supported">Supported</span>
          ) : (
            <span className="tag">Inspect only</span>
          )}{" "}
          <span className="tag">{inspection.rendered === "server" ? "On the server" : "In the browser"}</span>
        </div>
        {editing && resetInstance}
        <div className="mono" data-testid="instance-id">
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
          <div>
            Inside{" "}
            {ancestors.map((ancestor) => (
              <button key={ancestor} type="button" onClick={() => onSelect(ancestor)}>
                {safeInspect(debug, ancestor)?.component ?? ancestor}
              </button>
            ))}
          </div>
        )}
      </div>
      {editing && row && <ScopePicker debug={debug} page={page} scope={scope} onScope={onScope} row={row} />}
      {scoped && <MembersCard debug={debug} id={id} view={view} rows={rows} onHover={props.onHover} />}
      <CallSiteCard inspection={inspection} />
      {inspection.note && (
        <div className="banner" role="note">
          {inspection.note}
        </div>
      )}
      <div className="card">
        <h3>Coverage</h3>
        <div data-testid="coverage">
          {inspection.coverage.editable} editable prop{inspection.coverage.editable === 1 ? "" : "s"} ·{" "}
          {inspection.coverage.inspectOnly} inspect only
        </div>
      </div>
      <div className="card">
        <h3>Editable props</h3>
        {editable.length === 0 ? (
          <div className="muted">None</div>
        ) : scoped ? (
          editable.map((candidate) => (
            <ScopeRowView key={candidate.name} row={candidate} editing={editing} view={view} onSelect={onSelect} onHover={props.onHover} />
          ))
        ) : (
          editable.map((candidate) => <PropRowView key={candidate.name} row={candidate} editing={editing} />)
        )}
      </div>
      <div className="card stretch">
        <h3>Inspect only</h3>
        {inspectOnly.length === 0 ? (
          <div className="muted">None</div>
        ) : (
          inspectOnly.map((candidate) => <PropRowView key={candidate.name} row={candidate} editing={scoped ? null : editing} />)
        )}
        {injected.length > 0 && (
          <details>
            <summary>
              {injected.length} set by the library
            </summary>
            {injected.map(([name, value]) => (
              <div className="row" key={name}>
                <span className="name mono">{name}</span>
                <span className="value mono">{formatCurrent(value)}</span>
              </div>
            ))}
          </details>
        )}
      </div>
    </>
  );
}

/** This instance, every Instance from this call site, every Instance on this page: each with its size. */
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
    <div className="card">
      <h3>Scope</h3>
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
  const memberItem = (member: ScopeView["members"][number]) => (
    <li key={member.id} onMouseEnter={() => onHover([member.id])} onMouseLeave={() => onHover([])}>
      <label>
        <input
          type="checkbox"
          data-member={member.id}
          checked={!member.out}
          disabled={suspended}
          onChange={() => toggle(member.id, member.out)}
        />{" "}
        <span className="mono">{member.id === id ? "This instance" : keyOf(member.id)}</span>
        {member.out && <span className="tag">Left out</span>}
      </label>
    </li>
  );
  return (
    <div className="card" data-testid="members">
      <h3>Instances</h3>
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
                  />{" "}
                  <span className="mono" title={anchor}>
                    {anchor ? anchor.split(" › ").slice(-2).join(" › ") : "No call site"}
                  </span>{" "}
                  · {members.length}
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
            <li key={server.id} className="mono">
              {server.id} <span className="tag">On the server</span>
            </li>
          ))}
        </ul>
      )}
      {view.outUnmounted.length > 0 && (
        <ul className="list" aria-label="Left out, not mounted">
          {view.outUnmounted.map((outId) => (
            <li key={outId} className="mono muted">
              {outId} <span className="tag">Left out · not mounted</span>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        disabled={view.record === null}
        onClick={() => attempt(() => debug.discard(view.target))}
      >
        Reset this scope
      </button>
    </div>
  );
}

/** The key path that tells repeated Instances apart, or the whole id when there is none. */
function keyOf(id: string): string {
  return id.includes("#") ? id.slice(id.indexOf("#")) : id;
}

function CallSiteCard({ inspection }: { inspection: Inspection }) {
  const site = inspection.callSite;
  return (
    <div className="card">
      <h3>Call site</h3>
      {site ? (
        <div className="mono">
          {site.path}:{site.line}:{site.column} · use {site.ordinal} of {site.total}
        </div>
      ) : (
        <div className="muted">No call site was anchored here.</div>
      )}
      <div className="mono muted">{inspection.anchor}</div>
    </div>
  );
}

function Footer({ page, debug }: PanelProps) {
  const count = page.overrideCount;
  return (
    <footer className="footer">
      <span>
        {count} override{count === 1 ? "" : "s"}
      </span>
      <button
        type="button"
        disabled={count === 0 || !page.status.overrides}
        onClick={() => {
          // `discard` takes a record's target, so it also drops a record whose
          // Instance isn't mounted, where `reset(id)` throws (PER-128).
          for (const record of debug.records()) debug.discard(record.target);
        }}
      >
        Reset all
      </button>
    </footer>
  );
}
