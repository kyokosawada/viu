# @viu/protocol

The one place the protocol between the middleman and the app is defined. Both sides compile against
these types, which is the reason the middleman is TypeScript at all - see
[ADR 0012](../docs/adr/0012-the-middleman-is-typescript.md).

It is deliberately thin: a protocol version, the pane addressing type
([ADR 0006](../docs/adr/0006-panes-are-the-addressing-model.md)), the fleet - a flat list of panes
([ADR 0009](../docs/adr/0009-the-fleet-is-flat.md)) in Viu's own vocabulary
([ADR 0008](../docs/adr/0008-viu-defines-its-own-vocabulary.md)), each carrying the project it works
in, what its agent is doing, and the state it is in - and a pane's **screenful** as conversation
**turns**. `CONTEXT.md` defines those words; the middleman is where herdr's are translated into them.

A pane carries no timestamp and no last line. Neither has an honest source yet: the middleman keeps
no state to date a pane from. Events land with the ticket that needs them.

`Update` is what arrives on a held connection, and it is a union of the two things the phone is told
without asking: the fleet, and the conversation of the pane it is watching
([ADR 0010](../docs/adr/0010-the-middleman-streams-to-the-phone.md)). Both are whole values rather
than deltas, so a client applies one by replacing what it had - there is no order to preserve and no
patch to misapply. A fleet update reaches every client whatever it is looking at; a conversation
update only reaches the clients watching that pane.

`Sent` is a union rather than one shape with an optional field, because the two guarantees herdr
gives are not the same guarantee ([ADR 0006](../docs/adr/0006-panes-are-the-addressing-model.md)).
A `confirmed` send carries the state the agent is in afterwards; a `queued` send cannot, because
nothing beyond "the bytes were queued" is known. The phone reads `confidence` and gets the right
answer without probing, and the type stops it reading a state that was never observed.

`KEYS` is the whole set of keys a pane can be sent, and `Key` is derived from it rather than
declared beside it, so the list a quick-key row is built from and the names the middleman accepts
cannot drift apart. It is a small set on purpose: it names what an agent's picker asks for - the
arrows, enter, tab, escape - plus the one control key worth reaching from a phone. `ctrl-c` is a key
name rather than a modifier applied to a letter, so there is no grammar to spell a second control
key with, and the phone can single that one out by name when it decides how to keep it away from a
careless thumb. What herdr can and cannot send is in
[`middleman/README.md`](../middleman/README.md); the phone should not have to know.

## What a turn does and does not carry

A `Turn` says who produced it, what was said, and whether the screenful cut it. It carries no
timestamp for the same reason a pane does not: nothing in a screenful is dated, so every turn would
have to share the moment of the read, which says when Viu looked rather than when anything was said.

`cut` is the flag rather than herdr's `truncated`, because herdr's own flag reports something else -
its 1000-row read ceiling - and stays `false` when a pane's viewport cuts a turn in half. Marking a
turn cut is the one thing the phone must be able to trust: an agent pane keeps no scrollback, so a
turn that runs off the top of the viewport is gone, not paged away
([ADR 0005](../docs/adr/0005-a-pane-renders-as-chat.md)).

`role` has three values, not two. `agent` and `person` are the conversation. `pane` is the raw
screenful of a pane the chat grammar has no structure for, such as an ordinary shell or a **dormant
pane**, both of which are normal members of the fleet rather than failures.

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
