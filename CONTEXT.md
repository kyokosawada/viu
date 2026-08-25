# Viu

A phone client for a herdr agent fleet running on a personal machine. Viu exists so the person who
owns that machine can see what their agents are doing, and answer the one that needs them, without
being at the desk.

## Language

**Fleet**:
Every pane a single herdr server knows about, presented as one flat list.
_Avoid_: session, workspace, cluster

**Pane**:
The addressable unit of the fleet, and the thing a person opens. Holds either an agent or an
ordinary shell.
_Avoid_: window, terminal, tab, screen

**Agent**:
A coding assistant herdr currently recognises inside a pane. Not every pane has one.
_Avoid_: bot, assistant, worker

**Dormant pane**:
A pane that holds a past agent conversation but no agent herdr can currently see. The common
resting state of finished work, and distinct from a pane that never had an agent.
_Avoid_: unknown, dead, stale

**Middleman**:
The service on the machine that Viu talks to. Translates between herdr and Viu and holds no
conversation state of its own.
_Avoid_: bridge, proxy, server, daemon, backend

**Turn**:
One unit of the conversation as Viu presents it - something the agent said, or something the
person sent. What the person sends is one turn whether it is words, images, or both: text and
images in the order they were placed, delivered together.
_Avoid_: message, block, entry, line

**Needs you**:
The pane state meaning the agent has stopped and is waiting on a person. The state Viu exists to
surface.
_Avoid_: blocked, waiting, stuck, paused

**Thinking**:
The pane state meaning the agent is working and nothing is expected from a person.
_Avoid_: working, busy, running

**Screenful**:
Everything Viu can show of a pane's output. An agent pane keeps no scrollback, so a screenful is
all that exists, not a window onto something longer.
_Avoid_: history, scrollback, transcript, log

**Chrome**:
Everything a pane draws that is not the conversation - the input area, the status line, the
spinner. Never a **turn**, except when the input area is holding a question, which is the one
thing worth reading.
_Avoid_: furniture, UI, decoration, boilerplate

**Slab**:
The input control at the bottom of a pane, holding hold-to-talk dictation, the keyboard, the
quick-key bar, attaching an image, and a discard beside send. It composes one **turn** - the words
with each image standing where it was placed among them - and one send delivers all of it.
_Avoid_: composer, input bar, toolbar

**Quick-key bar**:
The row of keys the Slab reveals alongside the keyboard, for the keys a phone keyboard does not
have.
_Avoid_: shortcuts, hotkeys, action bar, key row

**Trouble**:
One named thing that went wrong, as the middleman tells Viu about it - a gone pane, a herdr that is
down, a refused send. Always one of a known set, never a generic failure.
_Avoid_: error, failure, exception, problem

**Reach**:
What the phone gets back when it asks the machine anything: it was reached, nothing answered,
something answered that is not the middleman, or the middleman named a trouble. A machine Viu cannot
reach is not a trouble, because the middleman cannot report its own absence.
_Avoid_: status, connectivity, online, offline

**Attachment**:
An image once it has landed on the machine as a file. What reaches the agent is its absolute path
inside a prompt, never the image itself - a pane is a terminal and cannot be handed bytes. A
**turn** may carry several, and each path stands where its image was placed among the words.
_Avoid_: upload, file, asset, media

**Attachments directory**:
`~/.viu/attachments/`, the one place attachments land. Outside every project, and swept of anything
older than seven days.
_Avoid_: uploads folder, temp directory, cache

**Dictation**:
Speaking into the Slab to produce text. The text is always shown before anything is sent.
_Avoid_: voice, speech, transcription
