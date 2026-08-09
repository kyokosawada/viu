# Interrupted dictation keeps what it heard

When the recogniser fails part way through a hold, Viu keeps the words it already captured, shows
them, and marks them visibly as cut short. The person can edit them, send them, or discard them like
any other transcript.

## Considered Options

- **Discard the partial words silently.** Rejected. From the phone there is no way to tell the
  difference between a recogniser that died and a sentence that was never heard - the person is left
  wondering whether they lost words or only imagined speaking, and the only recovery is to say the
  whole thing again and hope.

## Consequences

The cut-short mark is part of the decision, not decoration. Partial words presented as a finished
transcript are worse than no words at all, because a half-sentence often reads as a whole one.
