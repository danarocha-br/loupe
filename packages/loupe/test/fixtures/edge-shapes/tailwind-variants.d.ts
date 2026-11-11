// A reduced stand-in for tailwind-variants' typings: enough for VariantProps.
declare module "tailwind-variants" {
  type Variants = Record<string, Record<string, string>>;
  type Selection<T extends Variants> = { [K in keyof T]?: keyof T[K] extends "true" ? boolean : keyof T[K] };
  export function tv<T extends Variants>(config: {
    base?: string;
    extend?: unknown;
    variants: T;
    defaultVariants?: Selection<T>;
  }): (props?: Selection<T>) => string;
  export type VariantProps<F extends (...args: never[]) => unknown> = NonNullable<Parameters<F>[0]>;
}
