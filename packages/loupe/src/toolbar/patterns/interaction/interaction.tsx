// AppearsOnInteraction (ADR 0003, DESIGN.md "On this page"): the components seen on this page
// that have no Instance mounted now, such as a menu's items or a dialog's parts. A row each:
// its name, and how to get it on screen to inspect it.
//
// It draws panel-view's component names and `ListWords`, and builds none. See interaction.md.

import type { ListWords } from "../../panel-view/index.js";
import { Card, CardHead, Row } from "../../ui/index.js";
import { Meta } from "../marks/marks.js";

export type AppearsOnInteractionProps = {
  components: readonly string[];
  words: Pick<ListWords, "interaction">;
};

export function AppearsOnInteraction({ components, words }: AppearsOnInteractionProps) {
  if (components.length === 0) return null;
  return (
    <Card look="list" data-interaction="">
      <CardHead>
        <h3>{words.interaction.title}</h3>
        <Meta>{words.interaction.meta}</Meta>
      </CardHead>
      <ul data-interaction-list="" aria-label={words.interaction.title}>
        {components.map((component) => (
          <Row key={component} as="li" look="item">
            {component}
            <span data-interaction-seen="">{words.interaction.seen}</span>
          </Row>
        ))}
      </ul>
    </Card>
  );
}
