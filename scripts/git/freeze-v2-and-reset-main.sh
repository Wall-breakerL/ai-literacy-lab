#!/usr/bin/env bash

set -euo pipefail

ARCHIVE_BRANCH="archive-v2"
FREEZE_TAG="v2-freeze-2026-03-31"
ORPHAN_BRANCH="main-reboot-orphan"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: required command not found: $1" >&2
    exit 1
  fi
}

require_clean_worktree() {
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "Error: working tree is not clean. Commit/stash/clean changes first." >&2
    exit 1
  fi
}

require_cmd git

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: current directory is not inside a Git repository." >&2
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "Error: remote 'origin' not found. Add origin before migration." >&2
  exit 1
fi

require_clean_worktree

SOURCE_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
FREEZE_COMMIT="$(git rev-parse --verify HEAD)"
SHORT_FREEZE_COMMIT="$(git rev-parse --short "$FREEZE_COMMIT")"

echo "==> Freeze source branch: ${SOURCE_BRANCH}"
echo "==> Freeze source commit: ${SHORT_FREEZE_COMMIT}"

echo "==> Creating/updating local archive branch: ${ARCHIVE_BRANCH}"
git branch -f "${ARCHIVE_BRANCH}" "${FREEZE_COMMIT}"

echo "==> Creating freeze tag: ${FREEZE_TAG}"
if git rev-parse -q --verify "refs/tags/${FREEZE_TAG}" >/dev/null; then
  EXISTING_TAG_COMMIT="$(git rev-list -n 1 "${FREEZE_TAG}")"
  if [[ "${EXISTING_TAG_COMMIT}" != "${FREEZE_COMMIT}" ]]; then
    echo "Error: tag ${FREEZE_TAG} already exists on a different commit." >&2
    echo "       Existing: $(git rev-parse --short "${EXISTING_TAG_COMMIT}")" >&2
    echo "       Current : ${SHORT_FREEZE_COMMIT}" >&2
    exit 1
  fi
  echo "==> Tag already exists on expected commit. Keeping as-is."
else
  git tag -a "${FREEZE_TAG}" "${FREEZE_COMMIT}" -m "Freeze V2 baseline on ${FREEZE_TAG}"
fi

if git show-ref --verify --quiet "refs/heads/${ORPHAN_BRANCH}"; then
  echo "Error: temporary branch '${ORPHAN_BRANCH}' already exists. Remove it first." >&2
  exit 1
fi

echo "==> Creating orphan branch: ${ORPHAN_BRANCH}"
git switch --orphan "${ORPHAN_BRANCH}"

echo "==> Clearing tracked files from index/worktree"
git rm -rf . >/dev/null 2>&1 || true

echo "==> Writing minimal clean-slate files"
cat > README.md <<'EOF'
# Human-AI Performance Lab

Human-AI Performance Lab is a research repository for human-agent collaboration studies.

Repository reboot in progress.
EOF

cat > .gitignore <<'EOF'
# Minimal reboot ignore set
.DS_Store
node_modules/
.env.local
EOF

cat > LICENSE <<'EOF'
License placeholder. Final license terms will be added in a follow-up commit.
EOF

git add README.md .gitignore LICENSE
git commit -m "chore: reboot main with clean slate root"

echo "==> Renaming orphan branch to main"
git branch -M main

echo
echo "Migration prepared locally. No remote push has been executed."
echo "Review first, then run push commands manually:"
echo "  git push origin ${ARCHIVE_BRANCH}"
echo "  git push origin ${FREEZE_TAG}"
echo "  git push origin main --force-with-lease --force-if-includes"
