# Viu defines its own vocabulary and translates at the middleman

Viu does not hand herdr's field names straight to the phone. The middleman translates into the
terms in `CONTEXT.md`.

Some of herdr's words are right and are kept - pane, agent, and the durable pane handle. Several
would actively mislead on a phone:

- `focused` means focused on the machine, not on the phone. Two different ideas wearing one word.
- `terminal_id` looks like a pane's identity and is not; it changes on every restart.
- `revision` does not track output, despite the name.
- `blocked` is herdr's word for "it is your turn", and reads like an error.

herdr itself ships a label table mapping `blocked` to "needs you" and `working` to "thinking", which
is herdr acknowledging that its internal names are not user-facing names.

## Consequences

A mapping to maintain, which will look like pointless indirection on day one. In exchange, a herdr
protocol change is a fix on the machine rather than an app update on a phone - which matters because
the phone is the awkward side to update.
