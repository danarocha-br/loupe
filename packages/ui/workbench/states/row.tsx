import { useState } from "react";
import { Button, Card, CardHead, PROP_ICONS, ResetIcon, Row, RowAction, RowLine, RowName, RowValue, Switch, Tag } from "../../src/index.js";
import { Frame, States } from "./frame.js";

/** Row's four looks, each in the card it is made for, and its parts: a glyph, a code name, a mono name, a value, an action. */
export function RowStates() {
  const [on, setOn] = useState(false);
  return (
    <States>
      <Frame title="Inset, in a divided card: a glyph, a name and its code name, an action">
        <Card look="divided">
          <Row glyph={PROP_ICONS.text}>
            <RowLine>
              <RowName code="children">Label</RowName>
              <RowAction>
                <Button size="small">
                  <ResetIcon />
                  Reset
                </Button>
              </RowAction>
            </RowLine>
          </Row>
          <Row glyph={PROP_ICONS.off}>
            <RowLine>
              <RowName code="disabled">Disabled</RowName>
              <RowAction>
                <Switch label="Disabled" checked={on} onCheckedChange={setOn} />
              </RowAction>
            </RowLine>
          </Row>
          <Row>
            <RowLine>
              <RowName>No glyph: the text from the row's own edge</RowName>
              <RowValue>12</RowValue>
            </RowLine>
          </Row>
        </Card>
      </Frame>
      <Frame title="Ruled, in a plain card: a mono name, a value at the line's right">
        <Card>
          <CardHead>
            <h3>Ruled rows</h3>
          </CardHead>
          <Row look="ruled">
            <RowLine>
              <RowName mono>showBetaFeature</RowName>
              <RowValue>true</RowValue>
            </RowLine>
          </Row>
          <Row look="ruled">
            <RowLine>
              <RowName mono>checkoutVariant</RowName>
              <Tag look="dashed">Not visible now</Tag>
              <RowValue>"b"</RowValue>
            </RowLine>
            <p className="wb-note">What is under the line, 8px apart.</p>
          </Row>
        </Card>
      </Frame>
      <Frame title="Pair: two mono columns, the code name left to the tooltip">
        <Card>
          <Row look="pair">
            <RowLine>
              <RowName code="aria-label">aria-label</RowName>
              <RowValue>"More actions"</RowValue>
            </RowLine>
          </Row>
          <Row look="pair">
            <RowLine>
              <RowName>a-much-longer-name-than-its-column</RowName>
              <RowValue>ƒ handleSelect</RowValue>
            </RowLine>
          </Row>
        </Card>
      </Frame>
      <Frame title="Item, in a list card: edge to edge, a line under the name">
        <Card look="list">
          <CardHead>
            <h3>Items</h3>
          </CardHead>
          <ul className="wb-list">
            <Row as="li" look="item">
              Dialog
              <span className="wb-note">A line under the name, 2px apart.</span>
            </Row>
            <Row as="li" look="item">
              Tooltip
            </Row>
          </ul>
        </Card>
      </Frame>
    </States>
  );
}
