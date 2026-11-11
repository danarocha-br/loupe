// The panel of the 2e sketch: pinned header and footer, a scrolling middle whose
// last card stretches, and either the component list (nothing selected) or the
// inspector. Functional only; the visual pass is PER-140.

import type { ReactNode } from "react";
import type { LoupeDebug } from "../runtime/debug.js";
import type { Inspection, PropRow } from "../runtime/inspect.js";
import { overridesOffNote } from "../runtime/inspect.js";
import type { PageSnapshot } from "./page.js";
import { safeInspect } from "./page.js";
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
        {editable.length === 0 ? <div className="muted">None</div> : editable.map((row) => <Row key={row.name} row={row} />)}
      </div>
      <div className="card stretch">
        <h3>Inspect only</h3>
        {inspectOnly.length === 0 ? <div className="muted">None</div> : inspectOnly.map((row) => <Row key={row.name} row={row} />)}
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

function Row({ row }: { row: PropRow }) {
  let value: ReactNode;
  if (row.set) value = formatCurrent(row.value);
  else if (row.default) value = <span className="tag">{formatDefault(row.default)}</span>;
  else value = <span className="muted">not set</span>;
  return (
    <div className="row" data-prop={row.name}>
      <span className="name">
        {row.label}
        {row.label !== row.name && <span className="mono muted"> {row.name}</span>}
      </span>
      <span className="value mono">{value}</span>
      {row.state && <span className="tag">State</span>}
      {row.reason && <span className="tag">{row.reason}</span>}
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
