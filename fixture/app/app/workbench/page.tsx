import { notFound } from "next/navigation";

import WorkbenchMount from "./workbench-mount";

// Loupe's workbench (ADR 0003): each toolbar primitive by itself, inside the same
// shadow-root surface as the toolbar, in light and dark, under forced colours, with
// reduced motion and at a larger text size. Development only: a production build
// has no page here and no Loupe code (`loupe doctor --build`).
export default function WorkbenchPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-medium">Loupe workbench</h1>
        <p className="text-sm text-muted-foreground">
          ChipGroup, Button and Toggle, Switch, Fold, Field, Popover, the marks (Tag, Dot, Delta and Kbd) and the Announcer. Every key is the primitive’s own; Escape stays the app’s.
        </p>
      </header>
      <WorkbenchMount />
    </main>
  );
}
