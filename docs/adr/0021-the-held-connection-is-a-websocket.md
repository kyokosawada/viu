# The held connection is a WebSocket at GET /updates

The connection ADR 0010 calls for reaches the phone as a WebSocket, upgraded from `GET /updates` on
the same listener the rest of the HTTP surface is served on, and therefore on the same tailnet-only
binding (ADR 0003). `Update`s go down it as JSON; `Watching` - watch this pane, or stop - goes up
it.

## Considered Options

- **Server-sent events, with the watched pane in the query string.** Rejected. SSE carries nothing
  upwards, so changing pane means closing the stream and opening another. The fleet subscription
  dies with it every time a pane is opened, which is the one thing the connection exists to keep.
- **Server-sent events, with a second endpoint to say what to watch.** Rejected. It buys a
  one-directional transport at the cost of a connection identifier the middleman has to hold and a
  second route that only makes sense alongside the first. Two channels to keep in step is worse
  than one that already goes both ways.
- **Long polling.** Rejected outright by ADR 0010.

## Consequences

A dependency on `ws`, the middleman's first, in a package that had none. Accepted: Node has no
WebSocket server of its own, hand-rolling the framing is a worse use of the same trust, and `ws`
itself has no dependencies.

`watch` and `stopWatching` map onto the connection `createMiddleman` already hands out, so nothing
about the streaming model changes to be served - `middleman/src/updates.ts` is a translation and
holds no state of its own.

A phone that loses radio sends no close, so the middleman pings and drops a socket that stops
answering; without that the pane it was watching would be read from herdr once a second for as
long as the operating system kept the socket open.
