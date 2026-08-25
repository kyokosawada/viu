# A pi pane reads by the owner's box

This is [ADR 0007](0007-the-middleman-renders-the-chat.md) applied to a second agent: the reading
happens on the machine, so a new agent means a new reader here rather than an app release.

Pi marks nothing as the start of its own turn. What it does mark is the message the machine's owner
sent, drawn inside a box with a background behind it. So the pi reader takes those boxes as the only
boundaries in the screenful - each one a **person** turn - and everything between two of them,
reasoning and tool activity and the answer itself, is one **agent** turn.

Pi paints its tool activity too, in a different colour, so paint alone would read every tool block
as the person speaking. The colour is a theme value and carries no meaning a reader can rely on, but
pi puts one thing on a tool block and never on a person's message: the call header is bold. A
painted run whose first visible run is bold is pi at work; every other painted run is the person.
`middleman/src/terminal.ts` reports that as `opensBold` beside `painted`, and
`middleman/src/chat.ts` holds the reader. The markers come from pi 0.73.1 driven through a real
conversation and read back the way herdr hands a screen over; `middleman/src/conversation.test.ts`
builds the same screens from row builders.

The chrome is the pair of full-width rules holding the input area, the two footer rows below them,
and a braille spinner row above them. All three go - unless what sits between the rules is pi asking
the owner something, which stays, inline in pi's turn.

## Considered Options

- **Tell the two painted blocks apart by their background colour.** Rejected. Pi draws the person's
  box in `userMessageBg` and its tool blocks in `toolPendingBg`, `toolSuccessBg` and `toolErrorBg`,
  which are four distinct values in both bundled themes - but they are theme variables, a custom
  theme may set them to anything, and nothing on the screen says which of the colours present is the
  person's. Reading colour would make the grammar depend on a setting the machine's owner can change.
- **Recognise pi's tool headers by their text.** Rejected. `$ `, `read`, `write`, `edit`, `grep`,
  `find` and `ls` cover the built-ins, but an extension tool's header is its own name, so the list
  can never be complete and a pi update or a new extension would silently turn tool output into the
  person speaking. Bold covers every tool without enumerating any.
- **Leave pi on the raw whole-screenful turn.** Rejected by the spec: #62 asks for a pi pane to read
  as chat, and the raw block is the honest answer only for an agent with no reader at all.

## Consequences

Once a pane's agent is pi it always reads through this reader, best-effort, even when a pi update
moves the furniture. The whole-screenful raw turn stays only for a pane whose agent has no reader at
all.

Two more limits are known and left standing, because pi as it is drawn today does not reach them and
guessing at machinery for them would be worse than saying so. A painted person box drawn hard
against a painted tool block, with no blank row between, would read as one run and so as one person
turn; every pi screen looked at has the blank row. And a row of real chat that ends a screenful and
happens to carry a context figure reads as pi's status line, which is the same exposure the Claude
reader has always had.

Bold is a heuristic and it has one known edge: an owner's message that opens with a markdown heading
or bold run reads as pi's work and joins pi's turn rather than standing as its own. That is a
graceful loss - nothing disappears - and it is the price of not depending on a theme's colours.

Pi's reasoning and tool activity read as ordinary words inside pi's turn. Giving either its own look
would take a new turn kind through the protocol and the app, which this deliberately does not do.
