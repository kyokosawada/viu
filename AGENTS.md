# Viu

A mobile client for a [herdr](https://herdr.dev) agent fleet. See `README.md` for what it is.

## Working in this repo

npm workspaces at the root. The layout and the commands are in `README.md`, and the gate those
commands form is what `.github/workflows/ci.yml` runs on every pull request - nothing else gates a
change.

Two things the layout does not say out loud: `app/` is reserved space with no app in it yet, and a
protocol change belongs in one commit touching both sides rather than two commits that drift.

## Agent skills

### Issue tracker

Issues are tracked as GitHub issues in `kyokosawada/viu` via the `gh` CLI. External PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical label vocabulary, unmapped - `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
