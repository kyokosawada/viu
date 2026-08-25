# The middleman renders the chat, not the phone

Turning a screenful of terminal output into conversation turns happens on the machine, and the phone
receives structured turns rather than raw text.

The grammar needs more than the characters on screen - it needs herdr's agent status, terminal
title, and detection signals, all of which live on the machine. Doing the work on the phone would
mean shipping raw terminal output over the wire and rebuilding that knowledge in JavaScript.

## Consequences

The middleman is not a dumb pipe. It holds no state, but it does hold product logic, and changing
how a conversation reads is a deploy on the machine rather than an over-the-air app update. Given
that app updates are the cheap side and machine deploys the expensive one, this is the deliberate
worse-ergonomics choice, taken because the knowledge belongs where the data is.

Each agent Viu can read gets its own reader on this side.
[ADR 0025](0025-a-pi-pane-reads-by-the-owners-box.md) is the second one, and records what changes
when an agent marks its turns differently from Claude.
