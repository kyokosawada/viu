import type { Trouble } from '@viu/protocol';

import type { Missed } from '../middleman/client';

const HEADINGS = {
  'protocol-mismatch': 'Viu and the middleman disagree',
  'herdr-unreachable': 'The middleman cannot reach herdr',
  'herdr-refused': 'herdr turned the middleman down',
  'pane-gone': 'That pane is gone',
  'pane-not-accepting-input': 'That pane is not taking input',
  'unsupported-key': 'Viu has no name for that key',
  'malformed-request': 'The middleman could not read what Viu asked',
  'too-much': 'That was more than the middleman takes',
  'no-such-endpoint': 'The middleman serves nothing there',
  'attachment-not-stored': 'The machine could not keep that image',
  'middleman-failed': 'The middleman could not answer',
} satisfies Record<Trouble['kind'], string>;

const ADVICE = {
  'protocol-mismatch':
    'Update Viu or the middleman until the two speak the same protocol. Asking again changes nothing.',
  'herdr-unreachable':
    'Start herdr on the machine. Viu holds the connection and shows the fleet the moment it answers.',
  'herdr-refused':
    'herdr is running and turned the middleman down. It is the machine that has to change, not the phone.',
  'pane-gone':
    'The pane is no longer on the machine. Go back to the fleet for the panes that are.',
  'pane-not-accepting-input':
    'The pane is still on the machine, but nothing can be sent into it as it stands.',
  'unsupported-key': 'Nothing was pressed. This Viu has no name for that key.',
  'malformed-request':
    'Viu asked for something the middleman could not read. The two are likely different versions.',
  'too-much': 'Send it in smaller pieces.',
  'no-such-endpoint':
    'The middleman serves nothing at that address, which usually means it is a different version.',
  'attachment-not-stored':
    'Nothing was sent. The image never reached the attachments folder, so check the room and the permissions on the machine.',
  'middleman-failed':
    'The middleman is there and fell over answering. Its log on the machine says more than Viu can.',
} satisfies Record<Trouble['kind'], string>;

const ASKING_AGAIN_CHANGES_NOTHING = {
  'protocol-mismatch': true,
  'malformed-request': true,
  'no-such-endpoint': true,
  'unsupported-key': true,
} satisfies Partial<Record<Trouble['kind'], true>>;

export function headingFor(reach: Missed): string {
  switch (reach.kind) {
    case 'unreachable':
      return 'Cannot reach the machine';
    case 'not-the-middleman':
      return 'That is not the middleman';
    case 'trouble':
      return HEADINGS[reach.trouble.kind];
  }
}

export function advisedFor(reach: Missed): string {
  switch (reach.kind) {
    case 'unreachable':
      return 'Viu keeps trying on its own, and the fleet returns the moment the machine does.';
    case 'not-the-middleman':
      return 'Check the machine name and the port. Something else is answering there.';
    case 'trouble':
      return ADVICE[reach.trouble.kind];
  }
}

export function askingAgainHelps(reach: Missed): boolean {
  if (reach.kind !== 'trouble') return true;
  return !Object.hasOwn(ASKING_AGAIN_CHANGES_NOTHING, reach.trouble.kind);
}

export function whyOf(reach: Missed): string {
  return reach.kind === 'trouble' ? reach.trouble.message : reach.why;
}
