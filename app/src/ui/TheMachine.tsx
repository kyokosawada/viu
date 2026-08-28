import { Text, View } from 'react-native';

import { addressOf, type Machine } from '../machine';
import type { Missed } from '../middleman/client';

import { useLook, type Colours } from './look';
import { advisedFor, askingAgainHelps, brokeAt, headingFor, type Hop } from './missed';
import { Tap } from './Tap';

interface Showing {
  readonly machine: Machine;
  readonly reach: Missed | null;
  readonly onTryAgain: () => void;
  readonly onChangeMachine: () => void;
}

type Standing = 'reached' | 'waiting' | 'broken' | 'unasked';

const CHAIN = ['machine', 'middleman', 'herdr'] as const;

const NAMES = {
  machine: 'Machine',
  middleman: 'Middleman',
  herdr: 'herdr',
} satisfies Record<Hop, string>;

export function TheMachine({
  machine,
  reach,
  onTryAgain,
  onChangeMachine,
}: Showing): React.JSX.Element {
  const { look } = useLook();

  return (
    <View style={[look.fill, look.screen, look.fromTheTop]}>
      <View>
        <Text style={look.label}>Viu</Text>
        <Text accessibilityRole="header" style={look.title}>
          {headingOf(reach)}
        </Text>
      </View>

      <View style={look.rows}>
        {CHAIN.map((hop, at) => (
          <ALink key={hop} hop={hop} machine={machine} reach={reach} first={at === 0} />
        ))}
      </View>

      <View style={look.fill} />

      <View style={[look.bench, reach !== null && look.troubled]}>
        {reach !== null && <Text style={look.advice}>{advisedFor(reach)}</Text>}

        {reach !== null && askingAgainHelps(reach) && (
          <Tap style={look.button} onPress={onTryAgain}>
            <Text style={look.buttonText}>Try again</Text>
          </Tap>
        )}

        <Tap style={look.quiet} onPress={onChangeMachine}>
          <Text style={look.quietText}>Change the machine</Text>
        </Tap>
      </View>
    </View>
  );
}

function ALink({
  hop,
  machine,
  reach,
  first,
}: {
  readonly hop: Hop;
  readonly machine: Machine;
  readonly reach: Missed | null;
  readonly first: boolean;
}): React.JSX.Element {
  const { colour, look } = useLook();
  const standing = standingOf(hop, reach);
  const reason = reasonOf(hop, standing, reach);

  return (
    <View style={[look.row, !first && look.ruled]}>
      <View style={look.between}>
        <Text style={[look.state, { color: colour.muted }]}>{NAMES[hop]}</Text>
        <Text style={[look.state, { color: tintOf(standing, colour) }]}>
          {wordOf(standing, reach)}
        </Text>
      </View>
      {hop === 'machine' && <Text style={look.address}>{addressOf(machine)}</Text>}
      {reason !== null && <Text style={look.said}>{reason}</Text>}
    </View>
  );
}

function standingOf(hop: Hop, reach: Missed | null): Standing {
  if (reach === null) return 'waiting';
  const broke = CHAIN.indexOf(brokeAt(reach));
  const at = CHAIN.indexOf(hop);
  if (at < broke) return 'reached';
  return at === broke ? 'broken' : 'unasked';
}

function wordOf(standing: Standing, reach: Missed | null): string {
  switch (standing) {
    case 'reached':
      return 'Reached';
    case 'waiting':
      return 'Checking';
    case 'unasked':
      return 'Not reached';
    case 'broken':
      return reach === null ? 'Not reached' : brokenWordOf(reach);
  }
}

function brokenWordOf(reach: Missed): string {
  switch (reach.kind) {
    case 'unreachable':
      return 'Not answering';
    case 'not-the-middleman':
      return 'Not the middleman';
    case 'trouble':
      return 'Failed';
  }
}

function tintOf(standing: Standing, colour: Colours): string {
  switch (standing) {
    case 'reached':
      return colour.stateThinking;
    case 'broken':
      return colour.stateBad;
    case 'waiting':
    case 'unasked':
      return colour.stateIdle;
  }
}

function reasonOf(hop: Hop, standing: Standing, reach: Missed | null): string | null {
  if (standing === 'broken' && reach !== null) return saidOf(reach);
  if (hop === 'machine') return null;
  switch (standing) {
    case 'reached':
      return 'It answered.';
    case 'waiting':
      return hop === 'middleman'
        ? 'Asking the middleman whether it is there.'
        : 'Nothing has asked it yet.';
    default:
      return 'Nothing got far enough to ask.';
  }
}

function headingOf(reach: Missed | null): string {
  return reach === null ? 'Reaching the machine' : headingFor(reach);
}

function saidOf(reach: Missed): string {
  switch (reach.kind) {
    case 'unreachable':
      return `Nothing answered: ${reach.why}. Nothing of the fleet is shown until it does.`;
    case 'not-the-middleman':
      return `Something answered, but ${reach.why}.`;
    case 'trouble':
      return reach.trouble.message;
  }
}
