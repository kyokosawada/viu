import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import type { Key, Pane, Sent } from '@viu/protocol';

import type { Dictation, Held } from '../dictation/dictation';
import type { Missed, Reach } from '../middleman/client';
import { nothingAnswered } from '../middleman/trouble';
import { guaranteeOf, type Guarantee } from '../sending';

import { look } from './look';
import { headingFor, whyOf } from './missed';

interface Slabbing {
  readonly pane: Pane | null;
  readonly dictation: Dictation;
  readonly onSend: (text: string) => Promise<Reach<Sent>>;
  readonly onKeys: (keys: readonly Key[]) => Promise<Reach<void>>;
}

type Doing =
  | { readonly at: 'ready' }
  | { readonly at: 'holding'; readonly words: string }
  | {
      readonly at: 'drafting';
      readonly words: string;
      readonly cutShort: string | null;
      readonly typing: boolean;
    }
  | { readonly at: 'sending' };

type Answer =
  | { readonly kind: 'guarantee'; readonly guarantee: Guarantee }
  | { readonly kind: 'missed'; readonly missed: Missed }
  | { readonly kind: 'note'; readonly note: string };

const NOTHING_HEARD = 'Nothing was heard.';

const HOLDING = 200;

export function TheSlab({ pane, dictation, onSend, onKeys }: Slabbing): React.JSX.Element {
  const [doing, setDoing] = useState<Doing>({ at: 'ready' });
  const [answer, setAnswer] = useState<Answer | null>(null);
  const held = useRef<Held | null>(null);
  const spoke = useRef(false);
  const gone = useRef(false);

  useEffect(() => {
    gone.current = false;
    return () => {
      gone.current = true;
      held.current?.release();
      held.current = null;
    };
  }, []);

  const hold = () => {
    spoke.current = true;
    setAnswer(null);
    setDoing({ at: 'holding', words: '' });
    const holding = dictation.hold((heard) => {
      if (gone.current) return;
      if (heard.kind === 'hearing') {
        setDoing({ at: 'holding', words: heard.words });
        return;
      }
      held.current = null;
      if (heard.kind === 'cut-short') {
        setDoing({ at: 'drafting', words: heard.words, cutShort: heard.why, typing: false });
      } else if (heard.words.trim() === '') {
        setDoing({ at: 'ready' });
        setAnswer({ kind: 'note', note: NOTHING_HEARD });
      } else {
        setDoing({ at: 'drafting', words: heard.words, cutShort: null, typing: false });
      }
    });
    held.current = holding;
  };

  const release = () => {
    const holding = held.current;
    held.current = null;
    holding?.release();
  };

  const reveal = () => {
    if (spoke.current) return;
    setAnswer(null);
    setDoing({ at: 'drafting', words: '', cutShort: null, typing: true });
  };

  const press = (key: Key, named: string) => {
    setAnswer(null);
    const settle = (reach: Reach<void>) => {
      if (gone.current) return;
      setAnswer(
        reach.kind === 'reached'
          ? { kind: 'note', note: `${named} went into the pane.` }
          : { kind: 'missed', missed: reach },
      );
    };
    void onKeys([key]).then(settle, (error: unknown) => {
      settle(nothingAnswered(error));
    });
  };

  const send = (text: string, cutShort: string | null, typing: boolean) => {
    if (text.trim() === '') return;
    const kept: Doing = { at: 'drafting', words: text, cutShort, typing };
    setDoing({ at: 'sending' });
    setAnswer(null);
    const settle = (reach: Reach<Sent>) => {
      if (gone.current) return;
      if (reach.kind === 'reached') {
        setDoing({ at: 'ready' });
        setAnswer({ kind: 'guarantee', guarantee: guaranteeOf(reach.got, pane) });
        return;
      }
      setDoing(kept);
      setAnswer({ kind: 'missed', missed: reach });
    };
    void onSend(text).then(settle, (error: unknown) => {
      settle(nothingAnswered(error));
    });
  };

  return (
    <View style={look.slab}>
      {answer !== null && <WhatHappened answer={answer} />}

      {doing.at === 'drafting' ? (
        <View style={look.draft}>
          {doing.cutShort !== null && (
            <View style={look.who}>
              <Text style={look.cut}>Cut short</Text>
              <Text style={look.said}>{doing.cutShort}</Text>
            </View>
          )}
          <TextInput
            accessibilityLabel="What to send"
            autoFocus={doing.typing}
            multiline
            style={look.field}
            value={doing.words}
            onChangeText={(words) => {
              setDoing({ ...doing, words });
            }}
          />
          <TheQuickKeys onPress={press} />
          <View style={look.beside}>
            <Pressable
              accessibilityRole="button"
              style={[look.button, look.half, look.discard]}
              onPress={() => {
                setDoing({ at: 'ready' });
                setAnswer(null);
              }}
            >
              <Text style={look.discardText}>Discard</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={[look.button, look.half]}
              onPress={() => {
                send(doing.words, doing.cutShort, doing.typing);
              }}
            >
              <Text style={look.buttonText}>Send</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityLabel="The Slab"
          accessibilityRole="button"
          disabled={doing.at === 'sending'}
          style={[look.bar, doing.at === 'holding' && look.listening]}
          delayLongPress={HOLDING}
          onPress={reveal}
          onLongPress={hold}
          onPressIn={() => {
            spoke.current = false;
          }}
          onPressOut={release}
        >
          <Text style={look.barText}>{BAR[doing.at]}</Text>
          {doing.at === 'holding' && doing.words !== '' && (
            <Text style={look.said}>{doing.words}</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

function TheQuickKeys({
  onPress,
}: {
  readonly onPress: (key: Key, named: string) => void;
}): React.JSX.Element {
  return (
    <View accessibilityLabel="The quick-key bar" style={look.keys}>
      {QUICK_KEYS.map((quick) => (
        <Pressable
          key={quick.key}
          accessibilityLabel={quick.named}
          accessibilityRole="button"
          style={look.key}
          onPress={() => {
            onPress(quick.key, quick.named);
          }}
        >
          <Text style={look.keyText}>{quick.shown}</Text>
        </Pressable>
      ))}
      <View style={look.apart} />
      <Pressable
        accessibilityLabel={THE_STOP.named}
        accessibilityRole="button"
        style={[look.key, look.stop]}
        onPress={() => {
          onPress(THE_STOP.key, THE_STOP.named);
        }}
      >
        <Text style={look.stopText}>{THE_STOP.shown}</Text>
      </Pressable>
    </View>
  );
}

function WhatHappened({ answer }: { readonly answer: Answer }): React.JSX.Element {
  if (answer.kind === 'note') {
    return <Text style={look.said}>{answer.note}</Text>;
  }
  if (answer.kind === 'missed') {
    return (
      <View style={look.card}>
        <Text style={look.heading}>{headingFor(answer.missed)}</Text>
        <Text style={look.said}>{whyOf(answer.missed)}</Text>
      </View>
    );
  }
  return (
    <View style={look.card}>
      <Text style={look.heading}>{answer.guarantee.said}</Text>
      <Text style={look.said}>{answer.guarantee.detail}</Text>
      {answer.guarantee.warning !== null && (
        <Text style={look.warning}>{answer.guarantee.warning}</Text>
      )}
    </View>
  );
}

interface QuickKey {
  readonly key: Key;
  readonly named: string;
  readonly shown: string;
}

const QUICK_KEYS: readonly QuickKey[] = [
  { key: 'up', named: 'Up', shown: '↑' },
  { key: 'down', named: 'Down', shown: '↓' },
  { key: 'enter', named: 'Enter', shown: 'Enter' },
  { key: 'escape', named: 'Escape', shown: 'Esc' },
];

const THE_STOP: QuickKey = { key: 'ctrl-c', named: 'Ctrl-C', shown: 'Ctrl-C' };

const BAR = {
  ready: 'Hold to talk, tap to type',
  holding: 'Listening',
  sending: 'Sending',
} satisfies Record<Exclude<Doing['at'], 'drafting'>, string>;
