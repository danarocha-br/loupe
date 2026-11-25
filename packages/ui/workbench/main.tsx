// The design system's own workbench (ADR 0011): every primitive in each of its states, light
// and dark side by side, inside the real shadow-root surface (`<Surface>`), with its `.md`
// beside it. `pnpm --filter @loupe/ui dev` serves it; nothing here ships, and nothing here
// imports Loupe (boundary.test.ts). The page around the surfaces is plain HTML and its own CSS.

import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Card } from "../src/index.js";
import { stylesheet, Surface, type Theme } from "../src/surface/index.js";
import FRAME_CSS from "./frame.css?inline";
import { Markdown } from "./markdown.js";
import { type Primitive, PRIMITIVES } from "./primitives.js";

/** The system's stylesheet with the workbench's frame layout as its top layer, where a consumer's patterns go. */
const WORKBENCH_STYLESHEET = stylesheet(FRAME_CSS);

const THEMES: Theme[] = ["light", "dark"];
const TEXT_SIZES = [16, 20];

/** What the address names: one primitive by its folder, or every one. */
function useRoute(): string {
  const read = () => decodeURIComponent(location.hash.slice(1)) || "all";
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const change = () => setRoute(read());
    addEventListener("hashchange", change);
    return () => removeEventListener("hashchange", change);
  }, []);
  return route;
}

/** A setting kept in this browser for the next visit: storage can throw (a private window), and the default stands then. */
function useKept<T extends string | number | boolean>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const kept = localStorage.getItem(`loupe-ui-workbench:${key}`);
      return kept === null ? initial : (JSON.parse(kept) as T);
    } catch {
      return initial;
    }
  });
  const keep = (next: T) => {
    setValue(next);
    try {
      localStorage.setItem(`loupe-ui-workbench:${key}`, JSON.stringify(next));
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

/** One primitive in one theme, inside a surface of its own. */
function Frame({ primitive, theme, textSize }: { primitive: Primitive; theme: Theme; textSize: number }) {
  const { States, bare, name } = primitive;
  return (
    <figure className="wb-frame">
      <figcaption>{theme === "light" ? "Light" : "Dark"}</figcaption>
      <Surface stylesheet={WORKBENCH_STYLESHEET} theme={theme} textSize={textSize === 16 ? undefined : textSize} label={`${name}, ${theme}`}>
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

function PrimitiveView({ primitive, textSize, doc, single }: { primitive: Primitive; textSize: number; doc: boolean; single: boolean }) {
  return (
    <article className="wb-primitive" aria-labelledby={`${primitive.id}-name`}>
      <header>
        <h2 id={`${primitive.id}-name`}>{single ? primitive.name : <a href={`#${primitive.id}`}>{primitive.name}</a>}</h2>
        <code>packages/ui/src/{primitive.id}/</code>
      </header>
      <div className="wb-split" data-doc={doc || undefined}>
        <div className="wb-frames">
          {THEMES.map((theme) => (
            <Frame key={theme} primitive={primitive} theme={theme} textSize={textSize} />
          ))}
        </div>
        {doc && (
          <section className="wb-doc" aria-label={`${primitive.name}: states, ARIA and keys`}>
            <Markdown source={primitive.doc} />
          </section>
        )}
      </div>
    </article>
  );
}

function Workbench() {
  const route = useRoute();
  const [textSize, setTextSize] = useKept<number>("text-size", 16);
  const [doc, setDoc] = useKept<boolean>("doc", true);
  const one = PRIMITIVES.find((primitive) => primitive.id === route);
  const shown = one ? [one] : PRIMITIVES;
  useEffect(() => {
    document.title = one ? `${one.name} · @loupe/ui` : "@loupe/ui workbench";
  }, [one]);
  return (
    <div className="wb-page">
      <aside className="wb-side">
        <header>
          <h1>@loupe/ui</h1>
          <p>Every primitive in each of its states, light and dark, inside the real surface.</p>
        </header>
        <nav aria-label="Primitives">
          <ul>
            <li>
              <a href="#all" aria-current={one ? undefined : "page"}>
                All
              </a>
            </li>
            {PRIMITIVES.map((primitive) => (
              <li key={primitive.id}>
                <a href={`#${primitive.id}`} aria-current={primitive === one ? "page" : undefined}>
                  {primitive.name}
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
        {shown.map((primitive) => (
          <PrimitiveView key={primitive.id} primitive={primitive} textSize={textSize} doc={doc && one !== undefined} single={one !== undefined} />
        ))}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <Workbench />
  </StrictMode>,
);
