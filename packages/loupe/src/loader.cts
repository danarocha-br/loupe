// The Turbopack loader `withLoupe` registers for `next dev` only. CommonJS so any
// loader runner can require it; the work lives in the ESM `loader-runtime`.

import type { LoaderOptions } from "./loader-runtime.js";

type LoaderContext = {
  resourcePath: string;
  async: () => (error: Error | null, code?: string, map?: unknown) => void;
  getOptions?: () => LoaderOptions;
  query?: unknown;
  emitWarning?: (warning: Error) => void;
};

let warned = false;

function loupeLoader(this: LoaderContext, source: string): void {
  const callback = this.async();
  const options = (this.getOptions?.() ?? this.query) as LoaderOptions;
  import("./loader-runtime.js")
    .then(({ runLoader }) => {
      const { code, map } = runLoader(source, this.resourcePath, options);
      callback(null, code, map === null ? undefined : JSON.parse(map));
    })
    .catch((error: unknown) => {
      // A broken adapt-list.json must not take the designer's app down with
      // it: say so once and hand files back untouched.
      if (!warned) {
        warned = true;
        const warning = new Error(`Loupe left ${this.resourcePath} untouched: ${String(error)}`);
        if (this.emitWarning) this.emitWarning(warning);
        else console.warn(warning.message);
      }
      callback(null, source);
    });
}

export = loupeLoader;
