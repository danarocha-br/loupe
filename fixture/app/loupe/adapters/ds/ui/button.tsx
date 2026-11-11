"use client";

// Hand-written stand-in for what `generate` (PER-121) will emit: the module's
// exports, with the adapted ones replaced.
import { createAdapter } from "@danarocha/loupe/runtime";
import { Button as Original, buttonVariants } from "@fixture/design-system/components/ui/button";

export const Button = createAdapter("Button", Original);
export { buttonVariants };
