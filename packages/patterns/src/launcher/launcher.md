# LauncherPill

The collapsed Toolbar (DESIGN.md "Collapsed"): a flat dark pill with Loupe's L, free on the window or docked a few px off a side, and its Goo, the body it is drawn in. Within about 10px of a side, the pill and the window's edge run together like two drops of ink, a liquid neck that fills in as they close and snaps as they part. Parked, the neck lets go and the pill sits clean.

```tsx
<LauncherPill
  edge={held ? "free" : (place.edge ?? "free")}
  dragging={held !== null}
  settling={settling}
  leaving={leaving}
  at={{ x: centre.x - PILL.width / 2, y: centre.y - PILL.height / 2 }}
  gaps={gaps}
  words={{ label: launcherWords.label, title: launcherWords.title(shortcutLabel()), keys: launcherWords.keys }}
  aria-keyshortcuts={SHORTCUT_ARIA}
  onPointerDown={down}
  onPointerMove={move}
  onPointerUp={up}
  onKeyDown={key}
  onClick={open}
/>
```

The view (`launcher.tsx`) owns everything that moves it: the pointer and its capture, the drag and the flick, the docking maths (`launcher-place.ts`), the settle timer and what is kept in storage. The pattern draws where it is told, and its CSS times every move from the attributes. It is imported by its own path, never through `patterns/index.js`, so the collapsed pill loads no other pattern.

## Interface

- `edge`: the side it is docked on (`top`, `right`, `bottom`, `left`), or `free`: held under the pointer, or let go away from a side.
- `dragging`, `settling`, `leaving`: held; travelling to its place after a drop, a dock or a key; tucking into its side as the panel opens.
- `at`: its body's top left in the window, in px, set as `translate`, so its travel stays off layout.
- `gaps`: how far each side's body stands off the window's edge: the pill's real gap to that side while it glues, 24px more once parked, past where they can join.
- `words`: `panelView()`'s `LauncherWords`: its name, the tooltip with the shortcut filled in, and `keys`, what its arrow keys do.
- Any other button attribute or handler (`aria-keyshortcuts`, `tabIndex`, the pointer and key handlers, `onClick`) goes to the button.
- `PILL` is the body's size (44 × 32), which the place maths lays out; `PILL_SIDES` the sides in the Goo's order.

## States

| Attribute | Draws |
| --- | --- |
| `data-launcher` | The button: the pill's 44 × 32 box, fixed, placed by `translate`, in `--on-band`, the `--launcher-edge` filter (a hairline in dark). Untucking takes `--duration-untuck` on `--ease-land`. |
| `data-launcher-goo`, `data-launcher-body`, `data-launcher-wall` | The Goo: the body, a stadium in `--band` (`--band-hover` under a fine pointer, unless dragging), and a body for each side, through one blur and an alpha threshold. |
| `data-edge` | Where it tucks to on `data-leaving`, and where it slides back from as it mounts (`@starting-style`): out of its side by its size and 6px; free, it settles away to 0.9 and fades. |
| `data-dragging` | Held: the grabbing cursor, no hover, and the sides' bodies follow at once. |
| `data-settling` | Travelling: `translate` on `--duration-settle` and `--ease-land`, the sides' bodies on the same curve, so they hold still on the window's edge. |
| (neither) | Landed: the sides' bodies draw back on `--duration-release` and `--ease-in-out`, so the neck thins, pinches, then lets go. |
| `data-leaving` | Tucking: `--duration-tuck` on `--ease-land`, and no pointer. |
| `data-launcher-mark`, `data-launcher-glyph` | The L, centred over the Goo, outside the blur, crisp. |

Reduced motion keeps only a fade (`--duration-fade`): no travel, no tuck, no neck. Under forced colours the pill keeps its own colours (`forced-color-adjust: none`), drawn in system ones: the Goo in `ButtonText`, pointed at or not, the L in `ButtonFace`, focus in `Highlight`.

## ARIA and keys

- A `button` named "Show Loupe", its tooltip naming the shortcut that focuses it; `aria-keyshortcuts` says it too.
- Described (`aria-describedby`) by a hidden line of its own, `keys`: what the arrow keys do, which nothing on screen says. Being a description, it replaces the tooltip as one: the tooltip's drag is for a pointer, and its shortcut is in `aria-keyshortcuts`. The view says where a key docked it (`LauncherWords.docked`), through the announcer.
- The Goo and the L are decoration, hidden from assistive technology.
- Enter and Space open the panel; the arrow keys dock it on the side they point at (the view's). While it tucks away it takes no focus (`tabIndex` −1) and no pointer.
