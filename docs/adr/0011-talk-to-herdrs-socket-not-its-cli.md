# Talk to herdr's unix socket, not its CLI

The middleman speaks herdr's socket protocol directly and never shells out to the `herdr` command.

The CLI cannot subscribe to events at all - there is no such command - so the single most valuable
thing herdr offers is unreachable from it. The socket is also several times cheaper per call than a
process spawn, returns richer data than several CLI subcommands print, and carries an in-band
protocol version so a middleman can refuse to start against a server it does not understand rather
than failing mysteriously.

## Consequences

The middleman is coupled to a versioned protocol that has already broken sixteen times by its own
numbering. That break is detectable rather than silent, and ADR 0008's translation layer keeps it
from reaching the phone.

The CLI remains the right tool for herdr's own lifecycle - starting, stopping, installing
integrations - none of which the middleman does.
