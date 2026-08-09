import { Pressable, Text, View } from 'react-native';

import type { Trouble } from '@viu/protocol';

import { addressOf, type Machine } from '../machine';
import type { Missed } from '../middleman/client';

import { colour, look } from './look';

interface Showing {
  readonly machine: Machine;
  readonly reach: Missed | null;
  readonly onTryAgain: () => void;
  readonly onChangeMachine: () => void;
}

export function TheMachine({
  machine,
  reach,
  onTryAgain,
  onChangeMachine,
}: Showing): React.JSX.Element {
  const address = addressOf(machine);

  return (
    <View style={[look.fill, look.screen]}>
      <Text style={look.title}>Viu</Text>

      <View style={look.card}>
        <View style={look.headline}>
          <View style={[look.lamp, { backgroundColor: lampFor(reach) }]} />
          <Text style={look.heading}>{headingFor(reach)}</Text>
        </View>
        <Text style={look.address}>{address}</Text>
        <Text style={look.said}>{saidOf(reach)}</Text>
      </View>

      {reach !== null && (
        <Pressable style={look.button} onPress={onTryAgain}>
          <Text style={look.buttonText}>Try again</Text>
        </Pressable>
      )}

      <Pressable style={look.quiet} onPress={onChangeMachine}>
        <Text style={look.quietText}>Change the machine</Text>
      </Pressable>
    </View>
  );
}

function lampFor(reach: Missed | null): string {
  return reach === null ? colour.faded : colour.bad;
}

function headingFor(reach: Missed | null): string {
  if (reach === null) return 'Reaching the machine';
  switch (reach.kind) {
    case 'unreachable':
      return 'Cannot reach the machine';
    case 'not-the-middleman':
      return 'That is not the middleman';
    case 'trouble':
      return headingForTrouble(reach.trouble);
  }
}

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

function headingForTrouble(trouble: Trouble): string {
  return HEADINGS[trouble.kind];
}

function saidOf(reach: Missed | null): string {
  if (reach === null) return 'Asking the middleman whether it is there.';
  switch (reach.kind) {
    case 'unreachable':
      return `Nothing answered: ${reach.why}. Nothing of the fleet is shown until it does.`;
    case 'not-the-middleman':
      return `Something answered, but ${reach.why}.`;
    case 'trouble':
      return reach.trouble.message;
  }
}
