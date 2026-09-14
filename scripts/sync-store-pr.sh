#!/usr/bin/env bash
# Apply Chrome Viewport standalone fixes onto
# alirezamohammadpoor/raycast-extensions:ext/resize, push, comment on
# raycast/extensions#29803, and mark ready for review.
#
# Run this on YOUR Mac (your GitHub SSH / gh auth) — not in the Cursor
# cloud workspace. The cloud agent token is cursor[bot] and gets 403 on
# the fork.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
PATCH="$ROOT/store-pr-chrome-viewport.patch"
REPLY="$ROOT/STORE_PR_REPLY.md"
test -f "$PATCH"
test -f "$REPLY"

# Refuse to run as the Cursor cloud bot — that identity cannot push the fork.
if git config --get-regexp 'credential|url\..*\.insteadof' 2>/dev/null | grep -qi 'cursor\|x-access-token'; then
  echo "error: git looks configured with Cursor cloud credentials." >&2
  echo "Run this on your Mac instead, in a normal terminal:" >&2
  echo "  cd /path/to/raycast-resize && ./scripts/sync-store-pr.sh" >&2
  exit 1
fi
if gh api user --jq .login 2>/dev/null | grep -qi '^cursor$'; then
  echo "error: gh is authenticated as cursor[bot]." >&2
  echo "On your Mac: gh auth login  (as alirezamohammadpoor), then re-run." >&2
  exit 1
fi

LOGIN=$(gh api user --jq .login 2>/dev/null || true)
if [[ -n "$LOGIN" && "$LOGIN" != "alirezamohammadpoor" ]]; then
  echo "warning: gh is logged in as '$LOGIN' (expected alirezamohammadpoor)" >&2
fi

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

# Force SSH so we don't pick up an HTTPS insteadOf → bot token path.
CLONE_URL="${RAYCAST_EXTENSIONS_URL:-git@github.com:alirezamohammadpoor/raycast-extensions.git}"
case "$CLONE_URL" in
  https://*)
    echo "error: CLONE_URL is HTTPS ($CLONE_URL)." >&2
    echo "Use SSH so your key is used, e.g.:" >&2
    echo "  RAYCAST_EXTENSIONS_URL=git@github.com:alirezamohammadpoor/raycast-extensions.git ./scripts/sync-store-pr.sh" >&2
    exit 1
    ;;
esac

# Isolate from global insteadOf / credential helpers that rewrite to HTTPS.
GIT_SSH_FLAGS=(
  -c "url.git@github.com:.insteadOf="
  -c "url.https://github.com/.insteadOf="
  -c "credential.helper="
)

git "${GIT_SSH_FLAGS[@]}" clone --filter=blob:none --sparse --branch ext/resize --single-branch \
  "$CLONE_URL" "$WORKDIR/repo"
cd "$WORKDIR/repo"
git sparse-checkout set extensions/resize extensions/chrome-viewport
git reset --hard 0d6065693ebab1da849e6f452ae9c37013ad6714
git apply "$PATCH"
git add -A
git -c user.name="Ali" -c user.email="alirezamohammadp@gmail.com" \
  commit -m "feat: Chrome Viewport standalone + DevTools cycle fix"

echo "Pushing to ext/resize via SSH…"
git "${GIT_SSH_FLAGS[@]}" push origin HEAD:ext/resize

gh pr comment 29803 --repo raycast/extensions --body-file "$REPLY"
gh pr ready 29803 --repo raycast/extensions
gh pr edit 29803 --repo raycast/extensions --title "Add Chrome Viewport extension"
echo "Done: https://github.com/raycast/extensions/pull/29803"
