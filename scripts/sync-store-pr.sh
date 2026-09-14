#!/usr/bin/env bash
# Apply Chrome Viewport standalone fixes onto
# alirezamohammadpoor/raycast-extensions:ext/resize, push, comment on
# raycast/extensions#29803, and mark ready for review.
#
# Run on YOUR Mac (not the Cursor cloud agent terminal).
# Prefer: gh auth login  (HTTPS is fine — script uses `gh` to push)
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
PATCH="$ROOT/store-pr-chrome-viewport.patch"
REPLY="$ROOT/STORE_PR_REPLY.md"
test -f "$PATCH"
test -f "$REPLY"

if ! command -v gh >/dev/null; then
  echo "error: gh CLI required. Install: brew install gh" >&2
  exit 1
fi

LOGIN=$(gh api user --jq .login 2>/dev/null || true)
if [[ -z "$LOGIN" ]]; then
  echo "error: gh is not logged in. Run:" >&2
  echo "  gh auth login -h github.com -p https -s repo" >&2
  exit 1
fi
if [[ "$LOGIN" == "cursor" || "$LOGIN" == cursor\[bot\] ]]; then
  echo "error: gh is authenticated as cursor[bot]." >&2
  echo "Run on your Mac: gh auth login -h github.com -p https -s repo" >&2
  exit 1
fi
if [[ "$LOGIN" != "alirezamohammadpoor" ]]; then
  echo "warning: gh is logged in as '$LOGIN' (expected alirezamohammadpoor)" >&2
fi

# Ensure gh can push over HTTPS with your token.
gh auth setup-git >/dev/null

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

# HTTPS via gh credentials (works without SSH keys).
CLONE_URL="${RAYCAST_EXTENSIONS_URL:-https://github.com/alirezamohammadpoor/raycast-extensions.git}"

git clone --filter=blob:none --sparse --branch ext/resize --single-branch \
  "$CLONE_URL" "$WORKDIR/repo"
cd "$WORKDIR/repo"
git sparse-checkout set extensions/resize extensions/chrome-viewport
git reset --hard 0d6065693ebab1da849e6f452ae9c37013ad6714
git apply "$PATCH"
git add -A
git -c user.name="Ali" -c user.email="alirezamohammadp@gmail.com" \
  commit -m "feat: Chrome Viewport standalone + DevTools cycle fix"

echo "Pushing to ext/resize as ${LOGIN}..."
git push origin HEAD:ext/resize

gh pr comment 29803 --repo raycast/extensions --body-file "$REPLY"
gh pr ready 29803 --repo raycast/extensions
gh pr edit 29803 --repo raycast/extensions --title "Add Chrome Viewport extension"
echo "Done: https://github.com/raycast/extensions/pull/29803"
