# @viu/middleman

The service that runs on the machine and that Viu talks to. It translates between herdr and Viu and
holds no conversation state of its own - see
[ADR 0004](../docs/adr/0004-middleman-is-stateless.md).

Today it does five things: it reads the **fleet** from herdr, it reads a **pane** as a conversation
of **turns**, it sends text into a pane, it presses named keys into one, and it holds a connection
open and pushes changes down it. All five speak Viu's vocabulary, and all five are reachable over
HTTP on the tailnet. When any of them fails it says which failure it was, in that same vocabulary -
see [When it breaks](#when-it-breaks).

## Running it locally

From the repo root:

```sh
npm install
npm start
```

It prints the protocol version it was built against, then the fleet as the phone would receive it,
and exits. Pass a pane handle - `npm start -- w2:pV` - and it prints that pane's conversation
instead, which is the quickest way to see the chat grammar against a real agent. Name keys after the
handle - `npm start -- w2:pV down enter` - and it presses them into that pane instead of reading it.

Add `--watch` - `npm start -- w2:pV --watch` - and it holds a connection open instead of exiting,
printing each update as it arrives, which is the quickest way to see the stream against an agent
that is actually working. With `--watch` and no pane handle it receives fleet updates alone, which
is what the phone does while the user is on the list. It asks herdr for the fleet once before
connecting, so an unreachable herdr fails the same way it does without `--watch` rather than sitting
silently. Ctrl-C closes the connection.

`npm run serve` is the other half: the same middleman, left running and listening. It talks to
herdr's default socket at `~/.config/herdr/herdr.sock`, and says so on stderr and exits non-zero if
it cannot.

Node 22 or newer is required; `.nvmrc` pins the version CI uses.

## What it serves

| Call                              | Answers                                                    |
| --------------------------------- | ---------------------------------------------------------- |
| `GET /`                           | who this is, and the herdr it greeted - the reachability check |
| `GET /fleet`                      | the whole fleet, needs-you first                            |
| `GET /panes/<pane>/conversation`  | that pane's screenful as turns                              |
| `POST /panes/<pane>/send`         | `{"text": "..."}` in, the guarantee it got back             |
| `POST /panes/<pane>/keys`         | `{"keys": ["down", "enter"]}` in, 204 out                    |

A pane handle carries a colon, so it is percent-encoded in a path: `w2:p6J` is `w2%3Ap6J`. A key
Viu has no name for is turned down as `unsupported-key` rather than passed through, which is the
same refusal `press` makes.

A failure is answered as a **trouble** - see [When it breaks](#when-it-breaks) - carrying its own
name and its own status, so no two of them arrive as the same screen.

## Running it for real

The middleman is meant to be simply there: running whenever the machine is on, restarting itself if
it falls over, and reachable from the phone without anything being planned in advance. On Linux -
including WSL with systemd - that is a systemd **user** service
([ADR 0012](../docs/adr/0012-the-middleman-is-typescript.md)).

### What has to be true first

- **Tailscale is up on this machine and the phone is on the same tailnet.** This is the whole of the
  access control ([ADR 0003](../docs/adr/0003-tailscale-is-the-access-control.md)). There is no
  password, and the service refuses to start rather than bind anywhere else.
- **herdr is running**, with its socket at `~/.config/herdr/herdr.sock`.
- **systemd is running as your user**: `systemctl --user is-system-running` answers. Under WSL that
  needs `systemd=true` under `[boot]` in `/etc/wsl.conf` and a `wsl --shutdown` after adding it.
- **Node 22 or newer**, and the repo built: `npm install && npm run build`.

### Installing it

From the repo root, with `$PWD` being the checkout:

```sh
install -Dm644 middleman/deploy/viu-middleman.service ~/.config/systemd/user/viu-middleman.service
sed -i "s|/REPLACE/WITH/PATH/TO/node|$(command -v node)|; \
        s|/REPLACE/WITH/PATH/TO/viu|$PWD|" ~/.config/systemd/user/viu-middleman.service
loginctl enable-linger "$USER"
systemctl --user daemon-reload
systemctl --user enable --now viu-middleman
```

The unit ships with both paths unset on purpose, so an unedited copy fails loudly rather than
quietly running the wrong Node. Use the **absolute** path to the Node you built with: a service gets
a minimal `PATH`, and on a machine using nvm `/usr/bin/node` is usually an older Node than the one
`npm run build` used. Re-run the `sed` line after an nvm upgrade moves that path.

`enable-linger` is what makes "starts at boot" true rather than "starts when you open a terminal".
Without it the user manager only exists while you are logged in, which is exactly the case Viu is
for - the machine is on and nobody is at it.

### Checking it

```sh
systemctl --user status viu-middleman
journalctl --user -u viu-middleman -n 20
ss -ltn | grep 8787
```

The log says which herdr it greeted and where it is serving. `ss` should show the tailnet addresses
and nothing else - no `0.0.0.0`, no `127.0.0.1`, no LAN address. From the phone, on the tailnet,
`http://<machine>.<tailnet>.ts.net:8787/` answers with who it is.

`VIU_PORT` in the unit sets the port; 8787 is the default.

### When it will not start

It refuses rather than starting half-working, and says which of these it is:

| It says                                | What to do                                                      |
| -------------------------------------- | ---------------------------------------------------------------- |
| `no tailnet address to bind to`        | bring Tailscale up - `tailscale status`. It retries every 5s.    |
| `herdr does not appear to be running`  | start herdr. It retries every 5s.                                |
| `this middleman understands herdr protocol N` | herdr's protocol moved. Viu needs updating, not restarting. |

The last one exits 78 and the unit does not restart it (`RestartPreventExitStatus=78`), because a
refusal is a decision rather than a fault and a restart loop would bury the reason. Everything else
exits 1 and comes back in five seconds, which is what makes a crash at two in the afternoon not a
dead app at six.

### Under WSL specifically

WSL's default `nat` networking gives the Linux side its own address space, and Tailscale runs
inside it, so `tailscale0` and its address live in WSL and the middleman binds there. The middleman
binds neither loopback nor every interface, which is what the Windows-side localhost relay would
need in order to republish the port to the Windows host and the network it is on. What is actually
listening is worth confirming rather than reasoning about: `ss -ltn` on the Linux side, and
`netstat -an | findstr 8787` on the Windows side, should agree that only the tailnet addresses
answer.

## The vocabulary boundary

herdr's words stop here ([ADR 0008](../docs/adr/0008-viu-defines-its-own-vocabulary.md)). Three
files hold them and no others do: `src/fleet.ts` for the fleet, every pane state and the screenful,
`src/send.ts` for sending, and `src/startup.ts` for the handshake that greets herdr and reads the
protocol version it speaks. A herdr method name, field name or error code may appear in those three
and nowhere else - never in `@viu/protocol`, and never in anything the phone receives. A herdr
change therefore has a small, named set of places to land rather than a search.

The third was added rather than folded in, which is the thing to argue with first if a fourth is
ever proposed. The handshake is about the herdr server itself rather than about panes or sending,
and putting `ping` inside the fleet reader would have made "read the fleet" mean two things.

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
| `agent.prompt` accepted                          | `confidence: confirmed`                         |
| `pane.send_input` acknowledged                   | `confidence: queued`                            |
| `pane_not_found`                                 | `PaneGone`                                      |
| `pane_send_failed`, `agent_prompt_stalled`       | `PaneNotAcceptingInput` - the pane is there and the write did not land |
| `agent_not_running`                              | no agent to prompt - falls back to the pane, as `agent_not_found` does |
| `pane.send_keys` with herdr's key names          | `press` with Viu's key names                    |
| `invalid_key`                                    | never seen - `UnsupportedKey` is raised first   |
| `ping` answering `protocol: 17`                  | the one protocol Viu will start against         |
| `events.subscribe` on `pane.created`, `pane.closed`, `pane.updated` | one signal: something about the fleet moved |

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

## Pushing changes to the phone

`connect(receive)` hands back a connection the client holds open and never polls
([ADR 0010](../docs/adr/0010-the-middleman-streams-to-the-phone.md)). Two things arrive on it: the
**fleet**, and the conversation of the one pane the client is watching. `watch(paneId)`,
`stopWatching()` and `close()` are the whole of what a client says back, and they mirror what a
person does - open a pane, go back to the list, put the phone away.

The two signals reach the phone by different routes, because herdr only offers one of them.

| Signal                            | How it is noticed                                              |
| --------------------------------- | -------------------------------------------------------------- |
| a pane's state, project, activity, or membership of the fleet | herdr's own pane events, subscribed once |
| a watched pane's output           | polled from herdr, once a second, for that pane only            |

There is no output event to subscribe to. herdr's subscription vocabulary has nothing for "this
pane printed something", and the `revision` counter that sounds like it tracks output does not.
Polling is the only way, so it is kept as small as it can be: one pane, and only while someone is
looking at it.

**A fleet change is pushed to every connected client, including one that is deep inside a different
pane.** That is the point of it - a pane starting to **need you** is the reason to switch, so it has
to arrive wherever the user is. It arrives on the connection the client already holds and nowhere
else; there are no push notifications and no way to reach a closed app
([ADR 0013](../docs/adr/0013-no-push-notifications-in-v1.md)).

**Content polling belongs to the pane, not to the client.** It starts when the first client opens
that pane, serves everyone watching it from a single read, and is cleared when the last one leaves -
by opening another pane, by stopping watching, or by dropping the connection. Nothing watched means
nothing polled, which is the whole of the battery argument: a phone in a pocket costs herdr no
traffic beyond the events it was already going to send. The subscription itself is dropped when the
last client disconnects.

**Nothing is pushed that the phone has already been told.** herdr's pane events fire on things the
phone never sees - a revision bump, a change of focus - so every event re-reads the fleet and the
result is compared with the last one sent. A screenful that has not changed is read and dropped the
same way. The comparison, rather than the event, is what stops a busy machine waking a screen in a
pocket.

An event is a prompt to look, not the thing looked at: the fleet is re-read and pushed, rather than
reconstructed from what the event said. So what the phone receives is always what herdr says now,
and a state that flickers away faster than the read can be sent is not sent at all. That is the
right way round for the state this exists to surface - **needs you** lasts until a person answers -
and it is why a machine flipping between **thinking** and idle several times a second does not
become several updates a second.

The only thing kept between reads is the last update each client was told, so a read that says
nothing new can be recognised. It is held per client rather than shared, because a client connecting
must be told the fleet whether or not it moved, and a shared marker would let that private answer
stand in for one the others were owed. It is not the accumulator
[ADR 0004](../docs/adr/0004-middleman-is-stateless.md) rules out: nothing is appended, each read
replaces the last, and it is forgotten when the pane stops being watched or the client goes away.

A read that fails says which failure it was, on the same connection, and is covered by
[When it breaks](#when-it-breaks) below.

## When it breaks

Every failure the phone can be told about is a **trouble**, and the vocabulary is one list in
`@viu/protocol` rather than one per surface: the same `kind` reaches the phone whether it asked over
HTTP or was told on the connection it holds open. "The pane you were reading is gone" and "your
machine is unreachable" want completely different screens, so nothing collapses them into one
generic failure ([#19](https://github.com/kyokosawada/viu/issues/19)).

| Trouble                    | What happened                                                     | HTTP |
| -------------------------- | ----------------------------------------------------------------- | ---- |
| `pane-gone`                | herdr no longer has that pane, and names which one                 | 404  |
| `pane-not-accepting-input` | the pane is still there and the write into it did not land         | 409  |
| `herdr-unreachable`        | the machine is not answering - nothing can be read from it at all  | 503  |
| `protocol-mismatch`        | herdr speaks a protocol Viu has not been read against              | 502  |
| `herdr-refused`            | herdr answered, and refused, for a reason Viu has no word for      | 502  |
| `unsupported-key`          | a key Viu has no name for, refused before anything is sent         | 400  |
| `malformed-request`        | the body could not be read as the thing it claims to be            | 400  |
| `too-much`                 | a body far larger than anything a person dictates                  | 413  |
| `no-such-endpoint`         | nothing is served there                                            | 404  |
| `middleman-failed`         | a fault of the middleman's own, blamed on nobody else              | 500  |

`src/trouble.ts` is the only place an error of the middleman's becomes one of these, and the only
place a status is chosen, so the two surfaces cannot drift apart.

**A pane that goes while you are reading it says so specifically**, to the clients watching that
pane and to nobody else, and its polling stops - there is nothing left to read. A pane herdr
answers about and refuses is the same shape of trouble: `herdr-refused` to the clients on that pane,
the polling stopped, and the fleet and everybody else untouched, because a machine that is answering
has not gone anywhere. A machine that goes
away says `herdr-unreachable` to everyone, including a client sitting on the fleet with no pane
open: that client has no read of its own to discover it with, so the dropped subscription is what
tells it. Either way it is said once, not once a second for as long as it lasts.

**The connection recovers by itself.** A lift, a tunnel or a laptop lid drops the subscription; the
middleman greets herdr again every second until herdr answers, then subscribes again and re-reads.
**A dropped connection is a question, not an answer**: a subscription dying says nothing about
whether the machine is there, so herdr is greeted before anyone is told it is gone, and a
subscription that dies under a herdr that is fine is simply taken out again in silence.
Until that greeting succeeds it reads nothing at all, which is what makes a herdr that comes back
speaking a different protocol refused mid-session exactly as it is refused at startup, rather than
quietly trusted by the next content poll.

**Nothing read before the outage survives it.** A read already in flight when the machine went is
dropped when it lands rather than pushed on top of the trouble. The last fleet each client was told
and the last conversation each watched pane pushed are both dropped the moment the machine is
unreachable, so a
client opening that pane during the outage is told the machine is unreachable and shown nothing at
all, and everything is sent again on recovery even where it has not changed. With nothing stored
([ADR 0014](../docs/adr/0014-no-offline-cache.md)) an unreachable machine genuinely has nothing to
show, and a blank screen is the honest answer where output from four minutes ago dressed as current
is not.

### Where these facts come from

The drop and the recovery were run against the herdr on this machine, not only against the fake: the
middleman watched a live pane through a relay onto herdr's socket, the relay was killed, and the
trouble arrived within a tenth of a second of the connection dying, saying there was no socket
there - the answer to the greeting rather than a guess from the dead subscription. Restoring the
relay brought the fleet back within two seconds and re-pushed the pane's conversation although its
screen had not changed, which is the forgetting above being visible from outside. Watching a pane handle herdr does not have
answers `pane-gone` against the real server too, which is where `pane_not_found` is confirmed rather
than assumed.

The two refusals that become `pane-not-accepting-input`, and `agent_not_running` falling back to the
pane, are read from herdr 0.7.5's own error vocabulary rather than measured against a live refusal -
unlike the tables in
[#16](https://github.com/kyokosawada/viu/issues/16) and
[#17](https://github.com/kyokosawada/viu/issues/17), which were. The first two are grouped because
each one means herdr has the pane and the write did not land; a third code meaning the same thing
belongs in the same group. Only codes the middleman's own calls can produce are listed - herdr has
others for `agent.send_keys`, which the middleman never calls.

## Sending into a pane

`send(paneId, text)` answers with the guarantee it actually got, because herdr offers two and they
are not interchangeable ([ADR 0006](../docs/adr/0006-panes-are-the-addressing-model.md)).

| Outcome                          | What it means                                                           |
| -------------------------------- | ----------------------------------------------------------------------- |
| `{ confidence: 'confirmed', state }` | a recognised agent was **seen to pick the text up**, and `state` is what it is doing now |
| `{ confidence: 'queued', mayBeCut }` | bytes were queued, and nothing beyond that was observed                 |

The agent path is tried first. herdr answers `agent_not_found` both for a pane holding no recognised
agent _and_ for a pane that does not exist, so it cannot tell those apart - the fall back to
`pane.send_input` is what settles which it was, and that is where a gone pane surfaces as `PaneGone`.

**herdr accepting the call does not earn `confirmed`, and this is the part that is easy to get
wrong.** `agent.prompt` answers `agent_prompted` for any recognised live agent, and on its own
returns the state that agent was in _before_ the prompt. A Claude still on its welcome screen was
seen to take an accepted `agent.prompt`, put the words in its input box, and never submit them -
herdr said yes, the agent had the text, and nothing had landed. So the call asks herdr to wait until
the agent starts working, and only that observation earns `confirmed`.

When the wait expires herdr answers `timeout`, and that covers two cases it cannot tell apart: the
agent took the text and finished faster than the wait could see it, or it never took the text at
all. Neither a failure nor a confirmation is honest, so a timeout drops to `queued` - herdr has the
text, and nothing beyond that was observed. That is the weaker of the two answers and it is the
right one, because a send still sitting unsubmitted in an input box reported as confirmed produces
exactly the confidence this ticket exists to prevent.

`mayBeCut` says the text has a line at or over 4096 bytes. A shell reading in canonical mode drops
everything past that on one line while herdr still answers `ok`. Agent TUIs read in raw mode and are
unaffected, which is why the flag only appears on the queued outcome. A long dictated paragraph is
exactly the shape that hits it.

### Where these facts come from

Not from the herdr investigation the rest of this repo rests on - none of them are in it. They were
measured for [#16](https://github.com/kyokosawada/viu/issues/16) against herdr 0.7.5, in a scratch
workspace, and they are the reason the code is shaped the way it is. Re-measure before trusting them
against a later herdr.

| Measured                                                    | What it showed                                                        |
| ----------------------------------------------------------- | --------------------------------------------------------------------- |
| `agent.prompt` with no `wait`, against a live Claude agent   | answered in 104 ms still reporting `blocked` - the state _before_ the prompt |
| `agent.prompt` with `wait`, once the wait expired            | `{"code":"timeout","message":"timed out waiting for agent status"}`   |
| the same `timeout`, against an agent that had answered       | the prompt had landed and been answered anyway                        |
| the same `timeout`, against a Claude still on its welcome screen | the words sat unsubmitted in the input box - herdr had said yes and nothing had landed |
| `agent.prompt` with `wait` against a pane with no agent, and against a pane that does not exist | `agent_not_found` for both - it cannot tell them apart |
| 5000 bytes on one line into a canonical-mode reader          | 4096 arrived, and herdr answered `ok`                                 |

The last one restates a limit the investigation already found; the rest are new. The two `timeout`
rows are the same herdr answer covering opposite outcomes, which is why it cannot be read as either
success or failure.

Text and the keypress that submits it always travel in one operation - `pane.send_input` carries both,
and `agent.prompt` submits by definition - so nothing can interleave between the words and the send.

## Pressing keys into a pane

A picker is not answered by text, so `press(paneId, keys)` sends named keys - several in one call,
in the order given, as one operation. It answers nothing: herdr acknowledges that the keys were
written into the pane and observes nothing beyond that, and inventing a confidence from an
acknowledgement is the mistake `send` exists to avoid.

Viu names ten keys and herdr's names for them stay in `src/send.ts`:

| Viu         | herdr       | what the pane receives |
| ----------- | ----------- | ---------------------- |
| `escape`    | `esc`       | `ESC` (0x1b)           |
| `enter`     | `enter`     | `CR` (0x0d)            |
| `tab`       | `tab`       | `HT` (0x09)            |
| `up`        | `up`        | `ESC [ A`              |
| `down`      | `down`      | `ESC [ B`              |
| `left`      | `left`      | `ESC [ D`              |
| `right`     | `right`     | `ESC [ C`              |
| `backspace` | `backspace` | `DEL` (0x7f)           |
| `space`     | `space`     | `SP` (0x20)            |
| `ctrl-c`    | `c-c`       | `ETX` (0x03)           |

That right-hand column is measured, not assumed: each key was pressed through the whole middleman
into a scratch pane reading in raw mode, and the bytes above are what arrived. `KEY_SEQUENCES` in
`src/testing/fake-herdr.ts` holds the same table, which is what lets a test assert the sequence a
pane receives rather than the name Viu asked for.

`ctrl-c` is one named key rather than a modifier grammar over every letter. There is no `ctrl-d`,
no `ctrl-z` and no way to spell one, so the phone's quick-key row cannot put a second control key
one thumb away by accident - and it can still recognise the one that exists by name and treat it
differently. herdr would accept `c-d` and the rest; Viu not offering them is a judgement about what
belongs on a phone, and the reason to revisit it is a pane that needs one, not a gap in herdr.

### What herdr will not do, and the trap in asking

herdr has no home, end, page up, page down or delete. It refuses all five with `invalid_key`, so a
name Viu cannot send is refused here instead - `UnsupportedKey`, naming the key that was refused and
the keys there are. A run of keys containing one bad name sends none of them, so a press never
half-lands. A phone that has to discover the vocabulary from a failure is a phone that discovers it
mid-picker.

The trap is that herdr accepting a name is not proof the key arrives. `shift+tab` is accepted and
sends a plain tab; `ctrl+c` and `c-c` both arrive as `ETX`, while `ctrl-c` is refused. Only names
whose bytes were read back off a terminal are in the table above.

### Where these facts come from

Measured against herdr 0.7.5 for [#17](https://github.com/kyokosawada/viu/issues/17), in a scratch
workspace, the same way [#16](https://github.com/kyokosawada/viu/issues/16)'s were. Re-measure
before trusting them against a later herdr.

| Measured                                                        | What it showed                                              |
| --------------------------------------------------------------- | ----------------------------------------------------------- |
| every key in the table, into a pane running `stty raw`           | the bytes in the third column, in the order pressed          |
| `home`, `end`, `pageup`, `pagedown`, `delete`                    | `invalid_key` for all five, before anything reached the pane |
| `shift+tab`                                                      | accepted, and a plain `HT` arrived                           |
| `ctrl-c`, then `ctrl+c` and `c-c`                                | refused, then both accepted and both arrived as `ETX`        |
| `pane.send_keys` with no keys at all                             | `ok`, and nothing arrived                                    |
| `pane.send_keys` at a pane that does not exist                   | `pane_not_found`, checked before any key name is             |
| `up up enter` into a live `fzf`, through the middleman           | the third item was selected                                  |
| `ctrl-c` into a running `sleep`, through the middleman           | the command stopped and the prompt came back                 |

## The seam

`createMiddleman` takes a `HerdrConnection` rather than opening a socket itself. `main.ts` hands it
the real one; the tests hand it `createFakeHerdr` from `src/testing/fake-herdr.ts` and drive the
middleman exactly as the phone would, asserting only on what comes back out. The suite therefore
needs no running herdr, and nothing in it reaches past that one door.

`serveMiddleman` takes the same connection, plus the addresses to bind and the port, so the service
tests stand a real listener up on a loopback address over a fake herdr and ask it what the phone
would ask. The bind address is an argument rather than something the service reads for itself, which
is what lets a test prove the property ADR 0003 rests on without a tailnet: the service comes up on
`127.0.0.2` and the same port on `127.0.0.1` refuses. Bind the wildcard and that test fails.

Being an argument, it could be handed the wrong thing, so `serveMiddleman` refuses `0.0.0.0`, `::`
and the empty address outright. `tailnet.ts` will never produce one; the refusal is there because
this is the one argument in the codebase whose careless value is a security hole rather than a bug.

One test does not use that door. herdr being absent is not something a fake herdr can express - the
fake is, by construction, answering - so `src/herdr/socket.test.ts` greets a real socket client
pointed at a path where no herdr is, and at one where a dead socket file is. It asserts the sentence
that reaches the journal and nothing about how the client is built.

The fake carries herdr's asymmetry rather than hiding it. `showPanes` stands for "herdr now sees
this" and fires the events herdr fires for it - created, closed, and updated for each pane that
really changed - so a test says what happened on the machine instead of naming an event.
`showScreen` fires nothing, because herdr has no output event to fire, and that silence is the fact
the streaming code is shaped around. `reads()` records which panes were asked for, because "polling
covers only the watched pane, and stops" is only observable through this door.

The fake answers `pane.send_text` even though nothing calls it, and that is deliberate rather than
left over. It records what reached each pane, and the atomicity test asserts that one operation
carried both the text and its submission. A fake that only answered the calls the code happens to
make would pass that test by being unable to express the alternative, which is the weaker thing to
prove.

For the same reason the fake refuses a key name it has no sequence for, exactly as herdr does. A
lenient fake would let a middleman that forwarded every name straight through pass the test that
exists to prove it does not.

## Checks

Run from the repo root and cover this package - see [Checks](../README.md#checks).
