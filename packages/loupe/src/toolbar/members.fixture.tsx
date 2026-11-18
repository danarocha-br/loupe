// A members page for the Toolbar's tests: four row Buttons from one call site, a
// Menu Button, a menu that mounts a MenuItem, and a confirm Dialog whose Button
// renders only while it is open. `panel-view.test.tsx` reads it through
// `panelView()`; `toolbar.test.tsx` drives it through the panel.

import { type ReactNode, useState } from "react";
import { ANCHOR_ATTRIBUTE, callSiteHint, callSiteId, instanceId, SOURCE_ATTRIBUTE } from "../call-site.js";
import type { PropMeta } from "../meta/types.js";
import { createAdapter } from "../runtime/adapter.js";

const META: Record<string, PropMeta> = {
  children: { editable: true, from: "@types/react", kind: "text" },
  variant: { editable: true, from: "repo", kind: "options", status: "verified", options: ["default", "ghost"] },
  render: { editable: false, from: "@base-ui/react", reason: "STRUCTURAL" },
};

type ButtonProps = { variant?: string; children?: ReactNode; onClick?: () => void; "aria-expanded"?: boolean };
export const Button = createAdapter(
  "Button",
  ({ variant = "default", ...props }: ButtonProps) => <button type="button" {...props} data-variant={variant} />,
  { props: META },
);

type DialogProps = { open?: boolean; onOpenChange?: (open: boolean) => void; children?: ReactNode };
const Dialog = createAdapter(
  "Dialog",
  ({ open, onOpenChange, children }: DialogProps) =>
    open ? (
      <div role="dialog">
        {children}
        <button type="button" onClick={() => onOpenChange?.(false)}>
          Fechar
        </button>
      </div>
    ) : null,
  {
    props: {
      open: { editable: true, from: "@base-ui/react", kind: "options", status: "type-only", options: [false, true], state: true },
      onOpenChange: { editable: false, from: "@base-ui/react", reason: "FUNCTION" },
      // The two sources of its default disagree: no pill may be guessed.
      modal: {
        editable: true,
        from: "repo",
        kind: "options",
        status: "verified",
        options: [false, true],
        default: { source: "conflict", value: true, defaultVariants: false },
      },
    },
  },
);
const MenuItem = createAdapter("MenuItem", (props: { children?: ReactNode }) => <div role="menuitem">{props.children}</div>);

// A call site inside `Members`, by component and ordinal.
const membersSite = (component: string, ordinal: number) =>
  ({ path: "app/members.tsx", enclosing: "Members", component, ordinal }) as const;
export const members = (component: string, ordinal: number) => callSiteId(membersSite(component, ordinal));

/** What the loader writes at a row Button's call site (n = 1) or the Menu's (n = 2). */
export const site = (n: number, names: string[], children = "text") => ({
  [ANCHOR_ATTRIBUTE]: members("Button", n),
  [SOURCE_ATTRIBUTE]: callSiteHint(membersSite("Button", n), { line: 10 + n, column: 9, total: 2 }),
  "data-ds-writes": JSON.stringify({ attributes: names.map((name) => ({ name, writtenAs: "literal" })), spreads: false, children }),
});

// The dialog's confirm Button: `total` is the call site's use count, which an edit
// above it changes; `twice` renders it twice with no key, so one id names both.
const confirmSite = (total: number) => ({
  [ANCHOR_ATTRIBUTE]: members("Button", 3),
  [SOURCE_ATTRIBUTE]: callSiteHint(membersSite("Button", 3), { line: 40, column: 11, total }),
  "data-ds-writes": JSON.stringify({ attributes: [{ name: "variant", writtenAs: "literal" }], spreads: false, children: "text" }),
});

export const ANA = instanceId(members("Button", 1), "ana");
export const BIA = instanceId(members("Button", 1), "bia");
export const MENU = members("Button", 2);
export const CONFIRM = members("Button", 3);
export const DIALOG = members("Dialog", 1);
/** What the row Buttons' group scope is called. */
export const GROUP = "All in Members · Button 1 of 2";

export function Page({
  onRowClick = () => {},
  confirmTotal = 3,
  twice = false,
}: {
  onRowClick?: (member: string) => void;
  confirmTotal?: number;
  twice?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  return (
    <main>
      <ul>
        {["ana", "bia", "caio", "dani"].map((member) => (
          <li key={member}>
            <Button {...(site(1, ["variant", "onClick"]) as object)} variant="ghost" onClick={() => onRowClick(member)} aria-expanded={false}>
              {member}
            </Button>
          </li>
        ))}
      </ul>
      <Button {...(site(2, ["onClick"]) as object)} onClick={() => setOpen(!open)}>
        Menu
      </Button>
      {open && <MenuItem {...({ [ANCHOR_ATTRIBUTE]: members("MenuItem", 1) } as object)}>Remover</MenuItem>}
      <button type="button" onClick={() => setConfirming(true)}>
        Abrir
      </button>
      <Dialog
        {...({
          [ANCHOR_ATTRIBUTE]: members("Dialog", 1),
          "data-ds-writes": JSON.stringify({
            attributes: [
              { name: "open", writtenAs: "expression", expression: "confirming" },
              { name: "onOpenChange", writtenAs: "expression", expression: "setConfirming" },
            ],
            spreads: false,
            children: "text",
          }),
        } as object)}
        open={confirming}
        onOpenChange={setConfirming}
      >
        Remover membro?
        <Button {...(confirmSite(confirmTotal) as object)} variant="ghost">
          Confirmar
        </Button>
        {twice && (
          <Button {...(confirmSite(confirmTotal) as object)} variant="ghost">
            Confirmar
          </Button>
        )}
      </Dialog>
    </main>
  );
}
