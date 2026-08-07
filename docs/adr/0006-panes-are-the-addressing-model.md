# Panes are the addressing model, agent powers are layered on

Viu addresses panes, and uses herdr's richer agent operations when the pane happens to hold a
recognised agent.

herdr offers two families and they are not equivalent. The agent family gives named addressing, a
real submitted-ran-came-back round trip, and the agent's own conversation identity, but refuses
anything that is not a live recognised agent. The pane family works on everything including plain
shells, but every send is fire and forget - the acknowledgement means only that bytes were queued.

## Considered Options

- **Agents only.** Rejected: shell panes are part of the fleet a person sees.
- **Panes only.** Rejected: it throws away confirmed delivery, which is the one thing that answers
  "did my dictated message actually land" when sending from a phone over a tailnet.

## Consequences

Two code paths, and a capability the phone must handle as present-or-absent. What the phone reports
about a send therefore differs by pane: an agent can be shown as sent, thinking, then answered,
while a shell can only ever be shown as sent. That difference must be visible in the interface
rather than looking like a bug.
