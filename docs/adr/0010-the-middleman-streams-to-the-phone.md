# The middleman streams to the phone

The phone holds an open connection and the middleman pushes changes down it. The phone does not poll
on a timer.

herdr can push agent status changes as real events but explicitly cannot push "this pane's output
changed" - there is no such event for agent panes, and content has to be polled and diffed. So the
middleman polls herdr regardless. Having the phone poll the middleman on top of that stacks two
polling layers and makes the handset pay radio cost on a timer even when nothing has happened.

## Consequences

A live connection to manage, reconnect, and tear down when the app is backgrounded - more work than
a timer. In exchange the phone's screen only wakes when something really changed, and "your agent
needs you" arrives as fast as herdr can report it.

Polling herdr for content should be limited to the pane currently on screen and stopped when the
phone is not looking.
