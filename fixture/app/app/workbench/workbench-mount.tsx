"use client";

import { type ComponentType, lazy, Suspense, useEffect, useState } from "react";

// As `<LoupeMount />` loads the toolbar: the dynamic import sits inside the
// `NODE_ENV` condition, so a production build folds it away and emits no chunk.
const Workbench: ComponentType | null =
  process.env.NODE_ENV === "development" ? lazy(() => import("@danarocha/loupe/workbench")) : null;

// A default export, which `loupe generate` skips by shape: the workbench is not part of the app under test.
export default function WorkbenchMount() {
  // In the browser only: the surface attaches a shadow root.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!Workbench || !mounted) return null;
  return (
    <Suspense fallback={null}>
      <Workbench />
    </Suspense>
  );
}
