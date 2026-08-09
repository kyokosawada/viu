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
  'middleman-failed': 'The middleman could not answer',
} satisfies Record<Trouble['kind'], string>;

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

export function whyOf(reach: Missed): string {
  return reach.kind === 'trouble' ? reach.trouble.message : reach.why;
}
