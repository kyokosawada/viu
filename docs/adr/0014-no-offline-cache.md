# Nothing is cached when the machine is unreachable

When Viu cannot reach the middleman it shows an explicit disconnected state. It does not show the
last screen it saw, and it keeps no local copy.

## Considered Options

- **Keep the last screen, greyed and marked stale.** Rejected. It shows output that may be minutes
  old with no way to judge how old, which is the same failure ADR 0004 rejected the accumulator for:
  content with silent holes looks complete and is not.
- **A small phone-side cache.** Rejected. That is the store this project has twice declined,
  relocated to the handset.

## Consequences

A brief tailnet blip blanks the screen, which will feel worse than it is. Accepted on the grounds
that a blank screen is honest and a stale one is not.
