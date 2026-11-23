// A `.css` file imported as a string, for the toolbar's shadow root (ADR 0003, 0004).
// Vite inlines it in the build and in Vitest; tsc6 only needs its type.
declare module "*.css?inline" {
  const css: string;
  export default css;
}
