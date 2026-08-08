# @viu/middleman

The service that runs on the machine and that Viu talks to. It translates between herdr and Viu and
holds no conversation state of its own - see
[ADR 0004](../docs/adr/0004-middleman-is-stateless.md).

Today it does two things: it reads the **fleet** from herdr, and it reads a **pane** as a
conversation of **turns**. Both come back in Viu's vocabulary. Sending into a pane
([#16](https://github.com/kyokosawada/viu/issues/16)) and pushing changes to the phone
([#18](https://github.com/kyokosawada/viu/issues/18)) are still to come, as is the transport the
phone connects over ([#20](https://github.com/kyokosawada/viu/issues/20)).

## Running it locally

From the repo root:

```sh
npm install
npm start
```

It prints the protocol version it was built against, then the fleet as the phone would receive it.
Pass a pane handle - `npm start -- w2:pV` - and it prints that pane's conversation instead, which is
the quickest way to see the chat grammar against a real agent.

It talks to herdr's default socket at `~/.config/herdr/herdr.sock`, and says so on stderr and exits
non-zero if it cannot. Where that socket comes from, and everything else about running for real, is
[#20](https://github.com/kyokosawada/viu/issues/20).

Node 22 or newer is required; `.nvmrc` pins the version CI uses.

## The vocabulary boundary

herdr's words stop here ([ADR 0008](../docs/adr/0008-viu-defines-its-own-vocabulary.md)). The whole
translation lives in `src/fleet.ts`, so a herdr change has one place to land.

| herdr                                            | Viu                                             |
| ------------------------------------------------ | ----------------------------------------------- |
| `pane_id`                                        | `id` - the durable handle, never `terminal_id`  |
| `agent_status: blocked`                          | `state: needs-you`                              |
| `agent_status: working`                          | `state: thinking`                               |
| `agent_status: idle` or `done`                   | `state: idle`                                   |
| `agent_status: unknown`, or a value we don't know | `state: unknown`                               |
| no `agent`, but an `agent_session` remains       | `state: dormant`                                |
| no `agent` and no `agent_session`                | `state: idle` - a pane that never held an agent |
| `foreground_cwd`, else `cwd`                     | `project` - the directory name alone            |
| `terminal_title_stripped`, else `terminal_title` | `activity` - what the agent is doing            |
| `focused`, `terminal_id`, `revision`             | dropped, and asserted absent by the tests       |
| `pane.read` of `source: visible`                 | the **screenful** - one viewport, all there is  |
| `scroll.max_offset_from_bottom` above zero       | the screenful is the tail of something longer   |

Three of those are judgement rather than transcription. `done` exists in herdr's enum and has never
been observed firing; it folds into `idle` because the agent is present and wants nothing. Dormancy
is read from `agent_session` outliving the agent herdr can see - the only durable trace herdr keeps
of a conversation that has finished, and visible on this machine's own fleet. `project` prefers
`foreground_cwd` because that is where the agent process actually is: a pane started in a checkout
but running an agent inside a worktree should be labelled by the worktree.

A pane herdr lists without a `pane_id` fails the whole read rather than quietly shortening the
fleet. herdr's schema makes that field mandatory, so its absence means something is wrong that a
short list would hide.

## Reading a pane as a conversation

The grammar runs here rather than on the phone
([ADR 0007](../docs/adr/0007-the-middleman-renders-the-chat.md)). `src/chat.ts` holds it, and it
sees only Viu's terms: which agent the pane holds, the screen, and whether herdr has more above than
the screenful shows. Everything herdr said to produce those three stays in `src/fleet.ts`.

The screen is read as `ansi` rather than `text`. herdr re-renders the grid either way and the two
forms carry identical characters - checked row by row against a live pane - but the coloured form
also carries the background Claude paints behind what a person said, which is the signal that says
who was speaking. `src/terminal.ts` flattens that back to plain rows, so nothing reaches a turn as
stray characters: colour, cursor moves, window titles, private-use icon glyphs from a shell prompt
and non-breaking spaces all come off.

What the grammar drops as chrome is the input box - the two rules with the `❯` prompt between them -
along with the status line above it and the model and mode lines below. **Unless the box is a
question waiting on you.** A picker is drawn in the same place with the same rules, and dropping it
would throw away the thing being asked, so a box carrying "enter to select" or "esc to cancel" is
kept whole. herdr's own detection manifests draw the line in the same place.

Turns then come out of what is left:

- A row opening with `●` starts an **agent** turn; indented rows continue it, tool calls and their
  output included.
- A run of rows Claude paints a background behind, blank row to blank row, is a **person** turn.
  Bounding it by blank rows is what separates what a person said from a painted diff inside tool
  output: a diff always butts against the tool's own unpainted rows, which was confirmed against a
  real pane mid-edit.
- A turn is `cut` when the screenful begins in the middle of it: agent text with no marker above it,
  or paint that reaches the top row with no blank row above it to show where it started. That is not
  an error condition; on an alternate-screen pane it is the ordinary state of the oldest thing on
  screen. Where herdr reports rows above the viewport as well, the first turn is cut on that
  authority alone - an agent pane has never been seen to report any, but a pane that does is showing
  a tail rather than a whole.

Two limits worth knowing before extending it. Only `claude` has a grammar; every other agent falls
back to the same single raw-text turn an ordinary shell gets, which is honest rather than a guess,
and adding another agent means adding its markers here. And a person's turn is only recognised while
its paint is on screen, so a short exchange fully inside one screenful reads correctly while one
that has scrolled past the top does not exist to be read at all.

## The seam

`createMiddleman` takes a `HerdrConnection` rather than opening a socket itself. `main.ts` hands it
the real one; the tests hand it `createFakeHerdr` from `src/testing/fake-herdr.ts` and drive the
middleman exactly as the phone would, asserting only on what comes back out. The suite therefore
needs no running herdr, and nothing in it reaches past that one door.

## Checks

Run from the repo root and cover this package - see [Checks](../README.md#checks).
