#!/usr/bin/env bash
# After `next build` of the fixture: nothing of the dev loader may reach the
# build. `withLoupe` adds the loader only for `next dev`, and this is the check
# that it stayed that way (PER-116). The layout mounts `<LoupeMount />` the way
# `loupe init` does, so the Toolbar's needle checks that the Toolbar stayed out
# too (PER-130), and the flag-preview, Proposal and layer-status markers that its
# Server Actions did (PER-132, PER-135, PER-133).
# `.next/cache` is skipped: it holds TypeScript's incremental state, which names
# every file in the tsconfig.
set -euo pipefail

cd "$(dirname "$0")/../fixture/app"
next_dir=.next
[ -f "$next_dir/required-server-files.json" ] || {
  echo "No $next_dir/required-server-files.json: build the fixture first." >&2
  exit 1
}

failed=0
for needle in data-ds-anchor data-ds-source data-ds-writes __loupe loader.cjs loader-runtime data-loupe-toolbar loupe-flag-preview loupe-proposal-context loupe-layer-status loupe-instance-meta; do
  hits=$(grep -rlF --exclude-dir=cache -- "$needle" "$next_dir" || true)
  if [ -n "$hits" ]; then
    echo "✗ \"$needle\" found in the build:" >&2
    echo "$hits" | sed 's/^/    /' >&2
    failed=1
  fi
done

if grep -qE '"loaders"|loader\.cjs' "$next_dir/required-server-files.json"; then
  echo "✗ required-server-files.json names a loader" >&2
  failed=1
fi

[ "$failed" -eq 0 ] && echo "✓ The fixture build has no trace of the dev loader."
exit "$failed"
