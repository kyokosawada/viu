import { FlatList, Pressable, Text, View } from 'react-native';

import type { Fleet, Pane, PaneId } from '@viu/protocol';

import { detailOf, labelOf, needsYouFirst } from '../fleet';
import { addressOf, type Machine } from '../machine';

import { look } from './look';
import { lampFor, wordFor } from './states';

interface Showing {
  readonly machine: Machine;
  readonly herdr: string;
  readonly fleet: Fleet | null;
  readonly onOpen: (paneId: PaneId) => void;
  readonly onChangeMachine: () => void;
}

export function TheFleet({
  machine,
  herdr,
  fleet,
  onOpen,
  onChangeMachine,
}: Showing): React.JSX.Element {
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
          renderItem={({ item }) => (
            <APane
              pane={item}
              onOpen={() => {
                onOpen(item.id);
              }}
            />
          )}
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

function APane({
  pane,
  onOpen,
}: {
  readonly pane: Pane;
  readonly onOpen: () => void;
}): React.JSX.Element {
  const detail = detailOf(pane);
  return (
    <Pressable accessibilityRole="button" style={look.card} onPress={onOpen}>
      <View style={look.headline}>
        <View style={[look.lamp, { backgroundColor: lampFor(pane.state) }]} />
        <Text accessibilityRole="header" style={look.heading}>
          {labelOf(pane)}
        </Text>
      </View>
      <Text style={[look.state, { color: lampFor(pane.state) }]}>{wordFor(pane.state)}</Text>
      {detail !== null && <Text style={look.said}>{detail}</Text>}
    </Pressable>
  );
}
