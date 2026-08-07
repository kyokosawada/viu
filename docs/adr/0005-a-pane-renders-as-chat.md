# A pane renders as chat, never as a terminal mirror

A pane is presented as a conversation of turns. There is no character-grid mirror of the terminal
and no toggle to reach one.

The alternative offered was a hybrid: chat by default with a faithful mirror available. It was
declined on the grounds that a phone is not the place to reproduce a desktop screen one-to-one.

## Consequences

A pane holding an ordinary shell has no structure for the chat grammar to work with, so it collapses
to a plain raw-text card that uses a fraction of the screen. That cost was known and accepted; the
cheaper remedy, if it ever matters, is widening the raw-text card rather than reintroducing the
mirror. Reintroducing the mirror needs a fresh decision.

The chat must stay honest about the screenful ceiling rather than presenting a cut-off block as
though it were whole.
