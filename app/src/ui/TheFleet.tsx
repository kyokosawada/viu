import { SectionList, Text, View } from 'react-native';

import type { Fleet, Pane, PaneId } from '@viu/protocol';

import { detailOf, labelOf, needsYouFirst } from '../fleet';
import { addressOf, type Machine } from '../machine';

import { useLook } from './look';
import { StateChip } from './StateChip';
import { wordFor } from './states';
import { Tap } from './Tap';

interface Showing {
  readonly machine: Machine;
  readonly herdr: string;
  readonly fleet: Fleet | null;
  readonly onOpen: (paneId: PaneId) => void;
  readonly onChangeMachine: () => void;
}

interface Grouping {
  readonly title: string | null;
  readonly data: readonly Pane[];
}

export function TheFleet({
  machine,
  herdr,
  fleet,
  onOpen,
  onChangeMachine,
}: Showing): React.JSX.Element {
  const { look } = useLook();

  return (
    <View style={[look.fill, look.screen, look.fromTheTop]}>
      <View>
        <Text style={look.title}>The fleet</Text>
        <Text style={look.said}>{`${addressOf(machine)} · herdr ${herdr}`}</Text>
      </View>

      {fleet === null ? (
        <Text style={look.said}>Reading the fleet.</Text>
      ) : (
        <SectionList
          style={[look.fill, look.bleed]}
          contentContainerStyle={look.panes}
          sections={groupsOf(fleet.panes)}
          keyExtractor={(pane) => pane.id}
          renderSectionHeader={({ section }) =>
            section.title === null ? null : <Text style={look.section}>{section.title}</Text>
          }
          ItemSeparatorComponent={() => <View style={look.hairline} />}
          renderItem={({ item }) => (
            <APane
              pane={item}
              onOpen={() => {
                onOpen(item.id);
              }}
            />
          )}
          ListEmptyComponent={
            <Text style={[look.said, look.inset]}>herdr knows of no panes on this machine.</Text>
          }
        />
      )}

      <Tap style={look.quiet} onPress={onChangeMachine}>
        <Text style={look.quietText}>Change the machine</Text>
      </Tap>
    </View>
  );
}

function groupsOf(panes: readonly Pane[]): readonly Grouping[] {
  const sorted = needsYouFirst(panes);
  const wanting = sorted.filter((pane) => pane.state === 'needs-you');

  if (wanting.length === 0) {
    return sorted.length === 0 ? [] : [{ title: null, data: sorted }];
  }

  const rest = sorted.filter((pane) => pane.state !== 'needs-you');
  return [
    { title: wordFor('needs-you'), data: wanting },
    ...(rest.length === 0 ? [] : [{ title: 'The rest', data: rest }]),
  ];
}

function APane({
  pane,
  onOpen,
}: {
  readonly pane: Pane;
  readonly onOpen: () => void;
}): React.JSX.Element {
  const { look } = useLook();
  const detail = detailOf(pane);

  return (
    <Tap accessibilityRole="button" style={look.paneRow} onPress={onOpen}>
      <View style={look.naming}>
        <Text accessibilityRole="header" numberOfLines={1} style={look.paneName}>
          {labelOf(pane)}
        </Text>
        {detail !== null && (
          <Text numberOfLines={1} style={look.paneDetail}>
            {detail}
          </Text>
        )}
      </View>
      <StateChip state={pane.state} />
    </Tap>
  );
}
