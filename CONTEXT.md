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
person sent.
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

**Slab**:
The input control at the bottom of a pane, holding hold-to-talk dictation, the keyboard, and a
discard beside send.
_Avoid_: composer, input bar, toolbar

**Quick-key bar**:
The row of keys the Slab reveals alongside the keyboard, for the keys a phone keyboard does not
have.
_Avoid_: shortcuts, hotkeys, action bar, key row

**Dictation**:
Speaking into the Slab to produce text. The text is always shown before anything is sent.
_Avoid_: voice, speech, transcription
