#!/usr/bin/env bash
# Packs @danarocha/loupe, installs the tarball into a throwaway project and
# runs its bin: the path a product takes, which tests against `src` never do.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
pkg="$root/packages/loupe"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

expected="$(node -p "require('$pkg/package.json').version")"
tarball="$(cd "$pkg" && npm pack --pack-destination "$work" --silent | tail -n 1)"

mkdir "$work/consumer"
cd "$work/consumer"
npm init -y >/dev/null
npm install --no-audit --no-fund "$work/$tarball" >/dev/null

actual="$(./node_modules/.bin/loupe --version)"
if [ "$actual" != "$expected" ]; then
  echo "loupe --version printed '$actual', expected '$expected'" >&2
  exit 1
fi
echo "packed bin prints $actual"

# `meta` loads ts-morph and the TypeScript 6 alias lazily; only an installed
# tarball shows they resolve outside this workspace.
./node_modules/.bin/loupe meta \
  --tsconfig "$root/fixture/design-system/tsconfig.json" \
  --include components \
  --out "$work/meta"
status="$(node -p "require('$work/meta/components/ui/button.tsx.json').exports.Button.props.variant.status")"
if [ "$status" != "verified" ]; then
  echo "packed loupe meta read Button.variant as '$status', expected 'verified'" >&2
  exit 1
fi
echo "packed meta reads Button.variant as verified"

# `generate` from the installed tarball, into a throwaway Product layer inside the
# fixture (it must sit in the repo), then `--check` against what it wrote.
layer="$root/fixture/app/.loupe-packed"
trap 'rm -rf "$work" "$layer"' EXIT
(cd "$root" && "$work/consumer/node_modules/.bin/loupe" generate \
  --out fixture/app/.loupe-packed \
  --design-system fixture/design-system \
  --app fixture/app \
  --specifier @/.loupe-packed >/dev/null)
(cd "$root" && "$work/consumer/node_modules/.bin/loupe" generate --check --out fixture/app/.loupe-packed >/dev/null)
grep -q 'createAdapter("Button", Button$original)' "$layer/adapters/ds/ui/button.tsx"
echo "packed generate writes the Button Adapter and --check passes"
