# An image stands where it was placed, as its own path

A message is an ordered list of parts, each part a run of the person's words or one image, and the
prompt the agent reads is those parts walked in order: a run of words is the words, and an image is
the absolute path of the **attachment** it was stored as, standing exactly where the person put it.
"look at this /home/you/.viu/attachments/...jpg here" is one sentence with a picture in it. The
`Send` on the wire says the same thing - `parts`, not words and a list of pictures - which takes
`PROTOCOL_VERSION` to 5.

This supersedes one option in
[ADR 0023](0023-the-slab-composes-words-and-images-together.md): **Interleave the images where they
were attached in the text**, rejected there. Everything else that ADR decided stands - one message,
one send, the retired **caption**, the compact tag rather than a preview.

The objection was real and it is what took a ticket to answer: interleaving "would need a position
marker inside what the person typed, which is a small format for every agent to learn". It does not,
because there is no marker to learn. What is substituted at the position is the path itself, which
[ADR 0022](0022-an-image-reaches-the-agent-as-a-path.md) already hands over and anything that can
open a file already understands. The `[Image #1]` token belongs to the Slab, on the phone, in front
of the person composing; it is gone before the send leaves. The agent is handed a sentence, not a
grammar.

What made the rejected reading cost more than it saved was the message it produced. Words then every
path at the end is unambiguous with one image and guesswork with two: "this screen is wrong, make it
look like this" followed by two paths says nothing about which is which, and the agent has to pick.
The order the pictures were attached in is not the pairing, and the person had no way to say the
pairing at all.

## Considered Options

- **Keep the append model and add a marker the person types.** Rejected, and this is ADR 0023's
  objection standing: `{{image1}}` or any such spelling is a format to teach the person and a format
  to teach the agent, for something the path already says.
- **Send the images as separate turns, positioned by their order.** Rejected. Two prompts are two
  turns, which is the bug [ADR 0023](0023-the-slab-composes-words-and-images-together.md) was
  written to fix; an agent answers the first before the second arrives.
- **Keep `text` and add a list of offsets into it.** Rejected. It is the same information as an
  ordered list of parts, held twice and able to disagree - an offset past the end of the words, or
  two offsets in an order the list does not have. Parts cannot be out of step with themselves.
- **Label each path in place, as `Image: /path` was labelled.** Rejected. The label was carrying the
  break between the words and the paths at the end; inside a sentence it is noise the person did not
  write. The spacing comes from the person's own runs of words, and two images placed side by side
  get a single space between them.

## Consequences

An installed phone and a running middleman must be updated together once more, and for the same
reason as before: the greeting names protocol 5, a phone speaking 4 reads a `protocol-mismatch` and
shows no fleet. There is no middleman that serves both shapes, because one person owns both sides.

The Slab now holds a composition with positions in it, not a text and a bag of pictures. Placing is
the caret's business, so the token goes where the person is composing, and the token and the image
are one thing - rubbing the token out of the words drops the image with it. That is the composer
this ADR forces, and [#57](https://github.com/kyokosawada/viu/issues/57) is where it is finished.

The middleman's assembly stays a pure walk over the parts with the kept paths beside them, so what
an agent would read is checked without a socket or a disk. Nothing else about
[ADR 0022](0022-an-image-reaches-the-agent-as-a-path.md) moves: the same directory, the same `0600`
inside `0700`, the same seven-day sweep, the same failure leaving an earlier attachment on disk.
