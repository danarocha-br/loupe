// What the workbenches' dev server (`../vite.ts`) and the shell (`index.tsx`) say to each
// other: a module of plain values both can import, the one in Node and the other in the page.

/** The event the dev server sends with the whole stylesheet, once a `.css` it is made of changes. */
export const STYLESHEET_EVENT = "loupe:workbench-stylesheet";

/** The name every workbench's stylesheet module exports its stylesheet under (`workbench/stylesheet.ts`). */
export const STYLESHEET_EXPORT = "WORKBENCH_STYLESHEET";
