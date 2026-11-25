// Every pattern the workbench draws: its folder in `src/`, its name, its `.md` (states, ARIA
// and keys) and its states. `patterns.test.tsx` fails when a folder with a `.md` has no entry
// here, so a new pattern comes with its workbench page. Each is drawn bare, on the panel's
// ground, as the Toolbar draws it: a pattern that is a card brings its own, and one that sits in
// the Inspector's divided card draws that card in its states.

import type { Page } from "@loupe/ui/workbench";
import CHANGE_LIST_MD from "../src/change-list/change-list.md?raw";
import COMMAND_MD from "../src/command/command.md?raw";
import COPY_FLOW_MD from "../src/copy-flow/copy-flow.md?raw";
import FLAGS_CARD_MD from "../src/flags-card/flags-card.md?raw";
import FOOTER_MD from "../src/footer/footer.md?raw";
import GROUP_ROW_MD from "../src/group-row/group-row.md?raw";
import HEADER_MD from "../src/header/header.md?raw";
import HELD_FOR_REVIEW_MD from "../src/held-for-review/held-for-review.md?raw";
import IDENTITY_MD from "../src/identity/identity.md?raw";
import INSPECT_ONLY_MD from "../src/inspect-only/inspect-only.md?raw";
import INTERACTION_MD from "../src/interaction/interaction.md?raw";
import LAUNCHER_MD from "../src/launcher/launcher.md?raw";
import LEGEND_MD from "../src/legend/legend.md?raw";
import MARKS_MD from "../src/marks/marks.md?raw";
import NO_GROUP_MD from "../src/no-group/no-group.md?raw";
import NOTICE_MD from "../src/notice/notice.md?raw";
import ON_THIS_PAGE_MD from "../src/on-this-page/on-this-page.md?raw";
import PAGE_MAP_MD from "../src/page-map/page-map.md?raw";
import PAGE_MARKS_MD from "../src/page-marks/page-marks.md?raw";
import PROP_ROW_MD from "../src/prop-row/prop-row.md?raw";
import SCOPE_SECTION_MD from "../src/scope-section/scope-section.md?raw";
import SHEET_MD from "../src/sheet/sheet.md?raw";
import SITE_CARD_MD from "../src/site-card/site-card.md?raw";
import START_CARD_MD from "../src/start-card/start-card.md?raw";
import { ChangeListStates } from "./states/change-list.js";
import { CommandStates } from "./states/command.js";
import { CopyFlowStates } from "./states/copy-flow.js";
import { FlagsCardStates } from "./states/flags-card.js";
import { FooterStates } from "./states/footer.js";
import { GroupRowStates } from "./states/group-row.js";
import { HeaderStates } from "./states/header.js";
import { HeldForReviewStates } from "./states/held-for-review.js";
import { IdentityStates } from "./states/identity.js";
import { InspectOnlyStates } from "./states/inspect-only.js";
import { InteractionStates } from "./states/interaction.js";
import { LauncherStates } from "./states/launcher.js";
import { LegendStates } from "./states/legend.js";
import { MarksStates } from "./states/marks.js";
import { NoGroupStates } from "./states/no-group.js";
import { NoticeStates } from "./states/notice.js";
import { OnThisPageStates } from "./states/on-this-page.js";
import { PageMapStates } from "./states/page-map.js";
import { PageMarksStates } from "./states/page-marks.js";
import { PropRowStates } from "./states/prop-row.js";
import { ScopeSectionStates } from "./states/scope-section.js";
import { SheetStates } from "./states/sheet.js";
import { SiteCardStates } from "./states/site-card.js";
import { StartCardStates } from "./states/start-card.js";

/** In the order DESIGN.md's Layers lists them: the Inspector's, the list's, the notices and the flags, the panel's chrome, the shell, the page's marks, and the marks they share. */
export const PATTERNS: Page[] = [
  { id: "identity", name: "Identity", doc: IDENTITY_MD, States: IdentityStates, bare: true },
  { id: "scope-section", name: "ScopeSection", doc: SCOPE_SECTION_MD, States: ScopeSectionStates, bare: true },
  { id: "prop-row", name: "PropRow", doc: PROP_ROW_MD, States: PropRowStates, bare: true },
  { id: "legend", name: "Legend", doc: LEGEND_MD, States: LegendStates, bare: true },
  { id: "inspect-only", name: "InspectOnly", doc: INSPECT_ONLY_MD, States: InspectOnlyStates, bare: true },
  { id: "no-group", name: "NoGroup", doc: NO_GROUP_MD, States: NoGroupStates, bare: true },
  { id: "start-card", name: "StartCard", doc: START_CARD_MD, States: StartCardStates, bare: true },
  { id: "held-for-review", name: "HeldForReview", doc: HELD_FOR_REVIEW_MD, States: HeldForReviewStates, bare: true },
  { id: "change-list", name: "ChangeList", doc: CHANGE_LIST_MD, States: ChangeListStates, bare: true },
  { id: "on-this-page", name: "OnThisPage", doc: ON_THIS_PAGE_MD, States: OnThisPageStates, bare: true },
  { id: "page-map", name: "PageMap", doc: PAGE_MAP_MD, States: PageMapStates, bare: true },
  { id: "group-row", name: "GroupRow", doc: GROUP_ROW_MD, States: GroupRowStates, bare: true },
  { id: "site-card", name: "SiteCard", doc: SITE_CARD_MD, States: SiteCardStates, bare: true },
  { id: "interaction", name: "AppearsOnInteraction", doc: INTERACTION_MD, States: InteractionStates, bare: true },
  { id: "notice", name: "Notice", doc: NOTICE_MD, States: NoticeStates, bare: true },
  { id: "command", name: "CommandLine", doc: COMMAND_MD, States: CommandStates, bare: true },
  { id: "flags-card", name: "FlagsCard", doc: FLAGS_CARD_MD, States: FlagsCardStates, bare: true },
  { id: "header", name: "PanelHeader", doc: HEADER_MD, States: HeaderStates, bare: true },
  { id: "footer", name: "PanelFooter", doc: FOOTER_MD, States: FooterStates, bare: true },
  { id: "copy-flow", name: "Copy Proposal", doc: COPY_FLOW_MD, States: CopyFlowStates, bare: true },
  { id: "launcher", name: "LauncherPill", doc: LAUNCHER_MD, States: LauncherStates, bare: true },
  { id: "sheet", name: "Sheet", doc: SHEET_MD, States: SheetStates, bare: true },
  { id: "page-marks", name: "Page marks", doc: PAGE_MARKS_MD, States: PageMarksStates, bare: true },
  { id: "marks", name: "Marks", doc: MARKS_MD, States: MarksStates, bare: true },
];
