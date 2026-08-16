import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import type { Image, Key, Pane, Send, Sent } from '@viu/protocol';

import type { Dictation, Held } from '../dictation/dictation';
import type { Missed, Reach } from '../middleman/client';
import { nothingAnswered } from '../middleman/trouble';
import type { From, Picked, Picking } from '../picking/picking';
import { guaranteeOf, type Guarantee } from '../sending';

import { colour, look } from './look';
import { advisedFor, headingFor, whyOf } from './missed';

interface Slabbing {
  readonly pane: Pane | null;
  readonly dictation: Dictation;
  readonly picking: Picking;
  readonly onSend: (sending: Send) => Promise<Reach<Sent>>;
  readonly onKeys: (keys: readonly Key[]) => Promise<Reach<void>>;
}

type Doing =
  | { readonly at: 'ready' }
  | { readonly at: 'holding'; readonly heard: string }
  | { readonly at: 'drafting'; readonly typing: boolean }
  | { readonly at: 'choosing' }
  | { readonly at: 'picking' }
  | { readonly at: 'sending' };

interface Draft {
  readonly words: string;
  readonly cutShort: string | null;
  readonly attached: readonly Image[];
}

type Answer =
  | { readonly kind: 'guarantee'; readonly guarantee: Guarantee }
  | { readonly kind: 'missed'; readonly missed: Missed }
  | { readonly kind: 'note'; readonly note: string };

const NOTHING_HEARD = 'Nothing was heard.';

const NO_IMAGE_PICKED = 'No image was picked.';

const THE_PICKER_BROKE_OFF = 'the picker stopped without saying why';

const ATTACH = 'Attach an image';

const HOLDING = 200;

const NOTHING_DRAFTED: Draft = { words: '', cutShort: null, attached: [] };

const DRAFTING: Doing = { at: 'drafting', typing: false };

export function TheSlab({
  pane,
  dictation,
  picking,
  onSend,
  onKeys,
}: Slabbing): React.JSX.Element {
  const [doing, setDoing] = useState<Doing>({ at: 'ready' });
  const [draft, setDraft] = useState<Draft>(NOTHING_DRAFTED);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const held = useRef<Held | null>(null);
  const spoke = useRef(false);
  const gone = useRef(false);
  const somethingToSend = draft.words.trim() !== '' || draft.attached.length > 0;

  useEffect(() => {
    gone.current = false;
    return () => {
      gone.current = true;
      held.current?.release();
      held.current = null;
    };
  }, []);

  const keepAsDraft = (said: string, why: string | null): void => {
    setDraft((kept) => ({ ...kept, words: said, cutShort: why }));
    setDoing(DRAFTING);
  };

  const backToTheDraft = (): void => {
    setDoing(somethingToSend ? DRAFTING : { at: 'ready' });
  };

  const hold = () => {
    spoke.current = true;
    setAnswer(null);
    setDoing({ at: 'holding', heard: '' });
    const holding = dictation.hold((heard) => {
      if (gone.current) return;
      if (heard.kind === 'hearing') {
        setDoing({ at: 'holding', heard: heard.words });
        return;
      }
      held.current = null;
      if (heard.kind === 'cut-short') {
        keepAsDraft(heard.words, heard.why);
      } else if (heard.words.trim() === '') {
        setDoing({ at: 'ready' });
        setAnswer({ kind: 'note', note: NOTHING_HEARD });
      } else {
        keepAsDraft(heard.words, null);
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
    setDoing({ at: 'drafting', typing: true });
  };

  const discard = () => {
    setDraft(NOTHING_DRAFTED);
    setDoing({ at: 'ready' });
    setAnswer(null);
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

  const send = () => {
    if (!somethingToSend) return;
    setDoing({ at: 'sending' });
    setAnswer(null);
    const settle = (reach: Reach<Sent>) => {
      if (gone.current) return;
      if (reach.kind === 'reached') {
        setDraft(NOTHING_DRAFTED);
        setDoing({ at: 'ready' });
        setAnswer({ kind: 'guarantee', guarantee: guaranteeOf(reach.got, pane) });
        return;
      }
      setDoing(DRAFTING);
      setAnswer({ kind: 'missed', missed: reach });
    };
    void onSend({ text: draft.words, images: draft.attached }).then(settle, (error: unknown) => {
      settle(nothingAnswered(error));
    });
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
        setDraft((kept) => ({ ...kept, attached: [...kept.attached, picked.picture] }));
        setDoing(DRAFTING);
        return;
      }
      backToTheDraft();
      setAnswer({ kind: 'note', note: picked.kind === 'nothing' ? NO_IMAGE_PICKED : picked.why });
    };
    void picking.pick(from).then(settle, () => {
      settle({ kind: 'cut-short', why: THE_PICKER_BROKE_OFF });
    });
  };

  const remove = (which: number) => {
    setDraft((kept) => ({
      ...kept,
      attached: kept.attached.filter((_image, at) => at !== which),
    }));
  };

  const attaching = pane?.agent != null;

  return (
    <View style={look.slab}>
      {answer !== null && <WhatHappened answer={answer} />}

      {doing.at === 'drafting' ? (
        <View style={look.draft}>
          {draft.cutShort !== null && (
            <View style={look.who}>
              <Text style={look.cut}>Cut short</Text>
              <Text style={look.said}>{draft.cutShort}</Text>
            </View>
          )}
          <TextInput
            accessibilityLabel="What to send"
            autoFocus={doing.typing}
            multiline
            placeholder={draft.attached.length === 0 ? undefined : 'Say what the images are for'}
            placeholderTextColor={colour.faded}
            style={look.field}
            value={draft.words}
            onChangeText={(words) => {
              setDraft((kept) => ({ ...kept, words }));
            }}
          />
          <WhatIsAttached attached={draft.attached} onRemove={remove} />
          <TheQuickKeys onPress={press} />
          {attaching && (
            <Pressable accessibilityRole="button" style={look.attach} onPress={choose}>
              <Text style={look.attachText}>{ATTACH}</Text>
            </Pressable>
          )}
          <View style={look.beside}>
            <Pressable
              accessibilityRole="button"
              style={[look.button, look.half, look.discard]}
              onPress={discard}
            >
              <Text style={look.discardText}>Discard</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={[look.button, look.half]}
              onPress={send}
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
            onPress={backToTheDraft}
          >
            <Text style={look.discardText}>Never mind</Text>
          </Pressable>
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
            {doing.at === 'holding' && doing.heard !== '' && (
              <Text style={look.said}>{doing.heard}</Text>
            )}
          </Pressable>
          {doing.at === 'ready' && attaching && (
            <Pressable accessibilityRole="button" style={look.attach} onPress={choose}>
              <Text style={look.attachText}>{ATTACH}</Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}

function WhatIsAttached({
  attached,
  onRemove,
}: {
  readonly attached: readonly Image[];
  readonly onRemove: (which: number) => void;
}): React.JSX.Element | null {
  if (attached.length === 0) return null;
  return (
    <View accessibilityLabel="What is attached" style={look.attached}>
      {attached.map((image, at) => (
        <Pressable
          key={`${at}-${image.base64.slice(0, 16)}`}
          accessibilityLabel={`Remove image ${at + 1}`}
          accessibilityRole="button"
          style={look.tag}
          onPress={() => {
            onRemove(at);
          }}
        >
          <Text style={look.tagText}>{`[Image #${at + 1}]`}</Text>
          <Text style={look.tagDrop}>✕</Text>
        </Pressable>
      ))}
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
} satisfies Record<Exclude<Doing['at'], 'drafting' | 'choosing'>, string>;
