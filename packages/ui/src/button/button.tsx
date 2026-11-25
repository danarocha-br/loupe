// Button: runs an action (ADR 0003). A native button on UI SDK's `button`, behind
// Loupe's own interface: plain props, and a look from DESIGN.md's "Buttons": the soft
// pill, the dark primary, the header's round tool. See button.md.

import { Button as SdkButton } from "@ui-sdk/react/button";
import type { ComponentPropsWithRef, MouseEvent, ReactNode } from "react";
import type { DataAttributes } from "../data-attributes.js";


/** `soft`: the pill every action is. `primary`: the dark one kept for the one exit. `tool`: the header's round icon. */
export type ButtonLook = "soft" | "primary" | "tool";

/** A soft pill's height: 26px, 30px or 40px. The primary is always 40px and a tool 30px. */
export type ButtonSize = "small" | "medium" | "large";

/**
 * The look: what `button.css` styles, and what Toggle draws with too. Only a soft pill
 * takes a size; the primary is always 40px and a tool 30px.
 */
export type LookProps = {
  /** Round, its width its height: an icon with its name for a screen reader beside it. */
  iconOnly?: boolean;
} & ({ look?: "soft"; size?: ButtonSize } | { look: "primary" | "tool"; size?: never });

type NativeProps = Omit<ComponentPropsWithRef<"button">, "type" | "onClick" | "className" | "children" | "disabled">;

export type ButtonProps = NativeProps &
  LookProps & {
    type?: "button" | "submit";
    disabled?: boolean;
    /** What a press does. Its return value is ignored: a press is never left pending. */
    onClick?(event: MouseEvent<HTMLButtonElement>): void;
    className?: string;
    children: ReactNode;
  } & DataAttributes;

const DEFAULT_SIZE: Record<ButtonLook, ButtonSize> = { soft: "medium", primary: "large", tool: "medium" };

/** The attributes a look draws by: Toggle draws with them, and so can a part that looks like a button (a select tool's chip). */
export function lookAttributes({ look = "soft", size, iconOnly }: { look?: ButtonLook; size?: ButtonSize; iconOnly?: boolean }): DataAttributes {
  return {
    "data-button": "",
    "data-look": look,
    "data-size": size ?? DEFAULT_SIZE[look],
    "data-icon-only": iconOnly ? "" : undefined,
  };
}

export function Button({ look, size, iconOnly, type = "button", disabled, onClick, className, children, ...rest }: ButtonProps) {
  return (
    <SdkButton
      {...rest}
      {...lookAttributes({ look, size, iconOnly })}
      type={type}
      disabled={disabled}
      className={className}
      // UI SDK keeps a button pending while a returned Promise runs; Loupe's actions say their own progress.
      onClick={onClick && ((event) => void onClick(event as MouseEvent<HTMLButtonElement>))}
    >
      {children}
    </SdkButton>
  );
}
