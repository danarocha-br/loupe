"use client";

// Stand-in Product layer for the fixture. A pass-through until the runtime
// (PER-120) gives Adapters `createAdapter`; it exists so the dev loader's import
// swap has a real module to point at.
import { Button, buttonVariants } from "@fixture/design-system/components/ui/button";

export { Button, buttonVariants };
