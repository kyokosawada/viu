# Viu is a phone client for a fleet, not a terminal

Viu shows you your agents and lets you answer them from a phone. It is deliberately not an SSH
client and not a terminal emulator: it speaks a JSON protocol to a small service on the machine
rather than carrying a PTY to the handset.

## Consequences

Anything that only makes sense inside a real terminal - resizing, scrollback paging, curses
applications, arbitrary shell work - is out of scope by construction rather than unimplemented.
Viu cannot choose a pane's width; the grid belongs to whatever client is attached on the machine.
