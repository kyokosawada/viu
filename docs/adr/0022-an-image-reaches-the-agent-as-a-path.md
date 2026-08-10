# An image reaches the agent as a path, not as bytes

A pane is a terminal. The only things that reach one are text and keystrokes, so there is no way to
put a picture into it. Sending an image to an agent is therefore two steps rather than one: the
phone uploads the image over the tailnet, the middleman writes it into the **attachments
directory** as an **attachment**, and the agent is sent an ordinary text prompt carrying that
attachment's absolute path. The agent reads the image off the disk it is already running on.

The prompt is the owner's optional **caption** followed by the path, worded agent-neutrally
(`Image: /home/...`), because Viu hands over a path and what an agent makes of it is the agent's own
capability. Anything that can open a file by path can use it; nothing has to be taught Viu's format.

## Considered Options

- **Push the bytes into the pane.** Not an option, which is the whole of this decision. A terminal
  takes characters; base64 into a shell is a paste bomb rather than an image, and an agent TUI in raw
  mode would read it as typing.
- **A temporary file per send, cleaned up immediately.** Rejected. The agent reads the path some
  seconds or minutes after the prompt lands, and a file deleted on the way out is a path that has
  already stopped working. Attachments outlive the send and are swept on age instead.
- **Write the attachment into the pane's own project directory.** Rejected. It puts a photo inside a
  git checkout, which is one careless `git add` away from being committed, and it makes "where did
  Viu put my images" depend on which pane was open. `~/.viu/attachments/` is one place, outside every
  project.
- **A second endpoint that only stores, leaving the phone to send the path as text.** Rejected. It
  would give the phone two round trips to keep in step and a way to send a path for an attachment
  that was never written. One call stores and sends, and answers with the existing send guarantee.

## Consequences

The upload endpoint is on the same tailnet-only binding as the rest of the HTTP surface
([ADR 0003](0003-tailscale-is-the-access-control.md)). Being on the tailnet remains the whole of the
authorisation over the wire - the image endpoint adds no credential and no exception, and it is
proven unreachable off the served address the same way everything else is.

ADR 0003 is about the network, though, and a file is also reachable by anyone already on the
machine. So an attachment is written `0600` inside a `0700` directory: the owner's photos are not
readable by another account on their own desk, which is a promise the tailnet was never making.

The middleman now writes to disk, which
[ADR 0004](0004-middleman-is-stateless.md) is worth reading against. It holds no conversation state:
an attachment is a file handed to the agent, not something Viu reads back, and nothing about a pane
is remembered by writing one. What it does own is the cleanup - attachments older than seven days
are deleted as each new one lands and once when the service starts, so the folder stays bounded
without a timer to keep running or a machine-wide scheduler to install.

A send that fails after the attachment is written leaves the file behind. That is deliberate: the
path may already be in a prompt somewhere, and the sweep collects it within the week either way.

An image is one prompt, so it is one **send**, and it answers with the same guarantee words do
([ADR 0006](0006-panes-are-the-addressing-model.md)). The phone has one language for "did it land"
across voice, keyboard and image rather than a second one for pictures.
