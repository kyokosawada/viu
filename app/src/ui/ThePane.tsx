import { FlatList, Pressable, Text, View, type ViewStyle } from 'react-native';

import type { Conversation, Pane, PaneId, Sent, Turn, TurnRole } from '@viu/protocol';

import type { Dictation } from '../dictation/dictation';
import { detailOf, labelOf } from '../fleet';
import type { Missed, Reach } from '../middleman/client';

import { look } from './look';
import { headingFor, whyOf } from './missed';
import { lampFor, wordFor } from './states';
import { TheSlab } from './TheSlab';

interface Showing {
  readonly paneId: PaneId;
  readonly pane: Pane | null;
  readonly conversation: Conversation | null;
  readonly missed: Missed | null;
  readonly elsewhere: readonly Pane[];
  readonly dictation: Dictation;
  readonly onOpen: (paneId: PaneId) => void;
  readonly onSend: (text: string) => Promise<Reach<Sent>>;
  readonly onBack: () => void;
}

export function ThePane({
  paneId,
  pane,
  conversation,
  missed,
  elsewhere,
  dictation,
  onOpen,
  onSend,
  onBack,
}: Showing): React.JSX.Element {
  const label = pane === null ? paneId : labelOf(pane);
  const under = [
    pane === null ? null : wordFor(pane.state),
    pane === null ? null : detailOf(pane),
    label === paneId ? null : paneId,
  ].filter((part) => part !== null);

  return (
    <View style={[look.fill, look.screen, look.fromTheTop]}>
      <View>
        <View style={look.headline}>
          {pane !== null && <View style={[look.lamp, { backgroundColor: lampFor(pane.state) }]} />}
          <Text accessibilityRole="header" style={look.title}>
            {label}
          </Text>
        </View>
        {under.length > 0 && <Text style={look.said}>{under.join(' · ')}</Text>}
      </View>

      {elsewhere.map((wanting) => (
        <Pressable
          key={wanting.id}
          accessibilityRole="button"
          style={look.calling}
          onPress={() => {
            onOpen(wanting.id);
          }}
        >
          <View style={[look.lamp, { backgroundColor: lampFor(wanting.state) }]} />
          <Text style={look.callingText}>{`${labelOf(wanting)} needs you`}</Text>
        </Pressable>
      ))}

      {missed !== null ? (
        <View style={look.card}>
          <Text style={look.heading}>{headingFor(missed)}</Text>
          <Text style={look.said}>{whyOf(missed)}</Text>
        </View>
      ) : conversation === null ? (
        <Text style={look.said}>Reading the pane.</Text>
      ) : (
        <FlatList
          style={look.fill}
          contentContainerStyle={look.list}
          data={conversation.turns}
          keyExtractor={(_turn, at) => String(at)}
          renderItem={({ item }) => <ATurn turn={item} />}
          ListEmptyComponent={<Text style={look.said}>This pane has said nothing yet.</Text>}
        />
      )}

      <Pressable style={look.quiet} onPress={onBack}>
        <Text style={look.quietText}>Back to the fleet</Text>
      </Pressable>

      <TheSlab pane={pane} dictation={dictation} onSend={onSend} />
    </View>
  );
}

function ATurn({ turn }: { readonly turn: Turn }): React.JSX.Element {
  return (
    <View accessibilityLabel={WHO[turn.role]} style={[look.card, look.turn, SHAPE[turn.role]]}>
      <View style={look.who}>
        <Text style={look.label}>{WHO[turn.role]}</Text>
        {turn.cut && <Text style={look.cut}>Cut off</Text>}
      </View>
      <Text style={turn.role === 'pane' ? look.raw : look.spoken}>{turn.text}</Text>
    </View>
  );
}

const WHO = {
  agent: 'The agent',
  person: 'You',
  pane: 'The pane',
} satisfies Record<TurnRole, string>;

const SHAPE = {
  agent: look.fromTheAgent,
  person: look.fromYou,
  pane: look.fromThePane,
} satisfies Record<TurnRole, ViewStyle>;
