// Sample panel-view data for the patterns: what `panelView()` would hand them for a
// MemberRowMenu Button on /billing, at This instance and at its call site, and for the
// list of /billing with nothing selected. The patterns' tests draw it, and so does the
// fixture's `/workbench` page, beside the words (panel-view's `INSPECTOR_WORDS` and
// `LIST_WORDS`, which the caller passes). Data only: no words a pattern would draw by
// itself, and nothing that writes.

import type {
  CallSiteItem,
  ChangeItem,
  FlagsCardView,
  GroupItem,
  IdentityView,
  InspectOnlyView,
  InstanceItem,
  ListBody,
  MembersView,
  NoGroupView,
  NoticeView,
  PropItem,
  StatusTag,
  Tag,
  Write,
} from "../panel-view/index.js";
import type { MapBox } from "./page-map/page-map.js";

const ID = "app/billing/member-row-menu.tsx › MemberRowMenu › Button[1]#caio";
const write = (prop: string, scope: Write["scope"] = "instance"): Write => ({ id: ID, prop, scope });

/** A row with nothing on it but its name: each sample says only what it is about. */
const base = (name: string, glyph: PropItem["glyph"]): PropItem => ({
  name,
  glyph,
  label: name,
  codeName: null,
  dot: "off",
  overridden: false,
  state: false,
  empty: false,
  value: null,
  counts: null,
  reason: null,
  reasonTitle: null,
  explanation: null,
  key: null,
  change: null,
  source: null,
  wider: false,
  control: null,
  current: null,
  held: null,
  reset: null,
  keeping: null,
});

const options = (prop: string, values: string[], pressed: string, extra: { isDefault?: string; scope?: Write["scope"]; counts?: Record<string, number> } = {}) => ({
  kind: "options" as const,
  key: extra.scope ?? "instance",
  write: write(prop, extra.scope),
  options: values.map((value) => ({
    value,
    label: `"${value}"`,
    pressed: value === pressed,
    count: extra.counts ? (extra.counts[value] ?? 0) : null,
    isDefault: value === extra.isDefault,
  })),
});

/** Overridden here: change 2, from "ghost" to "outline", with the app's value ringed and the default dotted. */
export const VARIANT: PropItem = {
  ...base("variant", "variant"),
  label: "variant",
  dot: "on",
  overridden: true,
  key: 2,
  change: { from: '"ghost"', to: '"outline"' },
  source: "from This instance",
  control: options("variant", ["solid", "ghost", "outline", "link"], "outline", { isDefault: "solid" }),
  current: null,
  reset: { label: "Reset", write: write("variant"), inNotice: false },
};

/** The app's own value, from a group Override: its change line names where it comes from. */
export const SIZE: PropItem = {
  ...base("size", "size"),
  dot: "off",
  key: 1,
  change: { from: '"md"', to: '"sm"' },
  source: "from All in MemberRowMenu",
  wider: true,
  control: options("size", ["sm", "md", "lg"], "sm"),
};

/** A true/false prop: a switch at the line's end. */
export const DISABLED: PropItem = {
  ...base("disabled", "off"),
  control: {
    kind: "options",
    key: "instance",
    write: write("disabled"),
    options: [
      { value: true, label: "true", pressed: false, count: null, isDefault: false },
      { value: false, label: "false", pressed: true, count: null, isDefault: true },
    ],
  },
};

/** Label text, left empty under an Override. */
export const CHILDREN: PropItem = {
  ...base("children", "text"),
  label: "Text",
  codeName: "children",
  dot: "on",
  overridden: true,
  empty: true,
  key: 3,
  change: { from: '"Remove"', to: '""' },
  source: "from This instance",
  control: { kind: "text", key: "instance", write: write("children"), value: "" },
  reset: { label: "Reset", write: write("children"), inNotice: false },
};

/** A State prop the app tried to close while an Override holds it open: the notice carries Reset. */
export const OPEN: PropItem = {
  ...base("open", "state"),
  dot: "on",
  overridden: true,
  state: true,
  control: { kind: "refused", refusal: "state-only", text: "A State prop changes per Instance." },
  current: { kind: "set", text: "false" },
  held: {
    before: "Your Override holds this at",
    value: "true",
    middle: "; the app tried to set",
    tried: "false",
    after: ".",
    text: "Your Override holds this at true; the app tried to set false.",
  },
  reset: { label: "Reset", write: write("open"), inNotice: true },
};

/** At a scope: the members differ, and one keeps its own value. */
export const TONE_AT_SCOPE: PropItem = {
  ...base("tone", "variant"),
  counts: "2 neutral · 2 danger",
  source: "from the app",
  control: options("tone", ["neutral", "danger"], "", { scope: "group", counts: { neutral: 2, danger: 2 } }),
  keeping: { text: "1 of 4 keeps its own value", ids: ["dani"], select: "dani" },
};

/** Inspect only, in a pair: the value, and why it can't change here. */
export const TYPE_INSPECT_ONLY: PropItem = {
  ...base("type", "other"),
  dot: null,
  value: { kind: "default", text: '"button"' },
  reason: "set by the library",
  reasonTitle: "The library sets it on every Button.",
};

export const PROP_ITEMS: readonly PropItem[] = [VARIANT, SIZE, CHILDREN, DISABLED, OPEN];

const SUPPORTED: StatusTag = { kind: "supported", text: "Supported" };
const NOT_VISIBLE: Tag = { kind: "not-visible", text: "Not visible now" };

/** The Inspector's identity for that Button: everything panel-view decides for the block. */
export const IDENTITY: IdentityView = {
  component: "Button",
  page: "Billing",
  status: SUPPORTED,
  keys: [1, 2, 3],
  name: "Remove Caio from the workspace",
  nameTitle: "Remove Caio from the workspace",
  ownName: true,
  where: { file: "member-row-menu.tsx", line: ":37 · use 2 of 3" },
  whereTitle: `app/billing/member-row-menu.tsx:37\n${ID}`,
  id: ID,
  note: null,
  tags: [NOT_VISIBLE],
  chips: ["Also in All on page"],
  held: null,
  notGenerated: null,
  crumbs: [
    { id: "menu", label: "MemberRowMenu" },
    { id: "row", label: "MemberRow" },
    { id: "list", label: "MembersList" },
  ],
};

/** The same Button once it is gone: its call site, and what it still holds. The view adds Reset this Instance. */
export const GONE: IdentityView = {
  component: null,
  page: null,
  status: { text: "Not on the page now" },
  keys: [],
  name: "Button",
  nameTitle: ID,
  ownName: false,
  where: "member-row-menu.tsx:37",
  whereTitle: ID,
  id: null,
  note: "It shows here again when it mounts. To keep a menu or dialog open, select it and press Hold open.",
  tags: [{ kind: "not-mounted", text: "No Instance mounted" }],
  chips: [],
  held: ['variant "outline"', 'children ""'],
  notGenerated: null,
  crumbs: [],
};

/** The same Button, never generated: the warning says what to run. */
export const NOT_GENERATED: StatusTag = { kind: "not-generated", text: "Not generated yet" };

const member = (id: string, name: string, out = false): MembersView["members"][number] => ({
  id,
  label: id,
  name,
  out,
  tag: out ? { kind: "left-out", text: "Left out" } : null,
  toggle: out ? "include" : "exclude",
});

/** Its call site's scope: four Instances, one left out, and the page has three more. */
export const MEMBERS: MembersView = {
  scope: "group",
  name: "All in MemberRowMenu",
  nameTitle: null,
  instancesText: "4 Instances",
  widen: { scope: "page", text: "Widen to All on page · 7", title: "All on page · 7" },
  countText: "3 of 4 previewed",
  reach: { lead: "Reaches", included: 3, total: 4, page: 7, moreText: "3 more on this page", countText: "3 of 4" },
  suspended: false,
  members: [member("ana", "Remove Ana"), member("bia", "Remove Bia"), member(ID, "Remove Caio"), member("dani", "Remove Dani", true)],
  sites: null,
  server: [],
  outUnmounted: [],
  reset: { target: { scope: "group", anchor: "app/billing/member-row-menu.tsx:37" }, enabled: true },
};

/** The page's scope: its Instances by call site, one server-rendered. */
export const PAGE_MEMBERS: MembersView = {
  ...MEMBERS,
  scope: "page",
  name: "All on page",
  instancesText: "6 Instances",
  widen: { scope: "group", text: "Narrow to All in MemberRowMenu · 4", title: "All in MemberRowMenu · 4" },
  reach: { lead: "Reaches", included: 6, total: 6, page: 7, moreText: null, countText: "6 of 6" },
  members: [...MEMBERS.members.slice(0, 3), member("eva", "Invite"), member("fia", "Cancel"), member("gil", "Save")],
  sites: [
    {
      anchor: "app/billing/member-row-menu.tsx:37",
      label: "member-row-menu.tsx:37",
      count: 3,
      allIn: true,
      members: MEMBERS.members.slice(0, 3),
      toggle: { action: "exclude", ids: MEMBERS.members.slice(0, 3).map((one) => one.id) },
    },
    {
      anchor: "app/billing/invite-form.tsx:12",
      label: "invite-form.tsx:12",
      count: 3,
      allIn: true,
      members: [member("eva", "Invite"), member("fia", "Cancel"), member("gil", "Save")],
      toggle: { action: "exclude", ids: ["eva", "fia", "gil"] },
    },
  ],
  server: [{ id: "footer", label: "Footer Button", tag: { kind: "server", text: "On the server" } }],
  reset: { target: { scope: "page", route: "/billing", component: "Button" }, enabled: false },
};

// ── The list ───────────────────────────────────────────────────────────────

/** A mounted Instance as the list holds it: its block on the map named "Inspect Button 2 of 3, Ana Souza". */
const mounted = (component: string, id: string, label: string, name: string | null, nth: number, of: number, keys: number[] = []): InstanceItem => ({
  id,
  label,
  name,
  keys,
  mounted: true,
  tags: [],
  values: [],
  block: { lead: `Inspect ${component} ${nth} of ${of}, `, who: name ?? label, own: name !== null },
});

const site = (anchor: string, label: string, instances: { id: string; label: string }[], supported = true): CallSiteItem => {
  const names = instances.length > 2 ? `${instances[0]?.label}, ${instances[1]?.label} +${instances.length - 2}` : instances.map((one) => one.label).join(", ");
  return {
    anchor,
    label,
    names,
    ids: instances.map((one) => one.id),
    inspect: `Inspect ${label}: ${names}`,
    instances: instances.map((one) => ({ ...one, inspect: `Inspect ${one.label}` })),
    select: instances[0]?.id ?? "",
    supported,
  };
};

const BUTTONS = [
  mounted("Button", "ana", "member-row-menu.tsx:37#ana", "Actions for Ana Souza", 1, 6, [1]),
  mounted("Button", "bia", "member-row-menu.tsx:37#bia", "Actions for Bia Costa", 2, 6),
  mounted("Button", "caio", "member-row-menu.tsx:37#caio", "Actions for Caio Prado", 3, 6),
  mounted("Button", "dani", "member-row-menu.tsx:37#dani", "Actions for Dani Reis", 4, 6),
  mounted("Button", "eva", "invite-form.tsx:12#eva", null, 5, 6),
  mounted("Button", "fia", "invite-form.tsx:12#fia", "Resend to fia@example.com", 6, 6),
];

/** An Instance as its call site's card names it: what it shows on screen, else its call site and key. */
const onScreen = (item: InstanceItem) => ({ id: item.id, label: item.name ?? item.label });

/** The most used component on /billing: six Buttons from two call sites, one of them changed. */
export const BUTTON_GROUP: GroupItem = {
  component: "Button",
  count: "×6",
  mountedCount: 6,
  share: 1,
  inspectOnly: false,
  sitesText: "2 call sites · pick one to inspect",
  sites: [
    site("app/billing/member-row-menu.tsx › MemberRowMenu › Button[1]", "member-row-menu.tsx:37", BUTTONS.slice(0, 4).map(onScreen)),
    site("app/billing/invite-form.tsx › InviteForm › Button[1]", "invite-form.tsx:12", BUTTONS.slice(4).map(onScreen)),
  ],
  verdict: { supported: true, status: SUPPORTED },
  statusTitle: null,
  notes: [{ kind: "overrides", text: "1 Instance changed" }],
  outlineIds: BUTTONS.map((one) => one.id),
  instances: BUTTONS,
  hue: 0,
  mapTitle: "Button ×6",
};

/** A menu's items, never generated: one is mounted, the other holds an Override and has gone. */
export const MENU_ITEM_GROUP: GroupItem = {
  component: "DropdownMenuItem",
  count: "×1",
  mountedCount: 1,
  share: 1 / 6,
  inspectOnly: true,
  sitesText: "1 call site · pick it to inspect",
  sites: [site("app/billing/member-row-menu.tsx › MemberRowMenu › DropdownMenuItem[1]", "member-row-menu.tsx:41", [{ id: "item-1", label: "Change role" }], false)],
  verdict: { supported: false, reason: "not-generated", reasonText: "Not generated yet", status: NOT_GENERATED },
  statusTitle: "npx loupe generate",
  notes: [
    { kind: "stale", text: "Source changed" },
    { kind: "not-mounted", text: "1 not mounted" },
  ],
  outlineIds: ["item-1"],
  instances: [
    mounted("DropdownMenuItem", "item-1", "member-row-menu.tsx:41#m1", "Change role", 1, 1),
    {
      id: "item-2",
      label: "member-row-menu.tsx:42#m1",
      name: null,
      keys: [2],
      mounted: false,
      tags: [{ kind: "not-mounted", text: "No Instance mounted" }],
      values: ['children "Remover" · Current "Remove" (last seen)'],
      block: null,
    },
  ],
  hue: 1,
  mapTitle: "DropdownMenuItem ×1",
};

/** The card's count: "2 components · 7 Instances". */
export const LIST_SUMMARY = "2 components · 7 Instances";

/** Every component on /billing, most used first. */
export const LIST_GROUPS: readonly GroupItem[] = [BUTTON_GROUP, MENU_ITEM_GROUP];

/** Where those Instances sit on the page, for the map: the menu's item over the second row. */
export const LIST_BOXES: ReadonlyMap<string, MapBox> = new Map([
  ["ana", { left: 680, top: 96, width: 32, height: 32 }],
  ["bia", { left: 680, top: 152, width: 32, height: 32 }],
  ["caio", { left: 680, top: 208, width: 32, height: 32 }],
  ["dani", { left: 680, top: 264, width: 32, height: 32 }],
  ["eva", { left: 680, top: 380, width: 32, height: 32 }],
  ["fia", { left: 560, top: 380, width: 110, height: 32 }],
  ["item-1", { left: 560, top: 132, width: 152, height: 30 }],
]);

/** The page map's own sample: two components, the reading order btn-1, btn-2, btn-3, card. */
export const MAP_GROUPS: readonly GroupItem[] = [
  {
    ...BUTTON_GROUP,
    count: "×3",
    mapTitle: "Button ×3",
    instances: [
      mounted("Button", "btn-1", "members.tsx:btn-1", "Ana Souza", 1, 3),
      mounted("Button", "btn-2", "members.tsx:btn-2", "Bruno Lima", 2, 3),
      mounted("Button", "btn-3", "members.tsx:btn-3", null, 3, 3),
    ],
  },
  { ...BUTTON_GROUP, component: "Card", count: "×1", mapTitle: "Card ×1", hue: 1, instances: [mounted("Card", "card-1", "members.tsx:card-1", "Team", 1, 1)] },
];

/** Where the map's sample sits: the largest first in the DOM puts the card first there. */
export const MAP_BOXES: ReadonlyMap<string, MapBox> = new Map([
  ["btn-1", { left: 0, top: 0, width: 40, height: 20 }],
  ["btn-2", { left: 60, top: 0, width: 40, height: 20 }],
  ["btn-3", { left: 0, top: 40, width: 100, height: 30 }],
  ["card-1", { left: 0, top: 90, width: 200, height: 100 }],
]);

/** Records Suspended for review: a call site whose total changed, and an id that names two Instances. */
export const HELD: ListBody["suspended"] = [
  {
    target: { scope: "group", anchor: "app/billing/invite-form.tsx › InviteForm › Button[1]" },
    label: "All from invite-form.tsx › InviteForm › Button[1]",
    why: "Code changed here: this call site had 2 uses, now 3.",
    values: ['variant "outline"'],
  },
  {
    target: { scope: "instance", id: "app/billing/members.tsx › Members › Badge[1]#ana" },
    label: "members.tsx › Members › Badge[1]#ana",
    why: "Matches more than one Instance (ana): discard it and set it again on the one you mean.",
    values: ['tone "danger" · Current "neutral" (last seen)', 'children "Owner" · Current "Admin" (last seen)'],
  },
];

/** "2 · apply to nothing". */
export const HELD_META = "2 · apply to nothing";

/** Components seen on /billing with nothing mounted now: a dialog's parts. */
export const INTERACTION: readonly string[] = ["AlertDialogAction", "AlertDialogCancel", "AlertDialogTitle"];

// ── Notices, the Inspector's leftovers, the change list and the flags (wave 3) ──

/** A command as `generate` names it: a quoted path with two spaces, which the line keeps as written. */
export const COMMAND = "pnpm -C 'apps/Web  App' exec loupe generate";

/** A line that isn't a command: what to set, shown without a prompt, its Copy only the name. */
export const SECRET_LINE = { text: "FLAGS_SECRET=… in .env.local", copy: "FLAGS_SECRET=" } as const;

/** Two of the design system's sources changed since `generate` read them. */
export const STALE_NOTICE: NoticeView = {
  kind: "stale",
  tone: "amber",
  title: "Source changed",
  meta: "3 components",
  body: "3 components changed since the last generate. Their props here may be out of date. Run the command below from the repo root.",
  rows: [
    { key: "ds/components/ui/button.tsx", text: "Button, ButtonGroup", value: "ui/button.tsx", valueTitle: "ds/components/ui/button.tsx" },
    { key: "ds/components/ui/badge.tsx", text: "Badge", value: "ui/badge.tsx", valueTitle: "ds/components/ui/badge.tsx" },
  ],
  command: "pnpm -C apps/app exec loupe generate",
};

/** A component on the page `generate` has never read. */
export const NOT_GENERATED_NOTICE: NoticeView = {
  kind: "not-generated",
  tone: "amber",
  title: "Not generated yet",
  meta: "1 component",
  body: "1 component on this page is not generated yet, so it has no prop metadata and no Adapter. Run the command below from the repo root.",
  rows: [{ key: "not-generated", text: "MemberNote", value: null, valueTitle: null }],
  command: "pnpm -C apps/app exec loupe generate",
};

/** adapt-list.json went missing, as after a branch switch. */
export const MISSING_NOTICE: NoticeView = {
  kind: "missing",
  tone: "alert",
  title: "Product layer missing",
  meta: null,
  body: "adapt-list.json is gone, so files that reload lose their Adapters and their Instances drop out of this panel. A branch switch can remove it. Restore it with git, or write it again with the command below.",
  rows: [],
  command: "pnpm -C apps/app exec loupe generate --design-system <dir> --app <dir>",
};

/** The React self-check failed: no row, no command. */
export const OVERRIDES_OFF_NOTICE: NoticeView = {
  kind: "overrides-off",
  tone: "alert",
  title: "Overrides are off",
  meta: null,
  body: "Everything is inspect-only: this React build isn’t supported (React reported no fiber while an Adapter rendered.).",
  rows: [],
  command: null,
};

/** An Instance no Adapter renders: why nothing on it can change. */
export const NOTE = {
  title: "Inspect only · No Adapter",
  body: "No Adapter renders this Instance, so it is inspect-only: `loupe generate` writes Adapters only for components with a prop that can be Editable.",
};

/** The Button's Inspect only, folded: its props named after the title, and the library's two. */
export const INSPECT_ONLY: InspectOnlyView = {
  title: "Inspect only · 2",
  names: " · type, onClick",
  meta: null,
  open: false,
  shared: null,
  rows: [TYPE_INSPECT_ONLY, { ...TYPE_INSPECT_ONLY, name: "onClick", label: "onClick", reason: "FUNCTION", reasonTitle: "A function, such as an event handler: there is no value to try." }],
  empty: "None",
  injected: {
    summary: "2 set by the library",
    rows: [
      { name: "aria-expanded", value: "false" },
      { name: "data-slot", value: '"button"' },
    ],
  },
};

/** Nothing on it can change, every prop for one reason: open, the reason said once, Overrides off at the right. */
export const INSPECT_ONLY_SHARED: InspectOnlyView = {
  ...INSPECT_ONLY,
  meta: "Overrides off",
  open: true,
  shared: { reason: "OPEN TEXT", title: "Any text fits here, so there is no set of options to choose from." },
  rows: INSPECT_ONLY.rows.map((row) => ({ ...row, reason: null })),
  injected: null,
};

/** Select multiple on an Instance with no call site: alone, and the page one press away. */
export const NO_GROUP: NoGroupView = {
  text: "No call site was anchored here, so it has no group.",
  widen: { scope: "page", text: "Widen to All on page · 11", title: "All on page · 11" },
};

/** The page's numbered changes: an Instance's, a call site's, and one whose Instance isn't mounted. */
export const CHANGES: readonly ChangeItem[] = [
  { n: 1, props: "variant, size", detail: 'variant "ghost" → "outline", size "icon" → "sm"', where: "Actions for Ana Souza", select: "ana", reached: ["ana"] },
  { n: 2, props: "variant", detail: 'variant "ghost" → "secondary"', where: "⁨Actions for eva@example.com⁩ and 1 more", select: "eva", reached: ["eva", "fabio"] },
  { n: 3, props: "variant", detail: 'variant "default" → "destructive"', where: "Change role", select: null, reached: [] },
];

const FLAG_LASTS = "A preview lasts 8 hours, in a cookie every app on localhost shares. Clear it before switching projects.";

/** Three flags, one previewed, and a write the dev server refused. */
export const FLAGS: FlagsCardView = {
  title: "Feature flags",
  meta: "3 declared · 1 previewing",
  loading: null,
  off: null,
  empty: null,
  rows: [
    {
      key: "beta-banner",
      previewing: false,
      description: null,
      note: "No options declared: offered as on and off.",
      options: [
        { label: "Off", value: false },
        { label: "On", value: true },
      ],
      checked: null,
      state: "App decides",
      clear: null,
    },
    {
      key: "plan-tier",
      previewing: true,
      description: "Which plan the workspace is on.",
      note: null,
      options: [
        { label: "Free", value: "free" },
        { label: "Pro", value: "pro" },
        { label: "Team", value: "team" },
      ],
      checked: 1,
      state: "Previewing Pro",
      clear: "Clear",
    },
  ],
  error: "Failed to fetch",
  lasts: FLAG_LASTS,
  clearAll: { label: "Clear flag previews", enabled: true },
};

/** Previews off: FLAGS_SECRET isn't set, and the fix goes in .env.local. */
export const FLAGS_OFF: FlagsCardView = {
  title: "Feature flags",
  meta: "Unavailable",
  loading: null,
  off: {
    title: "Flag previews are off",
    why: " · why",
    reason: "FLAGS_SECRET isn't set on the dev server. The Flags SDK encrypts flag overrides with it, so previews need it.",
    fix: { text: "FLAGS_SECRET=… in .env.local", copy: "FLAGS_SECRET=" },
  },
  empty: null,
  rows: [],
  error: null,
  lasts: null,
  clearAll: null,
};
