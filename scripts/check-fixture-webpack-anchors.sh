#!/usr/bin/env bash
# `next dev --webpack` on the fixture must anchor call sites, as `next dev` does:
# `withLoupe` adds the loader as a webpack rule as well as a Turbopack one. Before
# that, webpack started cleanly with no anchors and nothing said why.
# Run after the package is built. Starts a dev server on a spare port and stops it.
set -euo pipefail
# Job control gives the dev server its own process group, so the cleanup below
# can stop the server it forks along with it.
set -m

cd "$(dirname "$0")/../fixture/app"
port=3199
log=$(mktemp)
html=$(mktemp)

./node_modules/.bin/next dev --webpack --port "$port" >"$log" 2>&1 &
server=$!
cleanup() {
  kill -- "-$server" 2>/dev/null || kill "$server" 2>/dev/null || true
  rm -f "$log" "$html"
}
trap cleanup EXIT

# The first request compiles the page, so allow for a slow one.
status=000
for _ in $(seq 1 60); do
  status=$(curl -s -o "$html" -w '%{http_code}' "http://127.0.0.1:$port/" || true)
  [ "$status" = 200 ] && break
  sleep 2
done

failed=0
if [ "$status" != 200 ]; then
  echo "✗ next dev --webpack never answered 200 (last status $status):" >&2
  tail -20 "$log" >&2
  exit 1
fi
grep -q "(webpack)" "$log" || { echo "✗ the dev server did not run on webpack" >&2; failed=1; }
for site in "fixture/app/app/page.tsx" "fixture/app/components/product/member-row-menu.tsx"; do
  if ! grep -qF "data-ds-anchor=\"$site" "$html"; then
    echo "✗ no data-ds-anchor for $site under webpack" >&2
    failed=1
  fi
done

[ "$failed" -eq 0 ] && echo "✓ next dev --webpack anchors the fixture's call sites."
exit "$failed"
