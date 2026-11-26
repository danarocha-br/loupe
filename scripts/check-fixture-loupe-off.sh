#!/usr/bin/env bash
# `LOUPE=0 next dev` on the fixture must run without any of Loupe: no loader, so no
# anchors in the page, and no Toolbar, so the mount's chunk names no Toolbar module
# to load (and nothing makes `window.__loupe`). `withLoupe` decides, and the mount
# folds to its stub on what it decided. A second run without LOUPE=0 proves the
# needles: the same page has its anchors and the Toolbar's module.
# Run after the package is built. Starts a dev server on a spare port and stops it,
# once per run. Next locks a project's dev server, so stop the fixture's first.
# Exits 0, 1 when Loupe isn't off (or the needles prove nothing), and 2 when the
# check couldn't run: its port taken, or a script the page loads not served.
set -euo pipefail
# Job control gives the dev server its own process group, so the cleanup below
# can stop the server it forks along with it.
set -m

cd "$(dirname "$0")/../fixture/app"
port=3197
log=$(mktemp)
html=$(mktemp)
chunks=$(mktemp)
server=""

stop() {
  [ -n "$server" ] || return 0
  kill -- "-$server" 2>/dev/null || kill "$server" 2>/dev/null || true
  wait "$server" 2>/dev/null || true
  server=""
}
cleanup() {
  stop
  rm -f "$log" "$html" "$chunks"
}
trap cleanup EXIT

if lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "✗ port $port is taken, so the check could measure another server." >&2
  exit 2
fi

# Serves the page with LOUPE set to $1 ("" leaves it unset), then reads it and the
# scripts it loads. In development the mount's chunk is among them.
serve() {
  if [ -n "$1" ]; then
    LOUPE="$1" ./node_modules/.bin/next dev --port "$port" >"$log" 2>&1 &
  else
    env -u LOUPE ./node_modules/.bin/next dev --port "$port" >"$log" 2>&1 &
  fi
  server=$!
  # The first request compiles the page, so allow for a slow one.
  local status=000
  for _ in $(seq 1 60); do
    status=$(curl -s -o "$html" -w '%{http_code}' "http://127.0.0.1:$port/" || true)
    [ "$status" = 200 ] && break
    sleep 2
  done
  if [ "$status" != 200 ]; then
    echo "✗ next dev${1:+ with LOUPE=$1} never answered 200 (last status $status):" >&2
    tail -20 "$log" >&2
    exit 1
  fi
  : >"$chunks"
  grep -oE 'src="/_next/[^"]+\.js[^"]*"' "$html" | sed 's/^src="//; s/"$//' | sort -u |
    while read -r src; do
      # An error page is no evidence of what a chunk holds: stop as a check that couldn't run.
      curl -fsS "http://127.0.0.1:$port$src" >>"$chunks" || {
        echo "✗ next dev${1:+ with LOUPE=$1} didn't serve $src" >&2
        exit 2
      }
    done
  stop
}

failed=0

serve 0
grep -q "loupe/dist/mount.js" "$chunks" || {
  echo "✗ with LOUPE=0, the page's scripts don't hold the mount, so the check can't see it" >&2
  failed=1
}
if grep -qF "data-ds-anchor" "$html"; then
  echo "✗ with LOUPE=0, the page has data-ds-anchor: the loader ran" >&2
  failed=1
fi
if grep -qF "loupe/dist/toolbar/index.js" "$chunks"; then
  echo "✗ with LOUPE=0, the mount still names the Toolbar's module" >&2
  failed=1
fi

serve ""
grep -qF "data-ds-anchor" "$html" || { echo "✗ without LOUPE=0, the page has no data-ds-anchor" >&2; failed=1; }
grep -qF "loupe/dist/toolbar/index.js" "$chunks" || {
  echo "✗ without LOUPE=0, the mount names no Toolbar module: the needle above proves nothing" >&2
  failed=1
}

[ "$failed" -eq 0 ] && echo "✓ LOUPE=0 next dev runs the fixture with no loader and no Toolbar."
exit "$failed"
