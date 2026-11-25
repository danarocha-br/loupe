// The primitives' `.md` files as React elements, for the workbench to show beside each
// primitive. Only what those files write: `#` headings, paragraphs, `-` and `1.` lists (nested
// by two spaces), tables, fenced code, and inline `code`, **strong**, *emphasis* and [links](…).
// Elements, never HTML strings: nothing in a file is ever parsed as markup.

import { Fragment, type ReactNode } from "react";

const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)\s]+\))/g;

/** One line's inline marks. */
export function inline(text: string): ReactNode[] {
  return text
    .split(INLINE)
    .filter((part) => part !== "")
    .map((part, index) => {
      if (part.startsWith("`") && part.endsWith("`") && part.length > 1) return <code key={index}>{part.slice(1, -1)}</code>;
      if (part.startsWith("**") && part.endsWith("**") && part.length > 3) return <strong key={index}>{inline(part.slice(2, -2))}</strong>;
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={index}>{inline(part.slice(1, -1))}</em>;
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
      if (link) return <span key={index}>{inline(link[1] as string)}</span>;
      return <Fragment key={index}>{part}</Fragment>;
    });
}

/** A table's row of cells, without its outer pipes. A pipe inside `code` stays in its cell. */
function cells(line: string): string[] {
  const row = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const found: string[] = [];
  let cell = "";
  let inCode = false;
  for (const char of row) {
    if (char === "`") inCode = !inCode;
    if (char === "|" && !inCode) {
      found.push(cell.trim());
      cell = "";
    } else cell += char;
  }
  found.push(cell.trim());
  return found;
}

type Item = { text: string; ordered: boolean; children: Item[] };

/** A list item's line: its indent, its marker (`-`, or a number and a dot) and its text. */
const MARKER = /^( *)(-|\d+\.) (.*)$/;

/** `- ` and `1. ` lines into a tree: two more spaces of indent is one level deeper; a line that continues an item joins it. */
function listTree(lines: string[]): Item[] {
  const root: Item[] = [];
  const stack: { indent: number; items: Item[] }[] = [{ indent: -1, items: root }];
  let last: Item | undefined;
  for (const line of lines) {
    const bullet = MARKER.exec(line);
    if (!bullet) {
      if (last) last.text += ` ${line.trim()}`;
      continue;
    }
    const indent = (bullet[1] as string).length;
    while ((stack.at(-1)?.indent ?? -1) >= indent) stack.pop();
    const item: Item = { text: bullet[3] as string, ordered: bullet[2] !== "-", children: [] };
    (stack.at(-1) as { items: Item[] }).items.push(item);
    stack.push({ indent, items: item.children });
    last = item;
  }
  return root;
}

/** A level of the tree: numbered when its first item is, as the file wrote it. */
function List({ items }: { items: Item[] }) {
  const Tag = items[0]?.ordered ? "ol" : "ul";
  return (
    <Tag>
      {items.map((item, index) => (
        <li key={index}>
          {inline(item.text)}
          {item.children.length > 0 && <List items={item.children} />}
        </li>
      ))}
    </Tag>
  );
}

/** A Markdown file as elements, block by block. */
export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let at = 0;
  while (at < lines.length) {
    const line = lines[at] as string;
    if (line.trim() === "") {
      at += 1;
      continue;
    }
    const key = blocks.length;
    const fence = /^```(\w*)/.exec(line);
    if (fence) {
      const code: string[] = [];
      at += 1;
      while (at < lines.length && !(lines[at] as string).startsWith("```")) code.push(lines[at++] as string);
      at += 1;
      blocks.push(
        <pre key={key} data-language={fence[1] || undefined}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    const heading = /^(#{1,4}) (.*)$/.exec(line);
    if (heading) {
      const Tag = `h${Math.min(heading[1]!.length + 1, 5)}` as "h2" | "h3" | "h4" | "h5";
      blocks.push(<Tag key={key}>{inline(heading[2] as string)}</Tag>);
      at += 1;
      continue;
    }
    if (line.trimStart().startsWith("|")) {
      const rows: string[][] = [];
      while (at < lines.length && (lines[at] as string).trimStart().startsWith("|")) rows.push(cells(lines[at++] as string));
      const [head = [], , ...body] = rows;
      blocks.push(
        <div key={key} className="md-table">
          <table>
            <thead>
              <tr>
                {head.map((cell, index) => (
                  <th key={index}>{inline(cell)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, index) => (
                <tr key={index}>
                  {row.map((cell, column) => (
                    <td key={column}>{inline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (MARKER.test(line)) {
      const items: string[] = [];
      while (at < lines.length && (lines[at] as string).trim() !== "" && !/^(#|```|\|)/.test((lines[at] as string).trimStart())) items.push(lines[at++] as string);
      blocks.push(<List key={key} items={listTree(items)} />);
      continue;
    }
    const paragraph: string[] = [];
    while (at < lines.length && (lines[at] as string).trim() !== "" && !/^(#{1,4} |```|\||- |\d+\. )/.test((lines[at] as string).trimStart())) paragraph.push((lines[at++] as string).trim());
    // A line no block above took and that can't start a paragraph either: kept as one, so the loop always moves on.
    if (paragraph.length === 0) paragraph.push((lines[at++] as string).trim());
    blocks.push(<p key={key}>{inline(paragraph.join(" "))}</p>);
  }
  return <>{blocks}</>;
}
