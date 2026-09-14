#!/usr/bin/env bash
# Apply Chrome Viewport standalone fixes onto alirezamohammadpoor/raycast-extensions:ext/resize,
# push, comment on raycast/extensions#29803, and mark ready for review.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
PATCH="$ROOT/store-pr-chrome-viewport.patch"
REPLY="$ROOT/STORE_PR_REPLY.md"
test -f "$PATCH"
test -f "$REPLY"

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

CLONE_URL="${RAYCAST_EXTENSIONS_URL:-git@github.com:alirezamohammadpoor/raycast-extensions.git}"
git clone --filter=blob:none --sparse --branch ext/resize --single-branch \
  "$CLONE_URL" "$WORKDIR/repo"
cd "$WORKDIR/repo"
git sparse-checkout set extensions/resize extensions/chrome-viewport
git reset --hard 0d6065693ebab1da849e6f452ae9c37013ad6714
git apply "$PATCH"
git add -A
git commit -m "feat: Chrome Viewport standalone + DevTools cycle fix"
git push origin HEAD:ext/resize

gh pr comment 29803 --repo raycast/extensions --body-file "$REPLY"
gh pr ready 29803 --repo raycast/extensions
gh pr edit 29803 --repo raycast/extensions --title "Add Chrome Viewport extension"
echo "Done: https://github.com/raycast/extensions/pull/29803"
