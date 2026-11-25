// The structural snapshot, taken inside the page: every element Loupe draws in a shadow root
// (the Toolbar's host and each `<Surface>`), with its box, its computed style, its `::before`
// and `::after` when they draw, its own text and its ARIA. Written after the hand-run harness
// the refactors were proved with (`measure10.js`), and kept to what a refactor must not move.
//
// `snapshot()` and `freeze()` run in the page (`page.evaluate`), so each is self-contained:
// no import, no closure over this module.

/** One element: `box` is [x, y, width, height] from its origin (see `snapshot`), rounded to 0.01px. */
export type Entry = {
  box?: number[];
  /** Computed values in the order of `Snapshot.props`. */
  css: string[];
  before?: string[];
  after?: string[];
  /** Its own text: the text nodes directly in it, or a leaf's whole text. */
  text?: string;
  /** Role, ARIA states and properties, and the attributes a reader or the keyboard meets. */
  aria?: string;
};

export type Root = {
  /** The host's size; where it sits on the page is the page's business, not the surface's. */
  host: number[];
  /** Which `[data-loupe-surface]` it is on the page, for its screenshot; absent for the Toolbar. */
  index?: number;
  entries: Record<string, Entry>;
};

export type Snapshot = {
  props: string[];
  pseudo: string[];
  roots: Record<string, Root>;
};

/**
 * Walks every Loupe shadow root. Keys are paths of tag, the names (not values) of the
 * element's data- and role attributes, a section's heading, and the index among siblings
 * with the same key, so a reorder of differently keyed siblings moves nothing.
 *
 * Boxes are measured from an origin: the window for the Toolbar (its parts are fixed to it),
 * the host for a surface, and, below a section with a heading, that section. So a section
 * added above another moves one box, the section's, rather than every box under it.
 */
export function snapshot(): Snapshot {
  const PROPS = [
    "display", "position", "visibility", "opacity", "z-index", "box-sizing",
    "color", "background-color", "background-image", "background-position", "background-size",
    "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
    "border-top-style", "border-right-style", "border-bottom-style", "border-left-style",
    "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
    "border-top-left-radius", "border-top-right-radius", "border-bottom-left-radius", "border-bottom-right-radius",
    "box-shadow", "outline-style", "outline-color", "outline-width", "outline-offset",
    "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing",
    "font-variant-numeric", "font-feature-settings", "font-variation-settings",
    "text-align", "text-transform", "text-decoration-line", "text-decoration-color", "text-overflow",
    "white-space-collapse", "text-wrap-mode", "word-break", "overflow-wrap", "vertical-align",
    "padding-top", "padding-right", "padding-bottom", "padding-left",
    "margin-top", "margin-right", "margin-bottom", "margin-left",
    "flex-direction", "flex-wrap", "align-items", "justify-content", "row-gap", "column-gap",
    "grid-template-columns", "grid-template-rows",
    "transform", "translate", "scale", "rotate", "filter", "backdrop-filter", "mix-blend-mode", "clip-path", "mask-image",
    "overflow-x", "overflow-y", "cursor", "pointer-events",
    "fill", "stroke", "stroke-width", "list-style-type", "forced-color-adjust",
  ];
  const PSEUDO = ["content", "display", "position", "top", "left", "width", "height", "color", "background-color", "border-top-width", "border-top-color", "border-top-left-radius", "box-shadow", "transform", "opacity"];
  // References to ids: generated ids are not layout, and a counter shifts them for no reason.
  const ID_REFS = new Set(["aria-labelledby", "aria-describedby", "aria-controls", "aria-owns", "aria-activedescendant", "aria-details", "aria-errormessage", "aria-flowto"]);
  const READER = ["tabindex", "disabled", "hidden", "inert", "title", "alt", "placeholder", "type", "lang", "dir"];
  const SECTIONS = new Set(["SECTION", "ARTICLE", "FIGURE", "FIELDSET"]);
  const NO_BOX = new Set(["WBR", "BR", "STYLE", "SCRIPT", "TEMPLATE"]);
  const round = (n: number) => Math.round(n * 100) / 100;

  const roots: [string, ShadowRoot, Element | null, number | undefined][] = [];
  const toolbar = document.querySelector("[data-loupe-toolbar]");
  if (toolbar?.shadowRoot) roots.push(["toolbar", toolbar.shadowRoot, null, undefined]);
  const seen: Record<string, number> = {};
  document.querySelectorAll("[data-loupe-surface]").forEach((host, index) => {
    if (!host.shadowRoot) return;
    const label = host.getAttribute("aria-label") ?? "surface";
    seen[label] = (seen[label] ?? 0) + 1;
    roots.push([seen[label] > 1 ? `${label} #${seen[label]}` : label, host.shadowRoot, host, index]);
  });

  /** A section's heading, so inserting one section doesn't rename the ones after it. */
  const heading = (el: Element) => {
    for (const child of el.children) {
      if (/^(H[1-6]|FIGCAPTION|LEGEND|HEADER)$/.test(child.tagName)) return (child.textContent ?? "").trim().slice(0, 60);
    }
    return "";
  };
  const ownText = (el: Element) => {
    if (el.children.length === 0) return (el.textContent ?? "").trim();
    let text = "";
    for (const node of el.childNodes) if (node.nodeType === Node.TEXT_NODE) text += node.textContent;
    return text.trim();
  };
  const aria = (el: Element) => {
    const out: string[] = [];
    for (const attr of [...el.attributes].sort((a, b) => a.name.localeCompare(b.name))) {
      const name = attr.name;
      if (name === "role" || (name.startsWith("aria-") && !ID_REFS.has(name)) || READER.includes(name)) out.push(`${name}=${attr.value}`);
    }
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) out.push(`value=${el.value}`);
    if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) out.push(`checked=${el.checked}`);
    return out.join(" ");
  };

  const result: Snapshot = { props: PROPS, pseudo: PSEUDO, roots: {} };
  for (const [name, root, host, index] of roots) {
    const hostRect = host?.getBoundingClientRect();
    const entries: Record<string, Entry> = {};
    const walk = (node: ParentNode, parentKey: string, origin: [number, number]) => {
      const counts: Record<string, number> = {};
      for (const el of node.children) {
        if (el.tagName === "STYLE" || el.tagName === "SCRIPT") continue;
        const attrs = [...el.attributes].map((a) => a.name).filter((n) => n.startsWith("data-") || n === "role").sort().join(",");
        const section = SECTIONS.has(el.tagName) ? heading(el) : "";
        const k0 = `${el.tagName.toLowerCase()}[${attrs}]${section ? `"${section}"` : ""}`;
        counts[k0] = (counts[k0] ?? 0) + 1;
        const key = `${parentKey}/${k0}#${counts[k0]}`;
        const rect = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const entry: Entry = { css: PROPS.map((p) => cs.getPropertyValue(p)) };
        if (!NO_BOX.has(el.tagName)) entry.box = [round(rect.x - origin[0]), round(rect.y - origin[1]), round(rect.width), round(rect.height)];
        for (const pseudo of ["::before", "::after"] as const) {
          const ps = getComputedStyle(el, pseudo);
          if (ps.content && ps.content !== "none" && ps.content !== "normal") entry[pseudo === "::before" ? "before" : "after"] = PSEUDO.map((p) => ps.getPropertyValue(p));
        }
        const text = ownText(el);
        if (text) entry.text = text.slice(0, 120);
        const a = aria(el);
        if (a) entry.aria = a;
        entries[key] = entry;
        walk(el, key, section ? [rect.x, rect.y] : origin);
      }
    };
    walk(root, name, hostRect ? [hostRect.x, hostRect.y] : [0, 0]);
    result.roots[name] = { host: hostRect ? [round(hostRect.width), round(hostRect.height)] : [innerWidth, innerHeight], index, entries };
  }
  return result;
}

/**
 * Turns transitions, animations and the caret off in every Loupe root and in the page, so a
 * state is measured at rest. Run before every snapshot: a root can be new, or can have had
 * its sheets replaced (a theme switch).
 */
export function freeze(): void {
  // Next's dev indicator is the host's, and shows "Compiling" whenever Next does.
  const CSS = "*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; } nextjs-portal { display: none !important; }";
  const w = window as unknown as { __visualFreeze?: CSSStyleSheet };
  if (!w.__visualFreeze) {
    w.__visualFreeze = new CSSStyleSheet();
    w.__visualFreeze.replaceSync(CSS);
  }
  const sheet = w.__visualFreeze;
  const targets: (Document | ShadowRoot)[] = [document];
  document.querySelectorAll("[data-loupe-toolbar], [data-loupe-surface]").forEach((host) => host.shadowRoot && targets.push(host.shadowRoot));
  for (const target of targets) if (!target.adoptedStyleSheets.includes(sheet)) target.adoptedStyleSheets = [...target.adoptedStyleSheets, sheet];
}
