// Sample panel-view data for the patterns: what `panelView()` would hand them for a
// MemberRowMenu Button on /billing, at This instance and at its call site. The patterns'
// tests draw it, and so does the fixture's `/workbench` page, beside the Inspector's
// words (panel-view's `INSPECTOR_WORDS`, which the caller passes). Data only: no words a
// pattern would draw by itself, and nothing that writes.

import type { MembersView, PropItem, StatusTag, Tag, Write } from "../panel-view/index.js";
import type { IdentityProps } from "./identity/identity.js";

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
