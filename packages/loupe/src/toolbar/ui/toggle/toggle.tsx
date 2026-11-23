// Toggle: a button that stays pressed (ADR 0003). A native button with `aria-pressed`
// on UI SDK's `toggle`, behind Loupe's own interface. It draws with Button's looks,
// and marks the pressed state on top. See toggle.md.

import { Toggle as SdkToggle } from "@ui-sdk/react/toggle";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { type LookProps, lookAttributes } from "../button/button.js";

type DataAttributes = { [name: `data-${string}`]: string | undefined };

type NativeProps = Omit<ComponentPropsWithRef<"button">, "type" | "onClick" | "onChange" | "className" | "children" | "disabled" | "value" | "defaultValue">;

export type ToggleProps = NativeProps &
  LookProps & {
    /** Pressed now. The caller keeps it: nothing changes until the caller passes the new value. */
    pressed: boolean;
    /** A press asks for the other state. */
    onPressedChange(pressed: boolean): void;
    /**
     * Whether the button itself shows it's pressed (the default). `false` when what it
     * presses shows elsewhere: the theme toggle, which turns the whole panel dark.
     */
    marksPressed?: boolean;
    disabled?: boolean;
    className?: string;
    children: ReactNode;
  } & DataAttributes;

export function Toggle({ look, size, iconOnly, pressed, onPressedChange, marksPressed = true, disabled, className, children, ...rest }: ToggleProps) {
  return (
    <SdkToggle
      {...rest}
      {...lookAttributes({ look, size, iconOnly })}
      data-toggle=""
      data-unmarked={marksPressed ? undefined : ""}
      pressed={pressed}
      onPressedChange={(next) => onPressedChange(next)}
      disabled={disabled}
      className={className}
    >
      {children}
    </SdkToggle>
  );
}
