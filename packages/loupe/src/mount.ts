"use client";

// `<LoupeMount />`, the mount `loupe init` writes into the root layout.
//
// The layout imports this `'use client'` module, so a production build keeps it as
// a client reference even though the JSX is gated to development (PER-127). The
// Toolbar must not ride along: the dynamic import below sits inside the
// `NODE_ENV` condition itself, so a production bundler folds it to the null stub
// and never emits a chunk for the Toolbar. `loupe doctor --build` checks that.

import { type ComponentType, createElement, lazy, type ReactElement, Suspense, useEffect, useState } from "react";

export const LoupeMount: () => ReactElement | null =
  process.env.NODE_ENV === "development"
    ? devMount(lazy(() => import("./toolbar/index.js")))
    : function LoupeMount() {
        return null;
      };

/** Renders the Toolbar once mounted in the browser: never on the server, never during hydration. */
export function devMount(Toolbar: ComponentType): () => ReactElement | null {
  return function LoupeMount() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    return mounted ? createElement(Suspense, { fallback: null }, createElement(Toolbar)) : null;
  };
}
