// The workbench shell (ADR 0011, 0012): the page every package's workbench is drawn in. Each
// page of the list in each of its states, light and dark side by side, inside the real
// shadow-root surface (`<Surface>`), with its `.md` beside it; a nav of the pages; the reader's
// text size, whether the `.md` shows, and whether forced colours and reduced motion are on.
//
// `@loupe/ui/workbench`, an entry for development alone: its target is outside `src`, so no
// build reads it and nothing ships it (`build.test.ts`), and Loupe never imports it. Each
// package passes its own pages and its own stylesheet: `@loupe/ui`'s workbench (`../main.tsx`)
// the system's with its frames' layout on top; `@loupe/patterns`' the Toolbar's stylesheet with
// its own. The page around the surfaces is plain HTML and `workbench.css`.

import { type ComponentType, StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Card } from "../../src/index.js";
import { Surface, type Theme } from "../../src/surface/index.js";
import FRAMES_CSS from "./frames.css?inline";
import { STYLESHEET_EVENT } from "./hot.js";
import { Markdown } from "./markdown.js";
import PAGE_CSS from "./workbench.css?inline";

export { Frame, Glyph, States } from "./frame.js";

/**
 * The frames' layout every workbench shares (`frames.css`): the ground, the card or bare
 * section, each state's frame, and the lines and lists the states draw in. A package's
 * stylesheet puts it in its top layer, before its own frame rules.
 */
export { FRAMES_CSS };

/** One page of a workbench: a primitive, or a pattern, in its states. */
export type Page = {
  /** Its folder in the package's `src/`, and its address on the page: `#chip-group`. */
  id: string;
  name: string;
  /** Its `.md`, as written. */
  doc: string;
  States: ComponentType;
  /** Drawn on the ground rather than in a card: a card never sits on a card. */
  bare?: boolean;
};

/** What a package gives the shell. */
export type WorkbenchOptions = {
  /** The package's name, the page's heading and its title: `@loupe/ui`. */
  title: string;
  /** What the page draws, under the heading. */
  intro: string;
  /** What its pages are, the nav's name: `Primitives`. */
  nav: string;
  pages: readonly Page[];
  /** The stylesheet every surface adopts: the package's, with `FRAMES_CSS` and its own frames' layout in the top layer. */
  stylesheet: string;
  /** Where a page's folder is, before its id: `packages/ui/src/`. */
  folder: string;
  /** What this browser keeps the reader's settings under: `loupe-ui-workbench`. */
  storage: string;
};

const THEMES: Theme[] = ["light", "dark"];
const TEXT_SIZES = [16, 20];

/** What the address names: one page by its folder, or every one. */
function useRoute(): string {
  const read = () => {
    // A fragment that isn't valid percent-encoding (`#%`) names no page: every one shows.
    try {
      return decodeURIComponent(location.hash.slice(1)) || "all";
    } catch {
      return "all";
    }
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const change = () => setRoute(read());
    addEventListener("hashchange", change);
    return () => removeEventListener("hashchange", change);
  }, []);
  return route;
}

/** A setting kept in this browser for the next visit: storage can throw (a private window), and the default stands then. */
function useKept<T extends string | number | boolean>(storage: string, key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const kept = localStorage.getItem(`${storage}:${key}`);
      return kept === null ? initial : (JSON.parse(kept) as T);
    } catch {
      return initial;
    }
  });
  const keep = (next: T) => {
    setValue(next);
    try {
      localStorage.setItem(`${storage}:${key}`, JSON.stringify(next));
    } catch {
      // Not kept: the setting holds for this visit.
    }
  };
  return [value, keep];
}

/** Whether a media feature is on in this browser right now. */
function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const list = matchMedia(query);
    const change = () => setMatches(list.matches);
    list.addEventListener("change", change);
    return () => list.removeEventListener("change", change);
  }, [query]);
  return matches;
}

const MEDIA = [
  { name: "Forced colours", query: "(forced-colors: active)", how: "DevTools › Rendering › Emulate CSS media feature forced-colors" },
  { name: "Reduced motion", query: "(prefers-reduced-motion: reduce)", how: "DevTools › Rendering › Emulate CSS media feature prefers-reduced-motion" },
];

function MediaState({ name, query, how }: (typeof MEDIA)[number]) {
  const on = useMedia(query);
  return (
    <li data-on={on || undefined}>
      <strong>{name}</strong> {on ? "on" : "off"}
      {!on && <span className="wb-how">{how}</span>}
    </li>
  );
}

/** One page in one theme, inside a surface of its own. */
function ThemeFrame({ page, theme, textSize, stylesheet }: { page: Page; theme: Theme; textSize: number; stylesheet: string }) {
  const { States, bare, name } = page;
  return (
    <figure className="wb-frame">
      <figcaption>{theme === "light" ? "Light" : "Dark"}</figcaption>
      <Surface stylesheet={stylesheet} theme={theme} textSize={textSize === 16 ? undefined : textSize} label={`${name}, ${theme}`}>
        <div className="wb-ground">
          {bare ? (
            <section className="wb-bare">
              <States />
            </section>
          ) : (
            <Card className="wb-card">
              <States />
            </Card>
          )}
        </div>
      </Surface>
    </figure>
  );
}

function PageView({ page, textSize, doc, single, options }: { page: Page; textSize: number; doc: boolean; single: boolean; options: WorkbenchOptions }) {
  return (
    <article className="wb-primitive" aria-labelledby={`${page.id}-name`}>
      <header>
        <h2 id={`${page.id}-name`}>{single ? page.name : <a href={`#${page.id}`}>{page.name}</a>}</h2>
        <code>
          {options.folder}
          {page.id}/
        </code>
      </header>
      <div className="wb-split" data-doc={doc || undefined}>
        <div className="wb-frames">
          {THEMES.map((theme) => (
            <ThemeFrame key={theme} page={page} theme={theme} textSize={textSize} stylesheet={options.stylesheet} />
          ))}
        </div>
        {doc && (
          <section className="wb-doc" aria-label={`${page.name}: states, ARIA and keys`}>
            <Markdown source={page.doc} />
          </section>
        )}
      </div>
    </article>
  );
}

/** The page: the nav and the reader's settings at the side, the pages in their frames beside them. */
export function Workbench(options: WorkbenchOptions) {
  const { title, intro, nav, pages, storage } = options;
  const route = useRoute();
  const [textSize, setTextSize] = useKept<number>(storage, "text-size", 16);
  const [doc, setDoc] = useKept<boolean>(storage, "doc", true);
  const one = pages.find((page) => page.id === route);
  const shown = one ? [one] : pages;
  useEffect(() => {
    document.title = one ? `${one.name} · ${title}` : `${title} workbench`;
  }, [one, title]);
  return (
    <div className="wb-page">
      <aside className="wb-side">
        <header>
          <h1>{title}</h1>
          <p>{intro}</p>
        </header>
        <nav aria-label={nav}>
          <ul>
            <li>
              <a href="#all" aria-current={one ? undefined : "page"}>
                All
              </a>
            </li>
            {pages.map((page) => (
              <li key={page.id}>
                <a href={`#${page.id}`} aria-current={page === one ? "page" : undefined}>
                  {page.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <fieldset>
          <legend>Reader's text size</legend>
          {TEXT_SIZES.map((size) => (
            <label key={size}>
              <input type="radio" name="text-size" checked={textSize === size} onChange={() => setTextSize(size)} />
              {size}px{size === 16 ? " (default)" : ""}
            </label>
          ))}
        </fieldset>
        <label className="wb-check">
          <input type="checkbox" checked={doc} onChange={(event) => setDoc(event.target.checked)} />
          Show its .md beside it
        </label>
        <ul className="wb-media" aria-label="Media features">
          {MEDIA.map((media) => (
            <MediaState key={media.name} {...media} />
          ))}
        </ul>
      </aside>
      <main>
        {shown.map((page) => (
          <PageView key={page.id} page={page} textSize={textSize} doc={doc && one !== undefined} single={one !== undefined} options={options} />
        ))}
      </main>
    </div>
  );
}

/**
 * Draws a package's workbench into the page's `#root`, with the page's own CSS. Gives back
 * a way to draw it again with new pages, for a package's `main.tsx` to take an edit of its
 * states in place; the stylesheet it takes again itself, from the dev server (`../vite.ts`).
 * Drawn again, the page keeps its state: the reader's settings, an open Fold, focus.
 */
export function mountWorkbench(options: WorkbenchOptions): (next: Partial<WorkbenchOptions>) => void {
  const style = document.createElement("style");
  style.textContent = PAGE_CSS;
  document.head.append(style);
  const root = createRoot(document.getElementById("root") as HTMLElement);
  let current = options;
  const draw = (next: Partial<WorkbenchOptions>) => {
    current = { ...current, ...next };
    root.render(
      <StrictMode>
        <Workbench {...current} />
      </StrictMode>,
    );
  };
  draw({});
  // A `.css` edit: every surface swaps its sheet in place (`adoptStylesheet`), and nothing else renders anew.
  import.meta.hot?.on(STYLESHEET_EVENT, (stylesheet: string) => draw({ stylesheet }));
  return draw;
}
