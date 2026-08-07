# The middleman holds no state

The middleman stores nothing: no conversation state, no accumulated transcript, no per-pane tail
loop, no database. What Viu can show is whatever herdr will hand over at the moment of asking.

## Considered Options

An earlier version of this decision was made believing an agent pane offered about 1000 rows of
history. That was wrong: agent TUIs run on the terminal's alternate screen, so an agent pane has no
scrollback at all - 40 rows, one screenful. The decision was re-confirmed against the real number.

- **A client-side accumulator** that continuously tails each pane. Rejected: measured to lose 9-19%
  of rows at a two-second poll, and history with silent holes looks complete when it is not.
- **Reading the agent's own transcript file.** Exact, but needs a per-agent adapter. Rejected for
  now, and this is the route to reach for if catching up on missed output ever turns out to be what
  the product needs. It is not the accumulator.

## Consequences

The middleman is the seam, so a store can be added behind the same interface later without changing
what the phone talks to. This is not a one-way door.
