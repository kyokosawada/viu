# @viu/middleman

The service that runs on the machine and that Viu talks to. It translates between herdr and Viu and
holds no conversation state of its own - see
[ADR 0004](../docs/adr/0004-middleman-is-stateless.md).

Today it does one thing: it reads the **fleet** from herdr and hands it back in Viu's vocabulary.
Reading a pane as **turns** ([#15](https://github.com/kyokosawada/viu/issues/15)), sending into a
pane ([#16](https://github.com/kyokosawada/viu/issues/16)) and pushing changes to the phone
([#18](https://github.com/kyokosawada/viu/issues/18)) are still to come, as is the transport the
phone connects over ([#20](https://github.com/kyokosawada/viu/issues/20)).

## Running it locally

From the repo root:

```sh
npm install
npm start
```

It prints the protocol version it was built against, then the fleet as the phone would receive it.
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

Three of those are judgement rather than transcription. `done` exists in herdr's enum and has never
been observed firing; it folds into `idle` because the agent is present and wants nothing. Dormancy
is read from `agent_session` outliving the agent herdr can see - the only durable trace herdr keeps
of a conversation that has finished, and visible on this machine's own fleet. `project` prefers
`foreground_cwd` because that is where the agent process actually is: a pane started in a checkout
but running an agent inside a worktree should be labelled by the worktree.

A pane herdr lists without a `pane_id` fails the whole read rather than quietly shortening the
fleet. herdr's schema makes that field mandatory, so its absence means something is wrong that a
short list would hide.

## The seam

`createMiddleman` takes a `HerdrConnection` rather than opening a socket itself. `main.ts` hands it
the real one; the tests hand it `createFakeHerdr` from `src/testing/fake-herdr.ts` and drive the
middleman exactly as the phone would, asserting only on what comes back out. The suite therefore
needs no running herdr, and nothing in it reaches past that one door.

## Checks

Run from the repo root and cover this package - see [Checks](../README.md#checks).
