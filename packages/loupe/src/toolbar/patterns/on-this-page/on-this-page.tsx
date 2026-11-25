// OnThisPage (ADR 0003, DESIGN.md "On this page"): the list's main card. "On this page" with
// its count, the page map flush under the head, then a row per component, most used first.
//
// It lays out what the view gives it, the map (PageMap) and the rows (GroupRow), so the view
// composes the two and measures the page for the map; it draws `ListWords` and builds none.
// See on-this-page.md.

import type { ReactNode } from "react";
import type { ListWords } from "../view.js";
import { Card, CardHead } from "@loupe/ui";
import { Meta } from "../marks/marks.js";

export type OnThisPageProps = {
  words: Pick<ListWords, "onPage">;
  /** "9 components · 43 Instances". */
  summary: string;
  /** The page map, or nothing while nothing has a box. */
  map: ReactNode;
  /** A GroupRow per component, most used first. */
  children: ReactNode;
};

export function OnThisPage({ words, summary, map, children }: OnThisPageProps) {
  return (
    <Card look="list" data-on-this-page="">
      <CardHead>
        <h3>{words.onPage.title}</h3>
        <Meta>{summary}</Meta>
      </CardHead>
      {map}
      <ul data-on-this-page-rows="" aria-label={words.onPage.rows}>
        {children}
      </ul>
    </Card>
  );
}
