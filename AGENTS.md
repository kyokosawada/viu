# Viu

A mobile client for a [herdr](https://herdr.dev) agent fleet. See `README.md` for what it is.

## Working in this repo

npm workspaces at the root: `middleman/` (the service), `app/` (the phone client, reserved and not
built yet), `protocol/` (the types both sides compile against). Layout and commands are in
`README.md`; a protocol change belongs in one commit touching both sides.

`npm run typecheck`, `npm run lint` and `npm test` from the root are the whole gate, and CI
(`.github/workflows/ci.yml`) runs exactly those three on every pull request.

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
