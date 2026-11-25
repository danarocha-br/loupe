import { notFound } from "next/navigation";

import WorkbenchMount from "./workbench-mount";

// Loupe's patterns' workbench (ADR 0003, 0011): each toolbar pattern with sample panel-view
// data, inside the same shadow-root surface as the toolbar, in light and dark, under forced
// colours, with reduced motion and at a larger text size. The primitives have a workbench
// of their own: `pnpm --filter @loupe/ui dev`. Development only: a production build has no
// page here and no Loupe code (`loupe doctor --build`).
export default function WorkbenchPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-medium">Loupe workbench: the patterns</h1>
        <p className="text-sm text-muted-foreground">
          The Inspector’s, the list’s, the notices, the header, the footer and Copy Proposal, the pill, the sheet and the page’s marks. The primitives are in @loupe/ui’s own workbench: pnpm --filter @loupe/ui dev.
        </p>
      </header>
      <WorkbenchMount />
    </main>
  );
}
