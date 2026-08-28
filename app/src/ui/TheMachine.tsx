import { Text, View } from 'react-native';

import { addressOf, type Machine } from '../machine';
import type { Missed } from '../middleman/client';

import { useLook, type Colours } from './look';
import {
  advisedFor,
  askingAgainHelps,
  brokenWordFor,
  headingFor,
  linkFor,
  saidFor,
  type Link,
} from './missed';
import { Tap } from './Tap';

interface Showing {
  readonly machine: Machine;
  readonly reach: Missed | null;
  readonly onTryAgain: () => void;
  readonly onChangeMachine: () => void;
}

type Standing =
  | { readonly kind: 'reached' }
  | { readonly kind: 'checking' }
  | { readonly kind: 'unasked' }
  | { readonly kind: 'broken'; readonly reach: Missed };

const CHAIN = ['machine', 'middleman', 'herdr'] as const;

const NAMES = {
  machine: 'Machine',
  middleman: 'Middleman',
  herdr: 'herdr',
} satisfies Record<Link, string>;

const WORDS = {
  reached: 'Reached',
  checking: 'Checking',
  unasked: 'Not reached',
} satisfies Record<Exclude<Standing, { kind: 'broken' }>['kind'], string>;

const TINTS = {
  reached: 'stateThinking',
  checking: 'stateIdle',
  unasked: 'stateIdle',
  broken: 'stateBad',
} satisfies Record<Standing['kind'], keyof Colours>;

const CHECKING = {
  machine: 'Asking whether anything is there.',
  middleman: 'Asking the middleman whether it is there.',
  herdr: 'Waiting on what the middleman says.',
} satisfies Record<Link, string>;

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
        {CHAIN.map((link, at) => (
          <ALink key={link} link={link} machine={machine} reach={reach} first={at === 0} />
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
  link,
  machine,
  reach,
  first,
}: {
  readonly link: Link;
  readonly machine: Machine;
  readonly reach: Missed | null;
  readonly first: boolean;
}): React.JSX.Element {
  const { colour, look } = useLook();
  const standing = standingOf(link, reach);

  return (
    <View style={[look.row, !first && look.ruled]}>
      <View style={look.between}>
        <Text style={[look.state, { color: colour.muted }]}>{NAMES[link]}</Text>
        <Text style={[look.state, { color: colour[TINTS[standing.kind]] }]}>
          {wordOf(standing)}
        </Text>
      </View>
      {link === 'machine' && <Text style={look.address}>{addressOf(machine)}</Text>}
      <Text style={look.said}>{reasonOf(link, standing)}</Text>
    </View>
  );
}

function standingOf(link: Link, reach: Missed | null): Standing {
  if (reach === null) return { kind: 'checking' };
  const troubled = CHAIN.indexOf(linkFor(reach));
  const at = CHAIN.indexOf(link);
  if (at < troubled) return { kind: 'reached' };
  return at === troubled ? { kind: 'broken', reach } : { kind: 'unasked' };
}

function wordOf(standing: Standing): string {
  return standing.kind === 'broken' ? brokenWordFor(standing.reach) : WORDS[standing.kind];
}

function reasonOf(link: Link, standing: Standing): string {
  switch (standing.kind) {
    case 'broken':
      return saidFor(standing.reach);
    case 'checking':
      return CHECKING[link];
    case 'reached':
      return 'It answered.';
    case 'unasked':
      return 'Nothing got far enough to ask.';
  }
}

function headingOf(reach: Missed | null): string {
  return reach === null ? 'Reaching the machine' : headingFor(reach);
}
