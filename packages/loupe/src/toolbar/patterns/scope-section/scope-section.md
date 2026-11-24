# ScopeSection

Select multiple's scope (DESIGN.md "Scope (Select multiple)"): who a group or page change reaches. It draws panel-view's `MembersView` in the Inspector's words.

```tsx
<ScopeSection
  members={body.members}
  selected={body.id}
  words={INSPECTOR_WORDS}
  nameLang={appLang()}
  onScope={setScope}
  onReset={(target) => dropUndoably(debug, target)}
  onToggle={(action, ids) => ids.forEach((id) => debug[action](id, scope))}
  onHover={outline}
/>
```

## Interface

- `members`: its `name` and `nameTitle`, `reach` (its `lead`, `countText`, `moreText`, and `included` of `page` for the meter), `widen` (where the selection can move: `{ scope, text, title }`), `reset`, `instancesText`, `members`, `sites` (at the page), `server` and `outUnmounted`.
- `selected`: the Instance in hand, read at 500 and tagged "picked". `words`: `untick`, `picked`, `resetScope`, `serverRendered`, `leftOutUnmounted`. `nameLang`: the app's language, for the names it wrote.
- `onScope(scope)`, `onReset(target)`, `onToggle(action, ids)`, `onHover(ids)`.
- `ScopeMoveButton` (`move`, `onScope`): Widen or Narrow, also drawn by the view where Select multiple can't group an Instance.

## States and ARIA

| Attribute | Draws |
| --- | --- |
| `data-scope-section` | The Fold: open by default while one Instance is left out. |
| `data-scope-head`, `data-scope-title`, `data-scope-lead` | The head, padded 14px: the layers icon and the scope's name in the title style. |
| `data-scope-meter`, `data-in` | An 8px dot for each of the component's Instances on the page (up to 12), coral for those it reaches. Hidden: the words say it. |
| `data-scope-reach`, `data-scope-actions`, `data-scope-count` | "Reaches **3 of 4** · 3 more on this page"; Widen, Reset this scope, and the count that opens the list, set in 28px under the icon. |
| `data-scope-move` | Widen or Narrow: a 28px navy pill on `link-wash` with a `link-edge` ring. |
| `data-scope-members`, `data-scope-list`, `data-scope-site`, `data-scope-who`, `data-out`, `data-picked` | Opened, on the hover wash: a row per Instance with a 16px checkbox, coral when ticked; left out, struck through in faint; at the page, a fieldset per call site. |

The scope's name is a level-3 heading. The count is the Fold's trigger, a button with `aria-expanded`. Each Instance is a checkbox named by its visible name and its tags; a call site's box is its fieldset's legend. The server-rendered and the left-out-unmounted lists are named lists.

## Keys

Tab reaches Widen, Reset this scope, the count, then each box. Space ticks a box; Enter or Space on the count opens or closes the list.
