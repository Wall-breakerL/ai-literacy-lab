# V2 Archive And Main Reset Runbook

## Migration Purpose

This migration prepares a controlled repository reboot while preserving all V2 history:

- Freeze the current V2 code line into branch `archive-v2`.
- Create immutable freeze tag `v2-freeze-2026-03-31`.
- Reboot `main` as a new orphan root history for the next phase.
- Keep the same GitHub repository and keep `main` as default branch.

## Non-Goals

- Do not delete old history.
- Do not create a new repository.
- Do not auto-push remote rewrite from script.

## Risks And Safety Notes

1. **Wrong source commit frozen**
   - Risk: `archive-v2` and tag point to unexpected commit.
   - Mitigation: verify `git rev-parse --short HEAD` before running script.

2. **Uncommitted local changes**
   - Risk: generated root history includes accidental files.
   - Mitigation: script aborts if worktree is not clean.

3. **Force push to remote `main`**
   - Risk: collaborators must re-sync local clones.
   - Mitigation: push is manual only and uses `--force-with-lease --force-if-includes`.

4. **Branch protection blocks push**
   - Risk: push rejected by GitHub policies.
   - Mitigation: temporary policy adjustment through maintainers, then restore protection.

5. **Rollback delay**
   - Risk: confusion after rewrite if no rollback path is documented.
   - Mitigation: explicit rollback commands below using `archive-v2`, tag, and reflog.

## Recommended Execution Order

1. Ensure local repo is clean and up to date with `origin/main`.
2. Run `scripts/git/freeze-v2-and-reset-main.sh` locally.
3. Review results before any push:
   - `git log --oneline --decorate -n 5`
   - `git branch -vv`
   - `git tag -l "v2-freeze-2026-03-31"`
4. Communicate rewrite window to collaborators.
5. Run final push commands manually.
6. Re-enable or tighten branch protection policies.

## What The Script Does

The script performs the following local-only operations:

1. Validates Git repo, clean worktree, and `origin` remote.
2. Freezes current `HEAD` into `archive-v2` (create or move local branch).
3. Creates annotated tag `v2-freeze-2026-03-31` on freeze commit (if not already present).
4. Reboots `main` via orphan branch:
   - create orphan branch from no parent,
   - remove tracked files from index/worktree,
   - create minimal `README.md`, `.gitignore`, `LICENSE`,
   - create new root commit.
5. Renames orphan branch to `main`.
6. Prints manual push commands and exits without pushing.

## Final Push Commands (Manual)

Run only after review and team notification:

```bash
# Push frozen branch and tag first (safe, additive)
git push origin archive-v2
git push origin v2-freeze-2026-03-31

# Rewrite remote main explicitly (intentional history reset)
git push origin main --force-with-lease --force-if-includes
```

## If GitHub Branch Protection Is Enabled

1. Open repository settings and find branch rule/ruleset affecting `main`.
2. Temporarily allow maintainers (or your role) to push rewritten history to `main`.
3. Keep required reviews/checks policy changes minimal and time-boxed.
4. Execute the final push command once.
5. Immediately restore strict protection:
   - disallow force push again (if policy requires),
   - keep required checks/reviews as normal for future commits.
6. Post an internal notice with:
   - new `main` root commit hash,
   - frozen references: `archive-v2` and `v2-freeze-2026-03-31`,
   - collaborator resync instructions (`git fetch --all --prune`, reset local `main`).

## Rollback Guide

### Case A: Need to restore remote `main` to frozen V2 state

```bash
git checkout main
git reset --hard archive-v2
git push origin main --force-with-lease --force-if-includes
```

### Case B: Use freeze tag as source of truth

```bash
git checkout main
git reset --hard v2-freeze-2026-03-31
git push origin main --force-with-lease --force-if-includes
```

### Case C: Recover local state from reflog (before push)

```bash
git reflog
# identify previous main tip SHA
git checkout main
git reset --hard <previous-main-sha>
```

## Collaboration Note

After remote main is rewritten, collaborators with old `main` history should resync:

```bash
git fetch --all --prune
git checkout main
git reset --hard origin/main
```
