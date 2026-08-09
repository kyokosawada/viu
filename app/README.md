# @viu/app

The phone client. React Native with Expo, Android only - see
[ADR 0002](../docs/adr/0002-react-native-expo-android-only.md). There is no iOS target and no web
target, and `app.json` says so.

Today it does one thing: it is pointed at the machine on your tailnet that runs the middleman, and
it says whether it can reach it - naming the herdr the middleman greeted - or says it cannot.

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
  running middleman. It can greet as a named herdr, name any trouble, answer as something that is
  not the middleman, fail to answer at all, go away, and come back (`goesAway`, `comesBack`), which
  mirrors `middleman/src/testing/fake-herdr.ts`.

A **reach** says one of four things, and they are deliberately not one failure: the middleman was
reached, nothing answered, something answered that is not the middleman, or the middleman named a
trouble. Each is a different screen because each is a different thing to do about it. `GET /` is the
reachability check; the rest of the HTTP surface is in
[`middleman/README.md`](../middleman/README.md).

Nothing the app awaits is left without an answer: a client that rejects, a phone that cannot read
what it stored, and a phone that cannot write it are each shown or worked around rather than leaving
a screen waiting forever. Those three are tests, not intentions.

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
