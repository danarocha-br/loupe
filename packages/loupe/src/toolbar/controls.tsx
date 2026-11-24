// A prop row's writes (PER-131, PER-134, PER-137): PropRow (patterns/prop-row/) draws the
// row `panelView()` decided; this file gives it the runtime's calls. A chip or a switch
// sets its value, label text is kept to one line as it is typed (the runtime's rule, which
// the field shows too), Reset drops the prop's
// Override, and "1 of 4 keeps its own value" selects the one it names.

import type { LoupeDebug } from "../runtime/debug.js";
import { singleLine } from "../runtime/label-text.js";
import { INSPECTOR_WORDS, type PropItem } from "./panel-view/index.js";
import { PropRow } from "./patterns/index.js";
import type { SelectMode } from "./picker.js";
import type { RowLook } from "./ui/index.js";

/**
 * The Instance can unmount between a frame and a click (its menu closes, say). The
 * write is then dropped, and the next frame shows "Not on the page now".
 */
export function attempt(write: () => void): void {
  try {
    write();
  } catch {
    // Nothing to write to any more.
  }
}

export function PropRowView({
  item,
  look,
  debug,
  onSelect,
  onHover,
}: {
  item: PropItem;
  /** `inset` in the Inspector's card; `pair` under Inspect only, name and value side by side. */
  look?: RowLook;
  debug: LoupeDebug;
  onSelect(id: string, mode?: SelectMode): void;
  onHover(ids: string[]): void;
}) {
  return (
    <PropRow
      item={item}
      words={INSPECTOR_WORDS}
      look={look}
      onSet={(write, value) => attempt(() => debug.set(write.id, write.prop, value, write.scope))}
      onText={(write, text) => attempt(() => debug.set(write.id, write.prop, text, write.scope))}
      oneLine={singleLine}
      onReset={(write) => attempt(() => debug.reset(write.id, write.prop, write.scope))}
      onSelect={(id) => onSelect(id, "one")}
      onHover={onHover}
    />
  );
}
