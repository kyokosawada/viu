# Viu

A mobile client for a [herdr](https://herdr.dev) agent fleet. See `README.md` for what it is.

## Working in this repo

npm workspaces at the root. The layout and the commands are in `README.md`, and the gate those
commands form is what `.github/workflows/ci.yml` runs on every pull request - nothing else gates a
change.

One thing the layout does not say out loud: a protocol change belongs in one commit touching both
sides rather than two commits that drift. The gate is not uniform either - `app/` runs on Jest with
`jest-expo` because it renders React Native, so the root `test` and `typecheck` scripts each call
into that workspace after the Vitest and `tsc -b` half. Nothing in `app/` is built before it runs;
Metro and TypeScript both read `@viu/protocol` straight from source through the `react-native`
condition (`protocol/README.md`), and `app/android/` is generated from `app.json` rather than
committed.

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
`middleman/src/watch.ts` subscribes for the fleet and polls for a watched pane's content. The fake
also goes away and comes back (`goesAway`, `comesBack`) and refuses a named method (`refuses`),
which is how every failure is reached through that one door. `middleman/README.md` holds the
herdr-to-Viu mapping.

Every failure the phone can be told about is a `Trouble` in `@viu/protocol`, and the HTTP surface
and the connection the phone holds open must use the same one - `middleman/src/trouble.ts` is the
only place an error becomes one and the only place a status is chosen, so a new failure is added
there rather than at whichever surface hit it (#19, and `middleman/README.md` under When it
breaks).

The one thing the middleman writes to disk is an attachment (ADR 0022): a pane is a terminal, so
each image of a send is stored in `~/.viu/attachments/` and the agent is sent the owner's words with
each path standing where its image was placed (ADR 0024), as one ordinary prompt down the existing
send path. `middleman/src/attachments.ts` owns that directory, its naming, the seven-day sweep and
both directions of the path: the `promptFor` walk over the parts that puts a path in, and `marked`,
which renders one back as the `[image]` a turn reads as. That an image-bearing prompt may be left
standing unsubmitted by the agent, and what `sendTurn` presses and when, is measured in
`middleman/README.md` under What a Claude agent does with the path. The directory is an argument to
`createMiddleman` and `serveMiddleman`, but unlike the bind addresses it has a default, so a test
that sends an image without passing one writes into the developer's own home.

What the middleman binds to is the whole of the access control (ADR 0003), so the bind addresses are
an argument to `serveMiddleman` rather than something it reads for itself: that is what lets
`middleman/src/service.test.ts` prove the tailnet-only property on loopback, and it is the one part
of this codebase where a convenient fallback would be a security hole rather than a bug. One test
does not use the fake-herdr door, and only this one may: the fake can say herdr went away, but only
the real client can show what a socket with nothing behind it actually produces, so
`middleman/src/herdr/socket.test.ts` greets and subscribes at such a path. Installing and enabling
the service is the machine owner's step, not an agent's; `middleman/README.md` documents it.

The app has the same shape of seam on its side, and it is load-bearing for every ticket after #31:
`MiddlemanClient` in `app/src/middleman/client.ts` is the only thing in the app that talks to the
machine, `app/src/middleman/http.ts` is its real HTTP half, `app/src/middleman/trouble.ts` the only
place an answer becomes a `Trouble`, and `app/src/testing/fake-middleman.ts` the door every app test
drives the app through - no network, no running middleman. Assert on what the app renders and on
what reached the client, never on component internals. `app/README.md` says what a `Reach` can be
and why the four answers are not one failure. A missed `Reach` becomes words in
`app/src/ui/missed.ts` alone - heading, what was said, what to do about it, and which link of the
machine-middleman-herdr chain broke - so a new `Trouble` kind does not compile until the phone has
all four; only `unreachable` is retried, and
`app/src/recovering.ts` says why and how long it waits (#37, `app/README.md` under When it breaks).
Everything the phone draws is styled from one token module, `app/src/ui/look.ts` - a spacing scale,
a type ramp, three radii and semantic colour roles, and nothing outside it names a colour - and
`lookFor(scheme)`
resolves those roles per theme while `useLook()` reads the phone's own, so light and dark are one
resolver rather than a second set of styles (#67, `app/README.md` under The look).
`app/src/ui/Tap.tsx` is the `Pressable` every tap goes through.

That first seam is three calls and one connection: `greet()`, `send(paneId, sending)`,
`press(paneId, keys)`, and `connect(receive)`. A `Send` is the ordered parts of one message,
each part a run of words or one image, so words and pictures leave the phone together, there is no
second call for a picture, and where a picture sits in what was said survives the trip (ADR 0023 and
ADR 0024, protocol v5). Everything the app shows after the greeting arrives
on the one held connection - the fleet and the watched pane's conversation both - so a new screen
consumes an `Update` rather than adding an HTTP read (ADR 0010, #34). The middleman serves that
connection as a WebSocket at `GET /updates` (`middleman/src/updates.ts`), which is the only place
herdr's `Connection` becomes a socket.

The app has three more seams of the same discipline, and only three, each for a native thing no test
can run. One is dictation (`app/src/dictation/dictation.ts`, the real engine in `on-device.ts`, the
fake in `app/src/testing/fake-dictation.ts`), because the en-US engine cannot run in a test. That is
also the only place `expo-speech-recognition` may be imported, and it is native, so it reaches the
phone through a rebuild rather than over the air. One is picking an image
(`app/src/picking/picking.ts`, the real one in `on-the-phone.ts`, the fake in
`app/src/testing/fake-picking.ts`), the only place `expo-image-picker` and `expo-image-manipulator`
may be imported: the picture is downscaled and made a JPEG there, before it leaves the phone, so
what crosses the seam is already something the middleman can store (#50). The last is the phone
itself (`app/src/phone.ts`), for `AppState` alone, and it is why "the phone was put away" is
testable. A draft becomes those ordered parts in `app/src/composing.ts` alone - it owns the
`[Image #1]` token, placing one at the caret, taking one out again, and dropping one that stands
for no attached image (#60, `app/README.md`); the placeholder a Claude pane draws reads the same
and is its own, which `middleman/README.md` measures - and what the Slab says about a send is
decided in `app/src/sending.ts` alone, from what the middleman answered plus the pane it was sent
into: the middleman answers `queued` for both a plain shell and an agent that was mid-turn, and
only the pane tells those apart (`app/README.md`).

No app test reaches a real socket, so nothing in the gate can catch a native-config regression. The
middleman is plain HTTP on purpose (ADR 0003), which Android blocks by default, so `app/app.json`
permits cleartext through `expo-build-properties`; verify a change to that config by reading
`android:usesCleartextTraffic` out of the manifest `npx expo prebuild --platform android` generates,
and remember it only reaches a phone through a rebuild.

The chat grammar in `middleman/src/chat.ts` reads a terminal screen, so every rule in it should come
from a screen someone actually looked at. `npm start -- <pane>` reads a real pane through the whole
middleman and is the fastest way to check one; the panes on this machine are the reference material.
An agent with no pane here is still reachable without herdr; `middleman/README.md` carries the route
the `pi` reader's marks were taken by.

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
