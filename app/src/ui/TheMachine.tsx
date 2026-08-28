import { Text, View } from 'react-native';

import { addressOf, type Machine } from '../machine';
import type { Missed } from '../middleman/client';

import { useLook, type Colours } from './look';
import { advisedFor, askingAgainHelps, headingFor } from './missed';
import { Tap } from './Tap';

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
  const { colour, look } = useLook();
  const address = addressOf(machine);

  return (
    <View style={[look.fill, look.screen]}>
      <Text style={look.title}>Viu</Text>

      <View style={look.card}>
        <View style={look.headline}>
          <View style={[look.lamp, { backgroundColor: lampFor(reach, colour) }]} />
          <Text style={look.heading}>{headingOf(reach)}</Text>
        </View>
        <Text style={look.address}>{address}</Text>
        <Text style={look.said}>{saidOf(reach)}</Text>
        {reach !== null && <Text style={look.advice}>{advisedFor(reach)}</Text>}
      </View>

      {reach !== null && askingAgainHelps(reach) && (
        <Tap style={look.button} onPress={onTryAgain}>
          <Text style={look.buttonText}>Try again</Text>
        </Tap>
      )}

      <Tap style={look.quiet} onPress={onChangeMachine}>
        <Text style={look.quietText}>Change the machine</Text>
      </Tap>
    </View>
  );
}

function lampFor(reach: Missed | null, colour: Colours): string {
  return reach === null ? colour.stateIdle : colour.stateBad;
}

function headingOf(reach: Missed | null): string {
  return reach === null ? 'Reaching the machine' : headingFor(reach);
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
