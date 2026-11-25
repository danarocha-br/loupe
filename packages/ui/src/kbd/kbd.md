# Kbd

A key named in running text: the status strip's "**Esc** cancels" and "hold **Alt** to see through". It is the native `kbd` element.

```tsx
<>Click an Instance on the page · <Kbd>Esc</Kbd> cancels</>
```

## Interface

- `children`: the key as the reader's keyboard prints it ("Esc", "Alt"). A chord a Mac writes differently ("⌥⇧L" for Alt+Shift+L) is the caller's to format (`shortcutLabel()` in `shortcut.ts`).
- `className` and any `data-*` attribute pass through.

## States

| Attribute | Draws |
| --- | --- |
| `data-kbd` | 11px/14px mono at 500, 1px by 5px of padding, a key's 5px corners (`--radius-checkbox`), on the `kbd` wash. Its colour is the text's around it. |

Under forced colours the wash drops; a 1px outline inside its edge, transparent otherwise, is drawn in `CanvasText`, so the key keeps its box.

## ARIA and keys

- No role: the key's name is read in the sentence it sits in ("Esc cancels").
- No keys of its own. Naming a key binds nothing: the shortcut is the caller's.
- The Alt+Shift+L shortcut (ADR 0006) is drawn nowhere as text: it is in the collapsed pill's tooltip and its `aria-keyshortcuts`, which a `title` can't hold markup for.

## Tests

`kbd.test.tsx` draws it inside a real shadow root, in a sentence, checks the sentence reads through it, and runs axe.
