# @viu/protocol

The one place the protocol between the middleman and the app is defined. Both sides compile against
these types, which is the reason the middleman is TypeScript at all - see
[ADR 0012](../docs/adr/0012-the-middleman-is-typescript.md).

It is deliberately thin right now: a protocol version and the pane addressing type
([ADR 0006](../docs/adr/0006-panes-are-the-addressing-model.md)). The request and event shapes the
middleman exposes land with the middleman itself, in
[#14](https://github.com/kyokosawada/viu/issues/14).

## How each side reaches it

Both sides consume this package by name, `@viu/protocol`, resolved through npm workspaces.

- **The middleman** imports the built output (`dist/`), produced by `npm run build` at the repo root.
- **The app** resolves the `react-native` condition in `package.json`, which points Metro straight
  at `src/index.ts`. Expo's bundler is happier compiling the source than following a sibling
  package's build output, and there is no build step to forget.

If Metro ever refuses to follow the workspace symlink out of `app/`, the documented fallback is to
generate the declarations into `app/` as a build step. Nothing has needed that yet - the app does
not exist yet, so the direct route is untested against a real Expo bundle.

## Changing the protocol

Change it here, in one commit, and both sides fail to compile together rather than drifting apart.
Bump `PROTOCOL_VERSION` when a change is not backwards compatible with a phone that is already
installed.
