// The panel of the 2e sketch: pinned header and footer, a scrolling middle whose
// last card stretches, and either the component list (nothing selected) or the
// inspector. Functional only; the visual pass is PER-140.

import { type ReactNode, useState } from "react";
import type { OptionValue } from "../meta/types.js";
import type { InstanceProps, LoupeDebug } from "../runtime/debug.js";
import type { Inspection, PropRow } from "../runtime/inspect.js";
import { overridesOffNote } from "../runtime/inspect.js";
import type { PageSnapshot } from "./page.js";
import { safeInspect, safeProps } from "./page.js";
import { formatCurrent, formatDefault } from "./format.js";

type PanelProps = {
  debug: LoupeDebug;
  version: number;
  page: PageSnapshot;
  selected: string | null;
  onSelect(id: string | null): void;
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

function Inspector({ debug, id, onSelect }: PanelProps & { id: string }) {
  const inspection = safeInspect(debug, id);
  if (inspection === null) {
    return (
      <div className="card stretch">
        <h3>Not on the page now</h3>
        <p className="mono">{id}</p>
        <p className="muted">It shows here again when it mounts, for example when its menu or dialog opens.</p>
        <button type="button" onClick={() => onSelect(null)}>
          Back to the list
        </button>
      </div>
    );
  }
  const ancestors = debug.ancestors(id);
  // Overrides and held states; null for a server-rendered Instance, which gets no controls.
  const live = inspection.rendered === "client" ? safeProps(debug, id) : null;
  const instanceOverrides = Object.values(live?.sources ?? {}).filter((source) => source === "instance").length;
  const editOf = (row: PropRow): Edit | undefined => (live ? editFor(debug, id, row, live) : undefined);
  const editable = inspection.rows.filter((row) => row.editable);
  const inspectOnly = inspection.rows.filter((row) => !row.editable);
  const injected = Object.entries(inspection.injected);
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
        {live && (
          <button
            type="button"
            disabled={instanceOverrides === 0}
            onClick={() => {
              // `discard` also drops the record if the Instance unmounted meanwhile (PER-128).
              debug.discard({ scope: "instance", id });
            }}
          >
            Reset this Instance
          </button>
        )}
        <div className="mono" data-testid="instance-id">
          {inspection.id}
        </div>
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
        {editable.length === 0 ? <div className="muted">None</div> : editable.map((row) => <Row key={row.name} row={row} edit={editOf(row)} />)}
      </div>
      <div className="card stretch">
        <h3>Inspect only</h3>
        {inspectOnly.length === 0 ? <div className="muted">None</div> : inspectOnly.map((row) => <Row key={row.name} row={row} edit={editOf(row)} />)}
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

/** What a row needs to edit at This instance. */
type Edit = {
  /** An Instance-scope Override holds the prop. */
  overridden: boolean;
  override: unknown;
  /** A held State prop: `appTried` is present once the app wants another value (PER-96). */
  held?: { value: unknown; appTried?: unknown };
  set(value: unknown): void;
  reset(): void;
};

function editFor(debug: LoupeDebug, id: string, row: PropRow, live: InstanceProps): Edit {
  const overridden = live.sources[row.name] === "instance";
  const held = live.states[row.name]?.held;
  return {
    overridden,
    override: live.overrides[row.name],
    ...(held ? { held } : {}),
    set: (value) => debug.set(id, row.name, value),
    reset: () => debug.reset(id, row.name),
  };
}

/** The app's value as the row shows it: set, its default, or `not set`. */
function currentValue(row: PropRow): ReactNode {
  if (row.set) return formatCurrent(row.value);
  if (row.default) return <span className="tag">{formatDefault(row.default)}</span>;
  return <span className="muted">not set</span>;
}

/** The value the control shows as chosen: the Override, else the app's, else a known default. */
function chosen(row: PropRow, edit: Edit): unknown {
  if (edit.overridden) return edit.override;
  if (row.set) return row.value;
  if (row.default && "value" in row.default) return row.default.value;
  return undefined;
}

function Row({ row, edit }: { row: PropRow; edit?: Edit }) {
  const overridden = edit?.overridden ?? false;
  const held = edit?.held;
  const tried = held !== undefined && "appTried" in held;
  const scoped = row.source === "group" || row.source === "page";
  return (
    <div className={overridden ? "row overridden" : "row"} data-prop={row.name}>
      <div className="line">
        <span className="name">
          {row.label}
          {row.label !== row.name && <span className="mono muted"> {row.name}</span>}
        </span>
        {!overridden && <span className="value mono">{currentValue(row)}</span>}
        {row.state && <span className="tag">STATE</span>}
        {scoped && <span className="tag">{row.source} override</span>}
        {row.reason && <span className="tag">{row.reason}</span>}
        {overridden && !tried && edit && (
          <button type="button" className="reset" onClick={edit.reset}>
            Reset
          </button>
        )}
      </div>
      {row.editable && edit && <Control row={row} edit={edit} />}
      {overridden && (
        <div className="current mono" data-testid="current">
          Current: {currentValue(row)}
        </div>
      )}
      {tried && edit && (
        <div className="notice" role="status" data-testid="held">
          Your Override holds this at <code>{formatCurrent(held.value)}</code>; the app tried to set{" "}
          <code>{formatCurrent(held.appTried)}</code>.{" "}
          <button type="button" className="reset" onClick={edit.reset}>
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

/** Pills for a closed set of options; a text field for label text (PER-113). */
function Control({ row, edit }: { row: PropRow; edit: Edit }) {
  const value = chosen(row, edit);
  const [draft, setDraft] = useState<string | null>(null);
  if (row.options) {
    return (
      <div className="pills" role="group" aria-label={row.label}>
        {row.options.map((option: OptionValue) => (
          <button
            key={String(option)}
            type="button"
            aria-pressed={Object.is(value, option)}
            onClick={() => edit.set(option)}
          >
            {formatCurrent(option)}
          </button>
        ))}
      </div>
    );
  }
  // The Toolbar redraws once a frame, so the field keeps its own text while it has focus.
  return (
    <input
      className="text"
      aria-label={row.label}
      value={draft ?? (typeof value === "string" ? value : "")}
      onChange={(event) => {
        setDraft(event.target.value);
        edit.set(event.target.value);
      }}
      onBlur={() => setDraft(null)}
    />
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
