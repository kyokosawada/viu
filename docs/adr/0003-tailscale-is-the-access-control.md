# Tailscale is the entire access control

The middleman binds to the tailnet interface only and has no password, no token, and no login.
Anyone on the tailnet may read any pane and type into any pane. Being on the tailnet is the
authorisation.

This is deliberate rather than unfinished. The tailnet is a small set of the owner's own devices,
the middleman is unreachable from anywhere else, and a second credential on top would protect
against nothing the tailnet does not already exclude while adding a login to every use.

## Consequences

The security boundary is entirely Tailscale's. If the middleman is ever bound to another interface,
or the tailnet is ever shared with a device the owner does not control, this decision is void and
authentication becomes mandatory rather than optional.
