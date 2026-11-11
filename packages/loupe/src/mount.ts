"use client";

// `<LoupeMount />`, the mount `loupe init` writes into the root layout. The
// Toolbar lands here (PER-130); until then it renders nothing, so the mount
// already resolves and builds.
export function LoupeMount(): null {
  return null;
}
