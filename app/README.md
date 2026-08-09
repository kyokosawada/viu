# @viu/app

The phone client. React Native with Expo, Android only - see
[ADR 0002](../docs/adr/0002-react-native-expo-android-only.md). There is no iOS target and no web
target, and `app.json` says so.

Today it is pointed at the machine on your tailnet that runs the middleman, says whether it can
reach it - naming the herdr the middleman greeted - shows the fleet, opens a pane as a
conversation, and keeps both live off one connection it holds open.

## Running it

From this directory:

```sh
npx expo start --android   # the JavaScript, against an installed dev build
npx expo run:android       # build and install on a connected device or emulator
```

`npx expo run:android` generates `android/` from `app.json` each time
([continuous native generation](https://docs.expo.dev/workflow/continuous-native-generation/)), so
that directory is not committed and hand-edits to it are lost. A native or configuration change
needs that full rebuild; a JavaScript change reaches an installed app over the air.

## The one door to the machine

Everything that talks to the machine goes through `MiddlemanClient` in `src/middleman/client.ts`.
Nothing else in the app makes a network call, and every later screen depends on that interface
rather than on `fetch`. It is the app's half of the seam the middleman already has on its own side,
where `createMiddleman` takes a `HerdrConnection` rather than opening a socket.

- `src/middleman/http.ts` is the real one, reaching the middleman over HTTP on the tailnet. The
  function it fetches with and the one it opens a socket with are arguments rather than defaults,
  the way `serveMiddleman` takes its `HerdrConnection`, so nothing can reach the network by
  forgetting to pass one. Its patience covers reading the answer, not just receiving its head.
- `src/middleman/trouble.ts` is the only place an answer becomes a **trouble**, the same way
  `middleman/src/trouble.ts` is on the machine. A failure Viu has no name for is not passed through,
  and a new kind in `@viu/protocol` fails to compile here until the phone has something to say
  about it.
- `src/testing/fake-middleman.ts` is the fake every app test drives the app through - no network, no
  running middleman. It can greet as a named herdr, show a fleet (`shows`), show a pane's turns
  (`showsThePane`), name any trouble, answer as something that is not the middleman, fail to answer
  at all, go away, and come back (`goesAway`, `comesBack`), which mirrors
  `middleman/src/testing/fake-herdr.ts`. It answers each ask on its own terms rather than as one
  switch - `troublesTheFleet` fails only the fleet and `troublesThePane` only the watched pane,
  which is what a herdr that falls over between the greeting and the fleet actually looks like.
  `shows` and `showsThePane` are also how a test makes something happen on the machine while the
  app holds a connection open, so one verb covers "this is the fleet" and "the fleet just changed".
  What reached it is asked for by the same door: `greetedFrom`, `connectedFrom`, `connectionsHeld`,
  `watchedPanes` and `nowWatching`.

A **reach** says one of four things, and they are deliberately not one failure: the middleman was
reached and it got back what it asked for, nothing answered, something answered that is not the
middleman, or the middleman named a trouble. Each is a different screen because each is a different
thing to do about it. Every ask down this seam answers with a `Reach` of whatever it asked for, and
so does everything that arrives on the held connection, so the three ways of not getting there are
written once and every later call inherits them. The seam is three things: `greet()`, the
reachability check at `GET /`; `connect(receive)`, the one connection everything the app shows comes
down; and `send(paneId, text)`, the one thing it says back. The rest of the HTTP surface is in
[`middleman/README.md`](../middleman/README.md).

An answer is only taken for what it claims to be: a pane in a state Viu has no word for, one missing
something every pane carries, one without the handle it is addressed by, or two panes claiming the
same handle all make the whole answer `not-the-middleman` rather than quietly becoming half a
fleet.

Nothing the app awaits is left without an answer: a client that rejects, a phone that cannot read
what it stored, and a phone that cannot write it are each shown or worked around rather than leaving
a screen waiting forever. Those three are tests, not intentions.

## The fleet

Once the middleman is reached, the fleet is the screen. It is one flat list of every pane herdr
knows about, with no workspace or tab grouping
([ADR 0009](../docs/adr/0009-the-fleet-is-flat.md)): the panes that **need you** first, each
labelled by its **project** - or by the handle it is addressed by, when herdr gave no directory - and
showing its state, under it the **agent** in the pane and what it is doing. `src/fleet.ts` holds that
ordering, that label and that detail, `src/ui/TheFleet.tsx` draws them, and the middleman already
sorts the same way, so the app agrees with the machine rather than depending on it.

`@viu/protocol` has a fifth pane state beyond the four a person is shown: `unknown`, for an
`agent_status` neither side has a word for. The fleet says **Unclear** for it, which is a different
thing from **dormant** and has to read as one, since a dormant pane is the ordinary resting state of
finished work and this is Viu admitting it cannot tell.

## A pane, read as a conversation

Tapping a pane in the fleet opens it and watches it - `watch(paneId)` on the held connection - and
its **screenful** arrives as **turns**. `src/ui/ThePane.tsx` draws what comes back, and the pane's
label, state and agent are the fleet's own (`src/fleet.ts`), so the two screens cannot say different
things about the same pane.

The grammar that decides what a turn is stays on the machine
([ADR 0007](../docs/adr/0007-the-middleman-renders-the-chat.md)); the app only draws the roles
`@viu/protocol` names, and re-deriving any of them here would be a second grammar to keep in step.

- An `agent` turn and a `person` turn are distinguished by where the card sits and how it is marked,
  and each says who spoke, because following who said what is the whole point of showing a pane as
  chat rather than a screen.
- A `pane` turn - a plain shell, or a **dormant pane** the grammar has no structure for - is one
  raw-text card in a monospaced face across the full width. It is meant to read as raw output
  honestly shown rather than as a turn that failed to parse.
- A turn the screenful `cut` off is marked **Cut off**, on any of the three roles. Half a message
  must never be able to read as a whole one.

There is no scrollback to reach for: a screenful is all that exists (`CONTEXT.md`), so what the read
returns is the whole of what can be shown.

## The Slab

`src/ui/TheSlab.tsx` is the full-width bar at the bottom of an open pane, and it is there whatever
state the pane is in ([ADR 0020](../docs/adr/0020-the-slab-is-always-available-and-says-what-it-knows.md)).
Holding it dictates and letting go ends the capture and sends nothing
([ADR 0016](../docs/adr/0016-the-slab-is-a-hold-bar.md)); the words then sit in an editable field
with **Discard** and **Send** beside each other, and nothing is dimmed or covered while any of that
happens, because the turn being answered is usually the last one on the screen.

Dictation is the app's second seam. `src/dictation/dictation.ts` is the interface -
`hold(hearing)` answers with something that can be released, and what is heard is either partial
words, the words the engine settled on, or what it had when it was **cut short**
([ADR 0017](../docs/adr/0017-interrupted-dictation-keeps-what-it-heard.md)). Releasing is safe after
the engine has already settled, so a hold that failed mid-way needs no special handling from the
caller. `src/dictation/on-device.ts` is the real one: the Android engine in en-US, on-device only
([ADR 0015](../docs/adr/0015-dictation-is-english-only.md)), and the only file in the app that
imports `expo-speech-recognition`. It is native, so it reaches the phone through
`npx expo run:android` rather than over the air. `src/testing/fake-dictation.ts` is the door every
test drives it through - `hears` for partials, `settlesOn` for what the engine finally makes of
them, `breaksOff` for a failure mid-hold - with no microphone. The engine is wired in `src/Viu.tsx`;
an `App` given no dictation has nothing to dictate with and says so rather than pretending to
listen.

Sending goes down the one door to the machine, `send(paneId, text)`, and what the Slab then says is
exactly what came back (`src/sending.ts`), which is the whole point of
[ADR 0006](../docs/adr/0006-panes-are-the-addressing-model.md):

| What the middleman answered          | What the Slab says                                          |
| ------------------------------------ | ----------------------------------------------------------- |
| `confirmed`, with the agent's state  | **Confirmed**, and what the agent is doing now               |
| `queued`, on a pane holding no agent | **Sent**, and that there is no agent here to confirm it      |
| `queued`, on a pane holding an agent | **Queued**, and that the agent was not seen to take it       |
| either `queued` with `mayBeCut`      | the same, and a warning that a long line may have been cut   |

The middleman answers `queued` both for a plain shell and for an agent that was still mid-turn when
the wait expired, and it cannot tell those apart from the send alone. Which of the two happened is a
property of the pane, so the pane the fleet already knows about decides which sentence is honest -
never the send on its own. `mayBeCut` only ever arrives on a `queued` send, because a confirmed one
went in as a prompt rather than as a line for a shell to read. A trouble the send hit is named the
way every other trouble is, and the words are kept - with their cut-short mark, if they had one - so
a failed send never loses what was dictated.

A send is also given far more patience than a read: the middleman waits on the agent to be seen
picking the text up before it answers at all (`middleman/README.md`), so the read timeout would
abort a send that was still perfectly well under way.

## Live

The app holds one connection open and never polls on a timer
([ADR 0010](../docs/adr/0010-the-middleman-streams-to-the-phone.md)). It is opened once the
middleman has been greeted and it is where the fleet and the watched pane's conversation both come
from - there is no separate first read, because the middleman pushes each one the moment it has
somewhere to push it. Every update is a whole value applied by replacing what was there, so the
fleet reorders and a conversation grows without the app merging anything.

`watch(paneId)` and `stopWatching()` follow the person rather than a timer: opening a pane watches
it, going back to the fleet stops, and opening another switches. Only the pane on screen is
watched, which is what keeps a phone in a pocket from costing herdr anything
(`middleman/README.md`, Pushing changes to the phone).

A fleet update arrives wherever the app is, including inside a different pane, which is the whole
point of it: a pane that starts to **need you** is named at the top of the pane being read and
opens on a tap. The pane on screen is never named there, since its own header already says it.

`src/phone.ts` is the second seam, and it exists for the same reason the first one does: `AppState`
cannot be driven in a test. Putting the phone away closes the connection outright rather than
merely unwatching, because a backgrounded app has nothing to draw; picking it up opens a new one
and watches whatever pane was open. `src/testing/phone-in-hand.ts` is what a test puts down and
picks up.

## The machine

The machine's tailnet host and port are asked for once and kept on the phone
(`src/machine-store.ts`), because being on the tailnet is the whole of the authorisation
([ADR 0003](../docs/adr/0003-tailscale-is-the-access-control.md)) and there is nothing else to log
in with. The port defaults to the middleman's 8787. There is no offline cache
([ADR 0014](../docs/adr/0014-no-offline-cache.md)): when the machine cannot be reached the app says
so and shows nothing else.

## Checks

`npm run typecheck`, `npm run lint` and `npm test` at the repo root cover this workspace. The tests
here run on Jest with `jest-expo` and React Native Testing Library, rather than the repo's Vitest,
because they render React Native components; the root `npm test` runs both. The per-test timeout in
`jest.config.js` is generous on purpose: the first test in a file pays for transforming the React
Native module tree, which on CI runs into Jest's default and fails a test that is not slow. Assert on what the app
renders and on what reaches the middleman client, never on component internals.

`@viu/protocol` resolves straight to its source through the `react-native` export condition, under
Metro and under TypeScript alike - see [`protocol/README.md`](../protocol/README.md). Nothing is
built before the app runs.
