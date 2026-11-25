import { useState } from "react";
import { Button, Card, CardHead, Chip, ChipGroup, Delta, Dot, InfoIcon, PROP_ICONS, ResetIcon, Row, RowAction, RowLine, RowName, RowValue, Switch, Tag } from "../../src/index.js";
import { Frame, States } from "../shell/frame.js";

const SIZES = ["sm", "md", "lg"];

/** Card's three looks, each with the rows it is made for: divided, list and plain. */
export function CardStates() {
  const [open, setOpen] = useState(true);
  return (
    <States>
      <Frame title="Divided: parts on hairlines, inset rows on a 20px glyph column">
        <Card look="divided">
          <Row glyph={PROP_ICONS.size}>
            <RowLine>
              <Delta n={2} label="Change 2" />
              <RowName code="size">Size</RowName>
              <RowAction>
                <Button size="small">
                  <ResetIcon />
                  Reset
                </Button>
              </RowAction>
            </RowLine>
            <ChipGroup label="Size" value="md" onChoose={() => {}}>
              {SIZES.map((size) => (
                <Chip key={size} value={size}>
                  {size}
                </Chip>
              ))}
            </ChipGroup>
          </Row>
          <Row glyph={PROP_ICONS.variant}>
            <RowLine>
              <RowName code="accessibilityLabelWhenCollapsed">A much longer label that wraps between its words</RowName>
              <Tag look="reason">set by the library</Tag>
              <RowValue>"ghost"</RowValue>
            </RowLine>
          </Row>
          <Row glyph={PROP_ICONS.state}>
            <RowLine>
              <RowName>open</RowName>
              <Tag>State prop</Tag>
              <RowAction>
                <Switch label="open" checked={open} onCheckedChange={setOpen} />
              </RowAction>
            </RowLine>
          </Row>
          <Row glyph={<InfoIcon />} role="note">
            <div className="wb-note-text">
              <h3>Rendered on the server</h3>
              <p>Its props can't change here. A note is a Row, not a card on a card.</p>
            </div>
          </Row>
          <div className="wb-pairs">
            <Row look="pair">
              <RowLine>
                <RowName code="aria-label">aria-label</RowName>
                <RowValue>"More actions"</RowValue>
              </RowLine>
            </Row>
            <Row look="pair">
              <RowLine>
                <RowName>onSelect</RowName>
                <RowValue>ƒ handleSelect</RowValue>
              </RowLine>
            </Row>
          </div>
        </Card>
      </Frame>
      <Frame title="List, with item rows: edge to edge on their hairline, the text 14px in">
        <Card look="list">
          <CardHead>
            <h3>Appears on interaction</h3>
            <span className="wb-note">Not on screen yet</span>
          </CardHead>
          <ul className="wb-list">
            <Row as="li" look="item">
              Dialog
              <span className="wb-note">A line under the name, 2px apart.</span>
            </Row>
            <Row as="li" look="item">
              Tooltip
              <span className="wb-note">A line under the name, 2px apart.</span>
            </Row>
          </ul>
        </Card>
      </Frame>
      <Frame title="Plain, with ruled rows: a name in mono, a value, an action">
        <Card>
          <CardHead>
            <h3>Feature flags</h3>
            <span className="wb-note">2 declared · 1 previewing</span>
          </CardHead>
          <Row look="ruled">
            <RowLine>
              <Dot tone="lilac" small />
              <RowName mono>showBetaFeature</RowName>
              <RowAction>
                <Button size="small">
                  <ResetIcon />
                  Clear
                </Button>
              </RowAction>
            </RowLine>
            <p className="wb-note">Previewing On</p>
          </Row>
          <ul className="wb-list">
            <Row as="li" look="ruled">
              <RowLine>
                <span>Button, ButtonGroup, ButtonGroupSeparator</span>
                <RowValue title="ui/button.tsx">ui/button.tsx</RowValue>
              </RowLine>
            </Row>
          </ul>
        </Card>
      </Frame>
      <Frame title="Plain, a head alone">
        <Card>
          <CardHead>
            <h3>A card</h3>
            <span className="wb-note">3</span>
          </CardHead>
        </Card>
      </Frame>
    </States>
  );
}
