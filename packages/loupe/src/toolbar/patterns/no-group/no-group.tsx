// NoGroup (ADR 0003, DESIGN.md "Scope (Select multiple)"): Select multiple, on an Instance
// with no call site to group by. It is selected alone, and says why; the page is still one
// press away when that scope applies (ScopeSection's move button).
//
// It draws panel-view's `NoGroupView` and builds none: the move goes out through `onScope`.
// See no-group.md.

import type { NoGroupView, Scope } from "../../panel-view/index.js";
import { ScopeMoveButton } from "../scope-section/scope-section.js";

export type NoGroupProps = {
  noGroup: NoGroupView;
  /** The move pressed: widen the selection to this scope. */
  onScope(scope: Scope): void;
};

export function NoGroup({ noGroup, onScope }: NoGroupProps) {
  return (
    <div data-no-group="">
      <span data-no-group-why="">{noGroup.text}</span>
      {noGroup.widen && <ScopeMoveButton move={noGroup.widen} onScope={onScope} />}
    </div>
  );
}
