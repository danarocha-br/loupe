// What an Instance is called on screen (critique 2026-11-19): its accessible name,
// else its visible text, so a designer finds "Actions for Ana Souza" rather than
// `member-row-menu.tsx:37#m1`. The call site stays beside it, for engineers.

/** A name past this many characters is cut, with an ellipsis. */
const MAX = 48;

/**
 * An Instance's name, on one line: an accessible name on any of its DOM nodes
 * first (a menu's trigger names the menu better than its items do), else the
 * visible text of the first node that has some. Null when none shows a name.
 */
export function screenName(nodes: readonly Element[]): string | null {
  for (const node of nodes) {
    const name = labelOf(node);
    if (name !== null) return clip(name);
  }
  for (const node of nodes) {
    const text = textOf(node);
    if (hasText(text)) return clip(text);
  }
  return null;
}

/** The text of every text node in it, a space between each, so "Change role" and "Remove" don't run together. */
function textOf(node: Element): string {
  const walker = node.ownerDocument.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  for (let text = walker.nextNode(); text !== null; text = walker.nextNode()) parts.push(text.nodeValue ?? "");
  return parts.join(" ");
}

/** A name the markup gives it: aria-label, aria-labelledby, an image's alt, a field's label or placeholder, a title. */
function labelOf(node: Element): string | null {
  const label = node.getAttribute("aria-label");
  if (hasText(label)) return label;
  const labelledBy = node.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => node.ownerDocument.getElementById(id)?.textContent ?? "")
      .join(" ");
    if (hasText(text)) return text;
  }
  if (node.localName === "img") {
    const alt = node.getAttribute("alt");
    if (hasText(alt)) return alt;
  }
  if (node.localName === "input" || node.localName === "textarea") {
    const field = node as HTMLInputElement | HTMLTextAreaElement;
    const labelText = [...(field.labels ?? [])].map((labelNode) => labelNode.textContent ?? "").join(" ");
    if (hasText(labelText)) return labelText;
    const placeholder = node.getAttribute("placeholder");
    if (hasText(placeholder)) return placeholder;
  }
  const title = node.getAttribute("title");
  return hasText(title) ? title : null;
}

function hasText(text: string | null | undefined): text is string {
  return typeof text === "string" && text.trim() !== "";
}

function clip(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > MAX ? `${line.slice(0, MAX - 1).trimEnd()}…` : line;
}
