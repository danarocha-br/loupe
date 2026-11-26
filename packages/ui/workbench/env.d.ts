// What Vite gives the workbench that TypeScript can't see: `import.meta.hot`, and a file's text by `?raw`.
/// <reference types="vite/types/importMeta.d.ts" />
declare module "*.md?raw" {
  const text: string;
  export default text;
}
