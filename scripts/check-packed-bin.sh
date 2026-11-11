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
