# CommandLine

A command for the reader to run, with Copy (DESIGN.md "Notices and status", PER-140). The Toolbar names commands and never runs them (PER-100 §5). It stands at the foot of a notice, and in Feature flags' "why" for the one fix made in a file.

```tsx
<CommandLine text={notice.command} words={commandWords} onCopy={copyToClipboard} />
<CommandLine text="FLAGS_SECRET=… in .env.local" copy="FLAGS_SECRET=" prompt={false} words={commandWords} onCopy={copyToClipboard} />
```

## Interface

- `text`: the command as shown, its spaces kept as written (a quoted path's run of spaces stays).
- `copy`: what Copy puts on the clipboard, when it differs from `text`.
- `prompt`: the `$` before it; off for a line that isn't a shell command.
- `words`: `panelView()`'s `CommandWords`: `prompt`, `copy`, `copied`, `failed`, and `refused`, what to do when the clipboard refuses it.
- `onCopy(text)`: the view's copy. It returns a promise that rejects, or throws, when the clipboard refuses it.

## States

| Attribute | Draws |
| --- | --- |
| `data-command-block` | The well and what is said under it. |
| `data-command` | A well 38px at least, 12px corners, padded 4px and 12px at its left: 12px mono on a 16px line, Copy at the right. |
| `data-command-text` | The command, `white-space: pre-wrap`. |
| `data-command-copy` | Copy on the card's white, 28px tall, `sunk-hover` under the pointer: "Copy", "Copied" for 2 seconds, or "Copy failed" until the next try. |
| `data-command-refused` | 12px, muted, 6px under the well; nothing while empty. |

## ARIA and keys

- The `$` is hidden: it isn't part of the command.
- Copy is a button named by what it says now. A refusal is shown under the command and said once, assertively, by the announcer, each time it happens.
- Tab reaches Copy; Enter or Space presses it.

## Tests

`command.test.tsx`: the command as written and copied, a copy that differs from what is shown, Copied stepping back, a refusal shown and announced, and axe.
