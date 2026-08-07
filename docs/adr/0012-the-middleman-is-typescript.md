# The middleman is written in TypeScript

TypeScript on Node, so the protocol between the middleman and the app can be one set of type
definitions both sides compile against. On a two-sided protocol that removes an entire class of
drift, and it keeps Viu to one language.

Go was the serious alternative and is genuinely better at the part this choice is weakest on: a
single static binary is easier to start with the machine and keep running than a Node process. If
that turns out to be the painful half, this is worth reopening.

The middleman is started by a systemd user service at login, restarting on failure. herdr's plugin
system might be a better home for it, but nobody has looked at that surface, so it is a spike rather
than a decision.
