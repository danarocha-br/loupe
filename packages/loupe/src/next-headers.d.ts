// `next/headers` as a bundler writes it. Next has no `exports` map, so NodeNext
// resolution only finds `next/headers.js`; the types are Next's own either way.
declare module "next/headers" {
  export * from "next/headers.js";
}
