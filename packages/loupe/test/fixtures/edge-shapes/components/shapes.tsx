"use client";

// Every prop shape the extractor must classify, one per prop where possible.
// Components render nothing: only their types and defaults are read.
import { cva, type VariantProps as CvaVariantProps } from "class-variance-authority";
import { Component, type CSSProperties, forwardRef, lazy, memo, type ReactElement, type ReactNode } from "react";
import { tv, type VariantProps } from "tailwind-variants";

export enum Density {
  Compact = "compact",
  Comfortable = "comfortable",
}

const alert = tv({
  variants: {
    tone: { info: "", warn: "", error: "" },
    elevated: { true: "shadow" },
  },
  defaultVariants: { tone: "info" },
});

const extended = tv({ extend: alert, variants: { size: { sm: "", lg: "" } } });

const mismatched = cva("", { variants: { tone: { calm: "", loud: "", extra: "" } } });

const defaulted = cva("", {
  variants: { tone: { calm: "", loud: "" }, size: { sm: "", lg: "" } },
  defaultVariants: { tone: "calm", size: "sm" },
});

export function Alert({ tone, elevated }: VariantProps<typeof alert> & { children?: ReactNode }) {
  return tone && elevated ? null : null;
}

export function Extended(props: VariantProps<typeof extended>) {
  return props ? null : null;
}

/** The config is found through the call in the body, and disagrees with the type. */
export function Mismatch({ tone = "calm" }: { tone?: "calm" | "loud" | "quiet" }) {
  mismatched({ tone: tone === "quiet" ? "calm" : tone });
  return null;
}

/** `tone` is destructured with a default that disagrees with `defaultVariants`. */
export function Conflict({ tone = "loud", size }: CvaVariantProps<typeof defaulted>) {
  return defaulted({ tone, size }) ? null : null;
}

export function Kitchen(props: {
  onSelect?: (value: string) => void;
  icon?: ReactElement;
  title?: string;
  count?: number;
  columns?: 1 | 2 | 3;
  density?: Density;
  style?: CSSProperties;
  member?: { name: string };
  label?: "a" | "b" | (string & {});
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  asChild?: boolean;
  anything?: any;
  children: ReactElement;
}) {
  return props ? null : null;
}

export function Shape(props: { shape: "circle" } | { shape: "square"; radius?: "sm" | "lg" }) {
  return props ? null : null;
}

export function Text<E extends "span" | "p">(props: { as?: E; tone?: "a" | "b"; payload?: E }) {
  return props ? null : null;
}

export const Fwd = forwardRef<HTMLDivElement, { size?: "sm" | "lg"; density?: Density }>(function Fwd(
  { size = "sm", density = Density.Comfortable },
  ref,
) {
  return ref && size && density ? null : null;
});

export const Memo = memo(function Memo(props: { on?: boolean }) {
  return props ? null : null;
});

export class Klass extends Component<{ mode?: "x" | "y" }> {
  render() {
    return null;
  }
}

export const Lazy = lazy(async () => ({ default: Memo }));

export const AliasedMemo = Memo;

export const lowercaseHelper = () => null;

export type KitchenTone = "a" | "b";
