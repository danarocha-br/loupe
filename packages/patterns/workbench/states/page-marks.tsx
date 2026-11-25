import { Frame, States } from "@loupe/ui/workbench";
import { ChangeOutline, PageOutline, PickTag } from "../../src/index.js";
import { CHANGE_OUTLINE, OUTLINES, PICK_OUTLINE, PICK_TAG, WORDS } from "../../src/samples.js";

/** The page's marks, in a stage that stands in for the app's page: the selection and what it reaches, picking, a change. */
export function PageMarksStates() {
  return (
    <States>
      <Frame title="The selection tagged with its size, two it reaches, one left out">
        <div className="wb-stage wb-stage-page">
          {OUTLINES.map(({ key, ...outline }) => (
            <PageOutline key={key} {...outline} box={{ ...outline.box, left: 180 }} />
          ))}
        </div>
      </Frame>
      <Frame title="Picking, with its tag; a change's outline; the size tag below and from the start">
        <div className="wb-stage wb-stage-page">
          <PageOutline {...PICK_OUTLINE} box={{ ...PICK_OUTLINE.box, top: 44 }} />
          <PickTag {...PICK_TAG} place={{ top: 18, left: 24 }} words={WORDS.outline} />
          <ChangeOutline {...CHANGE_OUTLINE} box={{ ...CHANGE_OUTLINE.box, top: 120 }} quiet={false} />
          <PageOutline kind="ring" box={{ top: 6, left: 210, width: 38, height: 38 }} quiet={false} tag={{ text: "Button · 32 × 32", below: true, start: false }} />
          <PageOutline kind="ring" box={{ top: 150, left: 6, width: 38, height: 38 }} quiet={false} tag={{ text: "Button · 32 × 32", below: false, start: true }} />
        </div>
      </Frame>
    </States>
  );
}
