# Viu

A mobile client for a [herdr](https://herdr.dev) agent fleet. See `README.md` for what it is.

## Working in this repo

npm workspaces at the root. The layout and the commands are in `README.md`, and the gate those
commands form is what `.github/workflows/ci.yml` runs on every pull request - nothing else gates a
change.

Two things the layout does not say out loud: `app/` is reserved space with no app in it yet, and a
protocol change belongs in one commit touching both sides rather than two commits that drift.

The middleman has one seam and one translation boundary, and both are load-bearing for every ticket
after #14: `createMiddleman` and `serveMiddleman` take a `HerdrConnection` rather than opening a
socket, and herdr's vocabulary stops at the modules that hold one - `middleman/src/fleet.ts` for the
fleet, every pane state and the screenful, `middleman/src/send.ts` for sending,
`middleman/src/startup.ts` for the handshake that reads herdr's protocol version. A herdr word may
appear in those three and nowhere else, and never in `@viu/protocol`. A fourth such module is a real
cost, so fold into an existing one unless the capability is genuinely separate. Test through that
door with `middleman/src/testing/fake-herdr.ts` and assert only what comes back out - never reach
inside for the socket client or the translation. In that fake, `showPanes` emits herdr's pane events
and `showScreen` deliberately emits none, because herdr has no output event - which is why
`middleman/src/watch.ts` subscribes for the fleet and polls for a watched pane's content.
`middleman/README.md` holds the herdr-to-Viu mapping.

What the middleman binds to is the whole of the access control (ADR 0003), so the bind addresses are
an argument to `serveMiddleman` rather than something it reads for itself: that is what lets
`middleman/src/service.test.ts` prove the tailnet-only property on loopback, and it is the one part
of this codebase where a convenient fallback would be a security hole rather than a bug. One test
does not use the fake-herdr door, and only this one may: a fake herdr cannot express herdr being
absent, so `middleman/src/herdr/socket.test.ts` greets a real socket client at a path with no herdr
behind it. Installing and enabling the service is the machine owner's step, not an agent's;
`middleman/README.md` documents it.

The chat grammar in `middleman/src/chat.ts` reads a terminal screen, so every rule in it should come
from a screen someone actually looked at. `npm start -- <pane>` reads a real pane through the whole
middleman and is the fastest way to check one; the panes on this machine are the reference material.

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
