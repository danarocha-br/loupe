// Switch: true or false (ADR 0003). A button with the switch role on UI SDK's `switch`,
// behind Loupe's own interface: plain props, the caller keeps the value. See switch.md.

import { Switch as SdkSwitch, SwitchThumb } from "@ui-sdk/react/switch";
import type { DataAttributes } from "../data-attributes.js";
import { onEnter } from "../enter.js";


export type SwitchProps = {
  /** On now. The caller keeps it: nothing changes until the caller passes the new value. */
  checked: boolean;
  /** A press, Space or Enter asks for the other value. */
  onCheckedChange(checked: boolean): void;
  /** The switch's accessible name: the true/false prop it sets. */
  label: string;
  disabled?: boolean;
  title?: string;
  className?: string;
} & DataAttributes;

export function Switch({ checked, onCheckedChange, label, disabled, title, className, ...data }: SwitchProps) {
  return (
    <SdkSwitch
      {...data}
      checked={checked}
      onCheckedChange={(next) => onCheckedChange(next)}
      disabled={disabled}
      aria-label={label}
      title={title}
      className={className}
      data-switch=""
      onKeyDown={onEnter(() => !disabled && onCheckedChange(!checked))}
    >
      <SwitchThumb data-switch-thumb="" />
    </SdkSwitch>
  );
}
