# The Slab is always available, and says only what it knows

The Slab is present on every pane, whatever state that pane is in, and it describes what actually
happened to what was sent rather than implying more.

On a dormant pane or a plain shell there is no agent to acknowledge anything. herdr confirms the
write and observes nothing after it, exactly as ADR 0006 describes, so the Slab says the keys were
sent and stops there. This is what makes a plain terminal answerable from the phone at all.

When an agent is mid-turn, the input is accepted and shown as queued rather than delivered, so a
person can answer a question they can already see coming without waiting for the agent to stop.

## Considered Options

- **Hide or disable the Slab where delivery cannot be confirmed.** Rejected. That is every plain
  shell, and a shell you cannot type into is not part of the fleet in any useful sense.
- **Stay silent about the confirmation gap.** Rejected. A send shown the same way on a shell as on
  a live agent claims a round trip that never happened, and the person finds out only when nothing
  comes back.
- **Block input until the agent is idle.** Rejected. It throws away the pre-answer, which is often
  the whole reason the phone is out.
- **Send mid-turn silently, as though delivered.** Rejected for the same reason as the gap above:
  queued and delivered are different facts and the interface should not blur them.

## Consequences

The Slab has more than one way to report a send, and which one applies is a property of the pane
rather than of the input. Any new pane state has to answer what the Slab says on it before it is
finished.
