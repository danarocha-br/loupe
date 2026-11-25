// What jsdom lacks that UI SDK reaches for once a part opens or closes (the ui-sdk
// skill's testing reference). Loaded before every test file (`vitest.config.ts`);
// a test in the node environment has no `Element`, and gets nothing.

if (typeof Element !== "undefined") {
  const element = Element.prototype as Element & Partial<Pick<Element, "getAnimations" | "scrollIntoView" | "checkVisibility">>;
  element.getAnimations ??= () => [];
  element.scrollIntoView ??= () => {};
  element.checkVisibility ??= () => true;
}
if (typeof HTMLElement !== "undefined") {
  const html = HTMLElement.prototype as HTMLElement & Partial<Pick<HTMLElement, "showPopover" | "hidePopover">>;
  html.showPopover ??= () => {};
  html.hidePopover ??= () => {};
}

// jsdom caches computed styles per document and clears the cache only on a change in
// the document's own tree, never in a shadow root's: a panel that drops `hidden`
// inside a surface would still read `display: none`. A style read inside a shadow root
// clears the cache first, with a change in `<head>` that no test or MutationObserver of
// the body sees. The surface's stylesheet isn't in jsdom's cascade, so the read stays cheap.
if (typeof window !== "undefined" && typeof document !== "undefined") {
  const read = window.getComputedStyle.bind(window);
  window.getComputedStyle = ((element: Element, pseudo?: string | null) => {
    if (element.getRootNode() instanceof ShadowRoot) document.head.appendChild(document.createComment("")).remove();
    return read(element, pseudo);
  }) as typeof window.getComputedStyle;
}
