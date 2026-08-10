import { useEffect, useMemo, useRef, useState } from 'react';
import { Image as Photo, Pressable, Text, TextInput, View } from 'react-native';

import type { Image, Key, Pane, Sent } from '@viu/protocol';

import type { Dictation, Held } from '../dictation/dictation';
import type { Missed, Reach } from '../middleman/client';
import { nothingAnswered } from '../middleman/trouble';
import type { From, Picked, Picking, Picture } from '../picking/picking';
import { guaranteeOf, type Guarantee } from '../sending';

import { colour, look } from './look';
import { advisedFor, headingFor, whyOf } from './missed';

interface Slabbing {
  readonly pane: Pane | null;
  readonly dictation: Dictation;
  readonly picking: Picking;
  readonly onSend: (text: string) => Promise<Reach<Sent>>;
  readonly onSendImage: (image: Image) => Promise<Reach<Sent>>;
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
  | { readonly at: 'choosing' }
  | { readonly at: 'picking' }
  | { readonly at: 'captioning'; readonly picture: Picture; readonly caption: string }
  | { readonly at: 'sending' };

type Answer =
  | { readonly kind: 'guarantee'; readonly guarantee: Guarantee }
  | { readonly kind: 'missed'; readonly missed: Missed }
  | { readonly kind: 'note'; readonly note: string };

const NOTHING_HEARD = 'Nothing was heard.';

const NO_IMAGE_PICKED = 'No image was picked.';

const THE_PICKER_BROKE_OFF = 'the picker stopped without saying why';

const HOLDING = 200;

export function TheSlab({
  pane,
  dictation,
  picking,
  onSend,
  onSendImage,
  onKeys,
}: Slabbing): React.JSX.Element {
  const [doing, setDoing] = useState<Doing>({ at: 'ready' });
  const [answer, setAnswer] = useState<Answer | null>(null);
  const held = useRef<Held | null>(null);
  const spoke = useRef(false);
  const gone = useRef(false);
  const picture = doing.at === 'captioning' ? doing.picture : null;
  const shown = useMemo(
    () =>
      picture === null ? null : { uri: `data:image/${picture.format};base64,${picture.base64}` },
    [picture],
  );

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

  const sending = (asked: Promise<Reach<Sent>>, kept: Doing) => {
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
    void asked.then(settle, (error: unknown) => {
      settle(nothingAnswered(error));
    });
  };

  const send = (text: string, cutShort: string | null, typing: boolean) => {
    if (text.trim() === '') return;
    sending(onSend(text), { at: 'drafting', words: text, cutShort, typing });
  };

  const sendPicture = (picture: Picture, caption: string) => {
    const said = caption.trim();
    const image: Image = { ...picture, caption: said === '' ? null : said };
    sending(onSendImage(image), { at: 'captioning', picture, caption });
  };

  const choose = () => {
    setAnswer(null);
    setDoing({ at: 'choosing' });
  };

  const pick = (from: From) => {
    setAnswer(null);
    setDoing({ at: 'picking' });
    const settle = (picked: Picked) => {
      if (gone.current) return;
      if (picked.kind === 'picked') {
        setDoing({ at: 'captioning', picture: picked.picture, caption: '' });
        return;
      }
      setDoing({ at: 'ready' });
      setAnswer({ kind: 'note', note: picked.kind === 'nothing' ? NO_IMAGE_PICKED : picked.why });
    };
    void picking.pick(from).then(settle, () => {
      settle({ kind: 'cut-short', why: THE_PICKER_BROKE_OFF });
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
      ) : doing.at === 'choosing' ? (
        <View accessibilityLabel="Where to take the image from" style={look.draft}>
          <View style={look.beside}>
            <Pressable
              accessibilityRole="button"
              style={[look.button, look.half]}
              onPress={() => {
                pick('library');
              }}
            >
              <Text style={look.buttonText}>Photo library</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={[look.button, look.half]}
              onPress={() => {
                pick('camera');
              }}
            >
              <Text style={look.buttonText}>Camera</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            style={[look.button, look.discard]}
            onPress={() => {
              setDoing({ at: 'ready' });
            }}
          >
            <Text style={look.discardText}>Never mind</Text>
          </Pressable>
        </View>
      ) : doing.at === 'captioning' ? (
        <View style={look.draft}>
          <Photo
            accessibilityLabel="The image to send"
            resizeMode="contain"
            source={shown ?? undefined}
            style={look.picture}
          />
          <TextInput
            accessibilityLabel="What to say about the image"
            multiline
            placeholder="Say what it is for, or send it on its own"
            placeholderTextColor={colour.faded}
            style={look.field}
            value={doing.caption}
            onChangeText={(caption) => {
              setDoing({ ...doing, caption });
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
                sendPicture(doing.picture, doing.caption);
              }}
            >
              <Text style={look.buttonText}>Send the image</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <Pressable
            accessibilityLabel="The Slab"
            accessibilityRole="button"
            disabled={doing.at === 'sending' || doing.at === 'picking'}
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
          {doing.at === 'ready' && pane?.agent != null && (
            <Pressable accessibilityRole="button" style={look.attach} onPress={choose}>
              <Text style={look.attachText}>Send an image</Text>
            </Pressable>
          )}
        </>
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
        <Text style={look.advice}>{advisedFor(answer.missed)}</Text>
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
  picking: 'Picking an image',
  sending: 'Sending',
} satisfies Record<Exclude<Doing['at'], 'drafting' | 'choosing' | 'captioning'>, string>;
