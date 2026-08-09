# Viu

A mobile client for a [herdr](https://herdr.dev) agent fleet.

See your panes, open an agent, read what it said, and answer it - by voice or keyboard - from your phone.

Viu talks to a middleman on the host machine over [Tailscale](https://tailscale.com). It is not an SSH client and not a terminal emulator.

## Layout

Two sides, one repo, because the protocol between them is one set of type definitions both sides
compile against.

| Directory    | What it is                                                  |
| ------------ | ----------------------------------------------------------- |
| `middleman/` | The service that runs on the machine. TypeScript on Node.   |
| `app/`       | The phone client. Reserved space - not built yet.           |
| `protocol/`  | The protocol both sides compile against.                    |
| `docs/adr/`  | Why things are the way they are. Read before changing them. |

## Running the middleman locally

```sh
npm install
npm start
```

It reads the fleet from herdr's socket and prints it as the phone would receive it, then exits.
`npm start -- <pane>` prints that pane's conversation instead, and `npm start -- <pane> down enter`
presses those keys into it. See
[`middleman/README.md`](middleman/README.md) for the longer version.

## Checks

```sh
npm run typecheck
npm run lint
npm test
```

CI runs those three on every pull request.

## Status

Early. The stack is chosen - TypeScript on Node for the middleman
([ADR 0012](docs/adr/0012-the-middleman-is-typescript.md)), React Native with Expo on Android for
the app ([ADR 0002](docs/adr/0002-react-native-expo-android-only.md)) - and the middleman can see
the fleet, read a pane as a conversation, and send into one. Pushing changes to a phone is still to
come, and so is the app.
