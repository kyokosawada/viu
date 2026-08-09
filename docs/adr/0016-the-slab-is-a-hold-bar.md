# The Slab is a hold bar, and everything else is one tap away

The Slab is a full-width bar at the bottom of a pane. Holding it captures speech; releasing ends the
capture and sends nothing. The dictated words appear as editable text with Send and a discard beside
each other, and nothing dims or covers the transcript above while the Slab is in use.

Speaking costs zero taps because it is the thing Viu exists for - the owner is away from the desk and
answering the agent that needs them. One tap opens the phone keyboard and the quick-key bar together:
hold to talk, tap to reach anything else.

## Considered Options

- **A permanently visible key row.** Rejected. It makes a rare path free by permanently taxing the
  common one, and the common one is reading 80-column output on a phone. A tap is a small price for
  keys that are needed a few times a session.
- **Release sends.** Rejected in ADR 0015 and restated here: the words are shown before anything
  leaves the phone, because a misheard sentence sent into a live agent is not something the person
  can take back.
- **A scrim over the transcript while dictating.** Rejected. The reason to speak is usually visible
  in the last turn, and covering it forces the person to remember what they were answering.

## Consequences

The discard is a peer of Send rather than a corner affordance, because throwing away a bad
transcription is at least as common as sending a good one.

Nothing in the pane is reachable only by voice. Anything the Slab can send by speech can also be
typed, which is what keeps the one-tap keyboard an equal path rather than a fallback.
