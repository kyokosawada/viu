# @viu/app

The phone client. React Native with Expo, Android only - see
[ADR 0002](../docs/adr/0002-react-native-expo-android-only.md). There is no iOS target and no web
target, and `app.json` says so.

Today it is pointed at the machine on your tailnet that runs the middleman, says whether it can
reach it - naming the herdr the middleman greeted - and then shows the fleet.

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
  function it fetches with is an argument rather than a default, the way `serveMiddleman` takes its
  `HerdrConnection`, so nothing can reach the network by forgetting to pass one. Its patience covers
  reading the answer, not just receiving its head.
- `src/middleman/trouble.ts` is the only place an answer becomes a **trouble**, the same way
  `middleman/src/trouble.ts` is on the machine. A failure Viu has no name for is not passed through,
  and a new kind in `@viu/protocol` fails to compile here until the phone has something to say
  about it.
- `src/testing/fake-middleman.ts` is the fake every app test drives the app through - no network, no
  running middleman. It can greet as a named herdr, show a fleet (`shows`), show a pane's turns
  (`showsThePane`), name any trouble, answer as something that is not the middleman, fail to answer
  at all, go away, and come back (`goesAway`, `comesBack`), which mirrors
  `middleman/src/testing/fake-herdr.ts`. It answers each ask on its own terms rather than as one
  switch - `troublesTheFleet` fails only the fleet read and `troublesThePane` only the pane read,
  which is what a herdr that falls over between the greeting and the fleet actually looks like. What
  reached it is asked for by the same door: `greetedFrom`, `askedForTheFleet` and
  `askedForTheConversationOf`.

A **reach** says one of four things, and they are deliberately not one failure: the middleman was
reached and it got back what it asked for, nothing answered, something answered that is not the
middleman, or the middleman named a trouble. Each is a different screen because each is a different
thing to do about it. Every ask down this seam answers with a `Reach` of whatever it asked for, so
the three ways of not getting there are written once and every later call inherits them. `GET /` is
the reachability check and `GET /fleet` the fleet; the rest of the HTTP surface is in
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

Tapping a pane in the fleet opens it and reads its **screenful** as **turns** through the same one
door - `conversation(paneId)` on `MiddlemanClient`, `GET /panes/<pane>/conversation` in the real
one, with the handle percent-encoded. `src/ui/ThePane.tsx` draws what comes back, and the pane's
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
because they render React Native components; the root `npm test` runs both. Assert on what the app
renders and on what reaches the middleman client, never on component internals.

`@viu/protocol` resolves straight to its source through the `react-native` export condition, under
Metro and under TypeScript alike - see [`protocol/README.md`](../protocol/README.md). Nothing is
built before the app runs.
