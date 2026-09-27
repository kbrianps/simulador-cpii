#!/usr/bin/env bash
# Build the single-file app and publish it as index.html on the gh-pages branch (GitHub Pages).
# usage: tools/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
node tools/build.mjs
src_rev=$(git rev-parse --short HEAD)
dir=$(mktemp -d)
rmdir "$dir"
cleanup() { git worktree remove --force "$dir" >/dev/null 2>&1 || true; }
trap cleanup EXIT
if git ls-remote --exit-code --heads origin gh-pages >/dev/null 2>&1; then
  git fetch -q origin gh-pages
  git worktree add -q --detach "$dir" origin/gh-pages
else
  git worktree add -q --detach "$dir"
  git -C "$dir" checkout -q --orphan gh-pages
  git -C "$dir" rm -rfq .
fi
cp dist/simulador-cp2.html "$dir/index.html"
touch "$dir/.nojekyll"
git -C "$dir" add -A
if git -C "$dir" diff --cached --quiet; then
  echo "gh-pages is already up to date"
  exit 0
fi
git -C "$dir" commit -qm "Deploy $src_rev"
git -C "$dir" push -q origin HEAD:gh-pages
echo "published $src_rev to gh-pages"
