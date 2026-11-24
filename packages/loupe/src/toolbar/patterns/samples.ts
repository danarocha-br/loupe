// Sample panel-view data for the patterns: what `panelView()` would hand them for a
// MemberRowMenu Button on /billing, at This instance and at its call site, and for the
// list of /billing with nothing selected. The patterns' tests draw it, and so does the
// fixture's `/workbench` page, beside the words (panel-view's `INSPECTOR_WORDS` and
// `LIST_WORDS`, which the caller passes). Data only: no words a pattern would draw by
// itself, and nothing that writes.

import type { CallSiteItem, GroupItem, InstanceItem, ListBody, MembersView, PropItem, StatusTag, Tag, Write } from "../panel-view/index.js";
import type { IdentityProps } from "./identity/identity.js";
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

/** The Inspector's identity for that Button: everything but the words and the callbacks. */
export const IDENTITY: Omit<IdentityProps, "words" | "onBack"> = {
  component: "Button",
  page: "Billing",
  status: SUPPORTED,
  keys: [1, 2, 3],
  name: "Remove Caio from the workspace",
  where: { file: "member-row-menu.tsx", line: ":37 · use 2 of 3" },
  whereTitle: `app/billing/member-row-menu.tsx:37\n${ID}`,
  id: ID,
  tags: [NOT_VISIBLE],
  chips: ["Also in All on page"],
  crumbs: [
    { id: "menu", label: "MemberRowMenu" },
    { id: "row", label: "MemberRow" },
    { id: "list", label: "MembersList" },
  ],
};

/** The same Button once it is gone: its call site, what it still holds, and the view's Reset this Instance. */
export const GONE: Omit<IdentityProps, "words" | "onBack" | "actions"> = {
  component: null,
  status: { text: "Not on the page now" },
  name: "Button",
  where: "member-row-menu.tsx:37",
  whereTitle: ID,
  note: "It shows here again when it mounts. To keep a menu or dialog open, select it and press Hold open.",
  tags: [{ kind: "not-mounted", text: "No Instance mounted" }],
  held: ['variant "outline"', 'children ""'],
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
