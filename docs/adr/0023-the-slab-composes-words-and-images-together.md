# The Slab composes words and images together, as one message

The Slab holds one message at a time, not one thing at a time. A message is the person's words plus
however many images they attached to it, and a single **Send** delivers all of it. **Attach an
image** is offered while words are waiting, whether they were typed or dictated; each picture joins
the draft as a compact `[Image #1]` tag that a tap removes; the order they were attached in is the
order the agent is handed them.

The app and the middleman say so in one shape: a `Send` carrying the text and an ordered list of
images, posted to `POST /panes/<pane>/send`. That replaces the separate image call of protocol v3
and takes `PROTOCOL_VERSION` to 4.

This reverses part of what [ADR 0016](0016-the-slab-is-a-hold-bar.md) and
[ADR 0020](0020-the-slab-is-always-available-and-says-what-it-knows.md) built, and it is worth being
plain about which part. Both stand: holding still dictates and releasing still sends nothing, the
Slab is still present on every pane, and it still says only what the middleman actually answered.
What does not stand is the reading of ADR 0016 that made the Slab a sequence of exclusive moments -
dictate, then send; pick a picture, then caption it, then send that. That shape was never a decision
either ADR argued for. It fell out of each capability arriving on its own, and the first person to
type a sentence and reach for a screenshot found the sentence still sitting in the box afterwards,
needing a second send of its own.

The **caption** retires with it. There is one text for the whole message, so there is nothing left
for a picture to be captioned by, and `CONTEXT.md` no longer carries the word.

## Considered Options

- **Send the words, then send the image, and let the person do it twice.** Rejected: this is the
  bug. Two sends are two prompts, and an agent reading "this button is wrong" a turn before it is
  handed a path has already started answering the wrong question.
- **Keep both calls and add a third that carries the pair.** Rejected. Three ways to say one thing
  is three things to keep in step, and the seam the app talks to the machine through is worth more
  than the cost of one migration. One call now covers words, a picture, and both.
- **Keep the full-preview screen and let it carry the words.** Rejected. It puts a second text
  field in the app, so where the words go depends on which button was tapped first, and a
  photograph large enough to be worth previewing covers the turn being answered - which
  [ADR 0016](0016-the-slab-is-a-hold-bar.md) refused a scrim for. A tag says one is attached; the
  phone's own gallery is where a picture is looked at.
- **Interleave the images where they were attached in the text.** Rejected. It would need a
  position marker inside what the person typed, which is a small format for every agent to learn
  ([ADR 0022](0022-an-image-reaches-the-agent-as-a-path.md) hands over paths precisely so nothing
  has to). Words then paths, in order, needs no grammar.
- **Keep one image per message and only fix the words.** Rejected. Two screenshots of the same
  broken screen is the ordinary case, and the count was never a decision - it was what one picker
  and one caption field happened to allow.

## Consequences

An installed phone and a running middleman must be updated together. A phone speaking 3 against a
middleman speaking 4 gets `protocol-mismatch` and no fleet, which is the honest answer and the one
that already had a screen; there is nothing to be gained from a middleman serving both shapes when
one person owns both sides.

The Slab now has state that outlives its modes: the words, the cut-short mark and the attached
images survive picking an image, waving the picker away, and a send that missed. Anything added to
it later has to answer what happens to that composition, the way ADR 0020 says any new pane state
has to answer what the Slab says on it.

The middleman writes N attachments where it wrote one. A failure part way through leaves the
earlier files on disk and fails the whole send - `attachment-not-stored`, nothing reaching the pane
- which ADR 0022 already accounts for: an attachment outlives its send and the seven-day sweep
collects it either way.

The ceiling on a send is now the ceiling on a body carrying photographs, not the one on words a
person dictates. It is one endpoint, so it is one limit, and it is sized for the pictures.
