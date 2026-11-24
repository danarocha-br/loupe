// InspectOnly (ADR 0003, DESIGN.md "Inspect only"): the props an Instance shows but can't
// change here, folded to one row at the Inspector card's foot; open when nothing else on it
// can change. Folded, the row names them; one cause for them all is said once, under the
// row, instead of a tag on every row. The props the library sets fold under the rest.
//
// It draws panel-view's `InspectOnlyView` and builds no words. Each prop's row is the
// view's (`row`), as the Inspector's other rows are. See inspect-only.md.

import { type ReactNode, useState } from "react";
import type { InspectOnlyView, PropItem } from "../../panel-view/index.js";
import { Fold, FoldChevron, FoldPanel, FoldTrigger, PROP_ICONS, Row, RowLine, RowName, RowValue, Tag } from "../../ui/index.js";
import { Meta } from "../marks/marks.js";

export type InspectOnlyProps = {
  inspect: InspectOnlyView;
  /** A prop's row, as the view draws it: a PropRow `pair`. */
  row(item: PropItem): ReactNode;
};

export function InspectOnly({ inspect, row }: InspectOnlyProps) {
  const [open, setOpen] = useState(inspect.open);
  return (
    <div data-inspect-fold="">
      <Fold open={open} onOpenChange={setOpen}>
        <FoldTrigger>
          <span data-inspect-fold-glyph="" aria-hidden="true">
            {PROP_ICONS.inspect}
          </span>
          <span data-inspect-fold-title="" data-testid="inspect-only">
            {inspect.title}
            {!open && inspect.names && <span data-inspect-fold-names="">{inspect.names}</span>}
          </span>
          {inspect.meta ? <Meta>{inspect.meta}</Meta> : <span />}
          <FoldChevron />
        </FoldTrigger>
        <FoldPanel>
          {inspect.shared && (
            <p data-inspect-fold-why="">
              <Tag look="reason" title={inspect.shared.title ?? undefined}>
                {inspect.shared.reason}
              </Tag>{" "}
              {inspect.shared.title}
            </p>
          )}
          <div data-inspect-fold-rows="">{inspect.rows.length === 0 ? <div data-inspect-fold-empty="">{inspect.empty}</div> : inspect.rows.map(row)}</div>
          {inspect.injected && (
            <Fold data-inspect-fold-injected="">
              <FoldTrigger>
                <FoldChevron />
                {inspect.injected.summary}
              </FoldTrigger>
              <FoldPanel>
                {inspect.injected.rows.map((injected) => (
                  <Row look="pair" key={injected.name}>
                    <RowLine>
                      <RowName>{injected.name}</RowName>
                      <RowValue>{injected.value}</RowValue>
                    </RowLine>
                  </Row>
                ))}
              </FoldPanel>
            </Fold>
          )}
        </FoldPanel>
      </Fold>
    </div>
  );
}
