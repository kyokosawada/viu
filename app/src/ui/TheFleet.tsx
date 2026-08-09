import { FlatList, Pressable, Text, View } from 'react-native';

import type { Fleet, Pane, PaneState } from '@viu/protocol';

import { detailOf, labelOf, needsYouFirst } from '../fleet';
import { addressOf, type Machine } from '../machine';

import { colour, look } from './look';

interface Showing {
  readonly machine: Machine;
  readonly herdr: string;
  readonly fleet: Fleet | null;
  readonly onChangeMachine: () => void;
}

export function TheFleet({ machine, herdr, fleet, onChangeMachine }: Showing): React.JSX.Element {
  return (
    <View style={[look.fill, look.screen, look.fromTheTop]}>
      <View>
        <Text style={look.title}>The fleet</Text>
        <Text style={look.said}>{`${addressOf(machine)} · herdr ${herdr}`}</Text>
      </View>

      {fleet === null ? (
        <Text style={look.said}>Reading the fleet.</Text>
      ) : (
        <FlatList
          style={look.fill}
          contentContainerStyle={look.list}
          data={needsYouFirst(fleet.panes)}
          keyExtractor={(pane) => pane.id}
          renderItem={({ item }) => <APane pane={item} />}
          ListEmptyComponent={
            <Text style={look.said}>herdr knows of no panes on this machine.</Text>
          }
        />
      )}

      <Pressable style={look.quiet} onPress={onChangeMachine}>
        <Text style={look.quietText}>Change the machine</Text>
      </Pressable>
    </View>
  );
}

function APane({ pane }: { readonly pane: Pane }): React.JSX.Element {
  const detail = detailOf(pane);
  return (
    <View style={look.card}>
      <View style={look.headline}>
        <View style={[look.lamp, { backgroundColor: LAMPS[pane.state] }]} />
        <Text accessibilityRole="header" style={look.heading}>
          {labelOf(pane)}
        </Text>
      </View>
      <Text style={[look.state, { color: LAMPS[pane.state] }]}>{WORDS[pane.state]}</Text>
      {detail !== null && <Text style={look.said}>{detail}</Text>}
    </View>
  );
}

const WORDS = {
  'needs-you': 'Needs you',
  thinking: 'Thinking',
  idle: 'Idle',
  dormant: 'Dormant',
  unknown: 'Unclear',
} satisfies Record<PaneState, string>;

const LAMPS = {
  'needs-you': colour.wants,
  thinking: colour.good,
  idle: colour.faded,
  dormant: colour.faded,
  unknown: colour.faded,
} satisfies Record<PaneState, string>;
