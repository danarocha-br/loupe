# NoGroup

Select multiple, on an Instance with no call site to group by (DESIGN.md "Scope (Select multiple)"): it is selected alone, and says why; the page is still one press away when that scope applies. It stands under the identity's actions, as Identity's `children`.

```tsx
<Identity identity={body.identity} …>
  {mode === "many" && body.editing?.noGroup && <NoGroup noGroup={body.editing.noGroup} onScope={widen} />}
</Identity>
```

## Interface

- `noGroup`: panel-view's `NoGroupView`: `text`, why it is alone, and `widen`, the `ScopeMove` to the page or null.
- `onScope(scope)`: the move pressed. Widened, NoGroup goes, so the view moves focus to the heading.

## States

| Attribute | Draws |
| --- | --- |
| `data-no-group` | 10px under what is above; 12px on a 17px line, its parts 6px apart. |
| `data-no-group-why` | Why it is alone, muted. |

The move is ScopeSection's `ScopeMoveButton`: "Widen to All on page · 11", what it can't change in its tooltip.

## ARIA and keys

The move is a button named by its words. Tab reaches it; Enter or Space presses it.

## Tests

`no-group.test.tsx`: why, the move and what it calls, no move when the page doesn't apply, and axe.
