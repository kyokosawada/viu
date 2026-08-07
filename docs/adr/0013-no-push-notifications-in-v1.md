# No push notifications in the first version

Viu tells you what is happening when you open it. It does not notify you while it is closed.

This is a deferral, not a judgement that the feature is unwanted. Being told an agent needs you while
the phone is in your pocket is plausibly the thing that makes Viu worth having. It is deferred
because it is a materially different product: the middleman would have to watch every pane
continuously rather than only the one on screen, and reaching a closed app needs a route that is not
the tailnet - a third-party push service, an account, and a dependency outside the owner's machines.

## Consequences

The streaming connection in ADR 0010 only works while the app is open, which is the whole limitation
here. Revisit once the open-app version exists and can be judged in the hand; do not treat its
absence as an oversight to be quietly fixed.
