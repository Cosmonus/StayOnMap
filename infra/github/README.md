# GitHub repo configuration

Settings that live in GitHub rather than in code, kept here so they are
reproducible instead of tribal knowledge. Nothing in this directory runs
automatically — these are payloads you apply by hand.

## Required status checks on `master`

```bash
gh api -X PATCH repos/Cosmonus/StayOnMap/branches/master/protection/required_status_checks \
  --input infra/github/branch-protection-checks.json
```

Idempotent — re-running is safe and simply restates the list.

Read the current state with:

```bash
gh api repos/Cosmonus/StayOnMap/branches/master/protection/required_status_checks
```

### Two things that are easy to get wrong

**A check is matched by NAME, and the name is the job's `name:` in the
workflow — not the job id.** Rename a job and every required check pointing at
the old name waits forever for something nothing produces. The branch then looks
like it has stuck CI rather than a config mismatch. This nearly happened on
2026-08-07: a branch renamed `Frontend (lint + build)` →
`Frontend (lint + test + build)` and `Mobile (bundle smoke check)` →
`Mobile (test + bundle smoke check)` when test steps were added, so the required
names had to move with them.

**If you rename a job, PRs branched from the older `master` will report the old
name and become unmergeable** until they pick up the new workflow. Rebase them
onto the branch that renamed it.

**`Deploy to production VM` is deliberately NOT required.** It is gated on
`github.event_name == 'push'`, so on a pull request it reports `skipping` and
never completes — requiring it would deadlock every PR.

### The failure mode worth knowing

"Require status checks" can be **enabled with an empty list**. That is the worst
state available: the UI reads as protected and nothing is enforced. Found
exactly that on 2026-08-07. When checking, confirm the LIST is non-empty, not
just that the toggle is on.

## Full protection state, for reference

As of 2026-08-07: 5 required checks, `strict` (branch must be up to date) on,
`enforce_admins` on, PR reviews required, force-pushes and deletions blocked.

```bash
gh api repos/Cosmonus/StayOnMap/branches/master/protection
```
