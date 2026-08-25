# A pi pane reads by the owner's box

Pi marks nothing as the start of its own turn. What it does mark is the owner's message, drawn
inside a box with a background behind it. So the pi reader takes the owner's boxes as the only
boundaries in the screenful, and everything between two of them - reasoning, tool activity, the
answer itself - is one turn of pi's.

Pi paints its tool activity too, in a different colour, so paint alone would read every tool block
as the owner speaking. The colour is a theme value and carries no meaning a reader can rely on, but
pi puts one thing on a tool block and never on an owner's message: the call header is bold. A
painted run whose first visible run is bold is pi at work; every other painted run is the owner.
`middleman/src/terminal.ts` reports that as `opensBold` beside `painted`, and
`middleman/src/chat.ts` holds the reader. The markers come from pi 0.73.1 driven through a real
conversation and read back the way herdr hands a screen over; `middleman/src/conversation.test.ts`
builds the same screens from row builders.

The chrome is the pair of full-width rules holding the input area, the two footer rows below them,
and a braille spinner row above them. All three go - unless what sits between the rules is pi asking
the owner something, which stays, inline in pi's turn.

## Consequences

Once a pane's agent is pi it always reads through this reader, best-effort, even when a pi update
moves the furniture. The whole-screenful raw turn stays only for a pane whose agent has no reader at
all.

Bold is a heuristic and it has one known edge: an owner's message that opens with a markdown heading
or bold run reads as pi's work and joins pi's turn rather than standing as its own. That is a
graceful loss - nothing disappears - and it is the price of not depending on a theme's colours.

Pi's reasoning and tool activity read as ordinary words inside pi's turn. Giving either its own look
would take a new turn kind through the protocol and the app, which this deliberately does not do.
