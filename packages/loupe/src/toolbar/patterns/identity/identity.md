# Identity

The top of the Inspector card, which says what is selected (DESIGN.md "Identity"); the same block heads "Not on the page now". It draws what `panelView()` decided, in the Inspector's words, and places the view's actions.

```tsx
<Identity
  identity={body.identity}
  words={inspectorWords}
  onBack={() => select(null)}
  nameLang={appLang()}
  heading={heading}
  onCrumb={select}
  actions={<ResetInstance … />}
/>
```

## Interface

- `identity`: `panelView()`'s `IdentityView`, the Inspector's or "Not on the page now"'s:
  - `component` (null when the headline is the component), `page`, `status` (a verdict or a plain status), `keys`;
  - `name`, `nameTitle`, and `ownName`, true when the name is the app's own words;
  - `where`: `{ file, line }`, after a file icon, the line set apart; or one line of words. `whereTitle`, `id` (null once gone);
  - `note` (once gone), `tags`, `chips`, `held` (what a gone Instance still holds), `notGenerated` (`{ tag, command }`);
  - `crumbs`, nearest first.
- `words`: `back` (Back's hidden label and tooltip), `inside`, `run` and `fromRootToReadProps`, `change(n)` for its deltas.
- `onBack()`, and `onCrumb(id)` for an Instance in Inside.
- `nameLang`: the app's language, given to the headline only when `ownName`. `heading`: its ref, for the view that moves focus to it.
- `actions`: the view's buttons (Hold open, Reset this Instance), set on a line 10px under the rest. `children`: the view's, after the actions (NoGroup).

## States and ARIA

| Attribute | Draws |
| --- | --- |
| `data-identity` | The block, padded 10px over Back and 10px to its left; `data-inside` when Inside closes it, flush at its foot. |
| `data-identity-title`, `data-identity-lead`, `data-identity-back`, `data-identity-component`, `data-identity-page` | The title line: a 28px round Back on the ground colour, the component muted at 500, the page in the annotation style; the verdict and deltas at the right. |
| `data-identity-name` | The headline, 17px at 600, balanced, in full however long. |
| `data-identity-where`, `data-identity-line` | 11px mono, muted, the line in `line-faint`. |
| `data-identity-tags`, `data-identity-held`, `data-identity-warn`, `data-identity-actions`, `data-identity-note` | The exceptions, each 10px under what is above. |
| `data-identity-inside` | Inside, edge to edge in the hover wash: a 42px label column, each Instance a step in with an elbow, the parent in `tree-ink`, the Instance itself in ink at 500. |

The headline is the view's one level-2 heading, `tabindex="-1"` so focus can land on it; `dir="auto"` and the app's `lang` for a name the app wrote. Back is named "All components", its key (Esc) in its tooltip. The deltas are images named "Change n". Inside's Instances are buttons in an ordered list.

## Keys

Tab reaches Back, the actions and each Instance in Inside, in that order. Esc is the Toolbar's (it goes back to the list), not this block's.
