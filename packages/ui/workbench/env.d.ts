// What Vite gives the workbench that TypeScript can't see: a file's text by `?raw`.
declare module "*.md?raw" {
  const text: string;
  export default text;
}
