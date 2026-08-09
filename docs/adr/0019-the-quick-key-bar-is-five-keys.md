# The quick-key bar is five keys, and ctrl-c is one of them

The quick-key bar, revealed by the same tap that opens the keyboard, holds exactly five keys: up,
down, enter, escape, and ctrl-c.

These are not shortcuts for keys the person already has. A phone keyboard has no escape, no ctrl,
and no arrows, so the bar is the only way to send them at all. Up, down and enter answer a picker,
escape dismisses one, and ctrl-c stops a runaway command. Everything else a terminal wants is typed
text, and the keyboard is one tap away.

ctrl-c is a distinct button, styled apart from the others and placed away from escape, and it fires
on a single tap with no confirmation.

## Considered Options

- **Add tab, or a wider set.** Rejected. Tab and its neighbours are keyboard territory. Every key on
  the bar is screen taken from 80-column output, which is the scarce thing on a phone.
- **Fewer than five.** Rejected. Drop any one of them and a routine moment - answering a picker,
  backing out, stopping a runaway - becomes impossible rather than inconvenient.
- **ctrl-c as an ordinary button among the others.** Rejected. It sits next to escape and means
  something far less recoverable, so it must not look like its neighbour.
- **A confirm gesture on ctrl-c - long-press, or a second tap.** Rejected. The moment a person
  reaches for ctrl-c is a command running away from them, which is the worst possible moment to add
  friction. A mis-tap costs one turn, not the work. Distinct styling and distance do the same job
  without taxing the real use.

## Consequences

Adding a sixth key is a fresh decision, and the argument has to be that the phone cannot otherwise
send it - not that it would be convenient.
