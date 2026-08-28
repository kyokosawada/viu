import { useState } from 'react';
import { FlatList, Text, View } from 'react-native';

import type { Conversation, Key, Pane, PaneId, Send, Sent, Turn, TurnRole } from '@viu/protocol';

import type { Dictation } from '../dictation/dictation';
import { detailOf, labelOf } from '../fleet';
import type { Missed, Reach } from '../middleman/client';
import type { Picking } from '../picking/picking';

import { useLook } from './look';
import { advisedFor, headingFor, whyOf } from './missed';
import { StateChip } from './StateChip';
import { colourFor } from './states';
import { Tap } from './Tap';
import { TheSlab } from './TheSlab';

interface Showing {
  readonly paneId: PaneId;
  readonly pane: Pane | null;
  readonly conversation: Conversation | null;
  readonly missed: Missed | null;
  readonly elsewhere: readonly Pane[];
  readonly dictation: Dictation;
  readonly picking: Picking;
  readonly onOpen: (paneId: PaneId) => void;
  readonly onSend: (sending: Send) => Promise<Reach<Sent>>;
  readonly onKeys: (keys: readonly Key[]) => Promise<Reach<void>>;
  readonly onBack: () => void;
}

export function ThePane({
  paneId,
  pane,
  conversation,
  missed,
  elsewhere,
  dictation,
  picking,
  onOpen,
  onSend,
  onKeys,
  onBack,
}: Showing): React.JSX.Element {
  const { colour, look } = useLook();
  const label = pane === null ? paneId : labelOf(pane);
  const under = [
    pane === null ? null : detailOf(pane),
    label === paneId ? null : paneId,
  ].filter((part) => part !== null);

  return (
    <View style={[look.fill, look.screen, look.fromTheTop]}>
      <View style={look.topbar}>
        <View style={look.naming}>
          <Text accessibilityRole="header" style={look.title}>
            {label}
          </Text>
          {under.length > 0 && <Text style={look.said}>{under.join(' · ')}</Text>}
        </View>
        {pane !== null && <StateChip state={pane.state} />}
      </View>

      {elsewhere.map((wanting) => (
        <Tap
          key={wanting.id}
          accessibilityRole="button"
          style={look.calling}
          onPress={() => {
            onOpen(wanting.id);
          }}
        >
          <View style={[look.lamp, { backgroundColor: colourFor(wanting.state, colour) }]} />
          <Text style={look.callingText}>{`${labelOf(wanting)} needs you`}</Text>
        </Tap>
      ))}

      {missed !== null ? (
        <View style={look.card}>
          <Text style={look.heading}>{headingFor(missed)}</Text>
          <Text style={look.said}>{whyOf(missed)}</Text>
          <Text style={look.advice}>{advisedFor(missed)}</Text>
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

      <Tap style={look.quiet} onPress={onBack}>
        <Text style={look.quietText}>Back to the fleet</Text>
      </Tap>

      <TheSlab
        pane={pane}
        dictation={dictation}
        picking={picking}
        onSend={onSend}
        onKeys={onKeys}
      />
    </View>
  );
}

function ATurn({ turn }: { readonly turn: Turn }): React.JSX.Element {
  const { look } = useLook();

  if (turn.role === 'pane') {
    return <ATerminal turn={turn} />;
  }

  return (
    <View
      accessibilityLabel={WHO[turn.role]}
      style={turn.role === 'agent' ? look.fromTheAgent : look.fromYou}
    >
      {turn.cut && <Text style={look.cut}>Cut off</Text>}
      <Text style={turn.role === 'agent' ? look.spoken : look.saidByYou}>{turn.text}</Text>
    </View>
  );
}

function ATerminal({ turn }: { readonly turn: Turn }): React.JSX.Element {
  const { look } = useLook();
  const [open, setOpen] = useState(true);

  return (
    <View accessibilityLabel={WHO.pane} style={look.terminal}>
      <Tap
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={look.terminalHead}
        onPress={() => {
          setOpen(!open);
        }}
      >
        <Text importantForAccessibility="no" style={look.terminalName}>
          {WHO.pane}
        </Text>
        {turn.cut && <Text style={look.cut}>Cut off</Text>}
        <Text style={look.chevron}>{open ? '▾' : '▸'}</Text>
      </Tap>
      {open && (
        <Text style={look.raw}>
          {runsOf(turn.text).map((run, at) => (
            <Text key={at} style={run.outcome === null ? undefined : look[run.outcome]}>
              {run.words}
            </Text>
          ))}
        </Text>
      )}
    </View>
  );
}

interface Run {
  readonly words: string;
  readonly outcome: 'passed' | 'failed' | null;
}

function runsOf(text: string): readonly Run[] {
  return text
    .split(/\b(PASS|FAIL)\b/)
    .filter((words) => words !== '')
    .map((words) => ({ words, outcome: outcomeOf(words) }));
}

function outcomeOf(words: string): Run['outcome'] {
  if (words === 'PASS') {
    return 'passed';
  }
  if (words === 'FAIL') {
    return 'failed';
  }
  return null;
}

const WHO = {
  agent: 'The agent',
  person: 'You',
  pane: 'The pane',
} satisfies Record<TurnRole, string>;
