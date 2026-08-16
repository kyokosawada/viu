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
| `app/`       | The phone client. React Native with Expo, on Android.      |
| `protocol/`  | The protocol both sides compile against.                    |
| `docs/adr/`  | Why things are the way they are. Read before changing them. |

## Running the middleman locally

```sh
npm install
npm start
```

It reads the fleet from herdr's socket and prints it as the phone would receive it, then exits.
`npm start -- <pane>` prints that pane's conversation instead, `npm start -- <pane> down enter`
presses those keys into it, and `npm start -- <pane> --watch` holds a connection open and prints
changes as they arrive. See
[`middleman/README.md`](middleman/README.md) for the longer version.

## Running the middleman for real

```sh
npm run serve
```

The same middleman, left running and serving the fleet over HTTP on the tailnet interface only -
being on the tailnet is the whole of the authorisation
([ADR 0003](docs/adr/0003-tailscale-is-the-access-control.md)). Installing it as a service that
starts with the machine and restarts on its own is
[Running it for real](middleman/README.md#running-it-for-real).

## Running the app

```sh
cd app
npx expo run:android
```

It asks once for the machine on your tailnet that runs the middleman, then says whether it can reach
it. See [`app/README.md`](app/README.md) for the one door it talks to the machine through.

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
the fleet, read a pane as a conversation, send into one, hold a connection open pushing changes down
it, say which failure it hit and recover from a herdr that goes away under it, and run as a service
on the tailnet. The app is standing up: it is pointed at the machine once, says
whether it reached the middleman, shows the fleet as one flat list with the panes that need you
first, opens a pane as a conversation, and holds one connection open that keeps both live and
carries a pane that starts needing you through to whatever screen you are on - all through the one
client interface every screen after it uses. The Slab answers an open pane by voice or keyboard and
composes the words and any images into one send.
