import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import type { Pane, Sent } from '@viu/protocol';

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
}

type Doing =
  | { readonly at: 'ready' }
  | { readonly at: 'holding'; readonly words: string }
  | { readonly at: 'drafting'; readonly words: string; readonly cutShort: string | null }
  | { readonly at: 'sending' };

type Answer =
  | { readonly kind: 'guarantee'; readonly guarantee: Guarantee }
  | { readonly kind: 'missed'; readonly missed: Missed }
  | { readonly kind: 'note'; readonly note: string };

const NOTHING_HEARD = 'Nothing was heard.';

export function TheSlab({ pane, dictation, onSend }: Slabbing): React.JSX.Element {
  const [doing, setDoing] = useState<Doing>({ at: 'ready' });
  const [answer, setAnswer] = useState<Answer | null>(null);
  const held = useRef<Held | null>(null);
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
        setDoing({ at: 'drafting', words: heard.words, cutShort: heard.why });
      } else if (heard.words.trim() === '') {
        setDoing({ at: 'ready' });
        setAnswer({ kind: 'note', note: NOTHING_HEARD });
      } else {
        setDoing({ at: 'drafting', words: heard.words, cutShort: null });
      }
    });
    held.current = holding;
  };

  const release = () => {
    const holding = held.current;
    held.current = null;
    holding?.release();
  };

  const send = (text: string, cutShort: string | null) => {
    if (text.trim() === '') return;
    const kept: Doing = { at: 'drafting', words: text, cutShort };
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
            multiline
            style={look.field}
            value={doing.words}
            onChangeText={(words) => {
              setDoing({ ...doing, words });
            }}
          />
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
                send(doing.words, doing.cutShort);
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
          onPressIn={hold}
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

const BAR = {
  ready: 'Hold to talk',
  holding: 'Listening',
  sending: 'Sending',
} satisfies Record<Exclude<Doing['at'], 'drafting'>, string>;
