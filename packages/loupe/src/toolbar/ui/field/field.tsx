// Field: a text control with its label, an optional hint and marker, and its error
// (ADR 0003). UI SDK's `field` with its `input` or `textarea`, behind Loupe's own
// interface: plain props, the caller keeps the value. See field.md.

import { Field as SdkField, FieldDescription, FieldError, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { Textarea } from "@ui-sdk/react/textarea";
import type { ComponentPropsWithRef, ReactNode } from "react";
import type { DataAttributes } from "../data-attributes.js";

/**
 * `filled`: a `sunk` box, 36px, the popover's fields. `outline`: a card with an edge
 * that grows with its text, a prop's text. `well`: a fixed window onto a long read-only
 * text that fades out at its foot.
 */
export type FieldLook = "filled" | "outline" | "well";

type Shared = {
  /** Names the control: visible above it, or only to a screen reader with `labelHidden`. */
  label: string;
  /** The label is said, not shown: the row around the field already shows its name. */
  labelHidden?: boolean;
  /** The marker after the label, like "optional", in the caller's words. */
  optional?: string;
  /** Under the control, describing it. */
  hint?: ReactNode;
  /** Under the control while there is one: it marks the control invalid and describes it. */
  error?: string;
  look?: FieldLook;
  value: string;
  /** What was typed. The caller keeps the value: nothing changes until it passes the new one. */
  onValueChange?(value: string): void;
  /** On the field around the label and the control, for the view's layout. */
  className?: string;
};

type Native<Tag extends "input" | "textarea"> = Omit<
  ComponentPropsWithRef<Tag>,
  "value" | "defaultValue" | "onChange" | "onSubmit" | "className" | "children" | "aria-label" | "aria-labelledby" | "aria-describedby" | "aria-invalid"
>;

export type FieldProps = Shared &
  DataAttributes &
  (({ multiline?: false } & Native<"input">) | ({ multiline: true; autoResize?: boolean } & Native<"textarea">));

export function Field(props: FieldProps) {
  const { label, labelHidden, optional, hint, error, look = "filled", value, onValueChange, className, ...control } = props;
  // The union's two halves differ only in the element: split it once, here.
  const { multiline, autoResize, ...native } = control as { multiline?: boolean; autoResize?: boolean } & DataAttributes;
  const shared = { value, onValueChange: (next: string) => onValueChange?.(next), "data-field-control": "" };
  return (
    <SdkField invalid={error === undefined ? undefined : true} className={className} data-field="" data-look={look}>
      <FieldLabel className={labelHidden ? "sr-only" : undefined} data-field-label="">
        {label}
        {optional && (
          <>
            {" "}
            <span data-field-optional="">{optional}</span>
          </>
        )}
      </FieldLabel>
      <div data-field-box="">
        {multiline ? (
          <Textarea {...(native as Native<"textarea">)} {...shared} autoResize={autoResize} />
        ) : (
          <Input {...(native as Native<"input">)} {...shared} />
        )}
      </div>
      {hint !== undefined && <FieldDescription data-field-hint="">{hint}</FieldDescription>}
      {error !== undefined && (
        <FieldError match data-field-error="">
          {error}
        </FieldError>
      )}
    </SdkField>
  );
}
