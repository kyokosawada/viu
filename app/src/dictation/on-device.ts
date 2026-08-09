import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

import type { Dictation, Heard, Held } from './dictation';

const EN_US = 'en-US';

const NOTHING_TO_SAY = ['no-speech', 'aborted'];

const NOT_ALLOWED = 'Viu was not allowed to listen';

const NOT_ON_THIS_PHONE = 'this phone has no on-device dictation';

const STOPPED_LISTENING = 'the phone stopped listening';

export function onDeviceDictation(): Dictation {
  return {
    hold(hearing: (heard: Heard) => void): Held {
      let words = '';
      let over = false;

      const listeners = [
        ExpoSpeechRecognitionModule.addListener('result', (event) => {
          words = event.results[0]?.transcript ?? words;
          if (event.isFinal) settle({ kind: 'heard', words });
          else if (!over) hearing({ kind: 'hearing', words });
        }),
        ExpoSpeechRecognitionModule.addListener('error', (event) => {
          settle(
            NOTHING_TO_SAY.includes(event.error)
              ? { kind: 'heard', words }
              : { kind: 'cut-short', words, why: event.message },
          );
        }),
        ExpoSpeechRecognitionModule.addListener('end', () => {
          settle({ kind: 'heard', words });
        }),
      ];

      function settle(heard: Heard): void {
        if (over) return;
        over = true;
        for (const listener of listeners) listener.remove();
        hearing(heard);
      }

      function cutShort(why: string): void {
        settle({ kind: 'cut-short', words, why });
      }

      const listening = startListening().then((started) => {
        if (started.listening) return !over;
        cutShort(started.why);
        return false;
      }, whatStopped);

      return {
        release: () => {
          void listening.then((started) => {
            if (started) ExpoSpeechRecognitionModule.stop();
          }, whatStopped);
        },
      };

      function whatStopped(error: unknown): false {
        cutShort(error instanceof Error ? error.message : STOPPED_LISTENING);
        return false;
      }
    },
  };
}

type Listening = { readonly listening: true } | { readonly listening: false; readonly why: string };

async function startListening(): Promise<Listening> {
  if (!ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) {
    return { listening: false, why: NOT_ON_THIS_PHONE };
  }
  const asked = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  if (!asked.granted) return { listening: false, why: NOT_ALLOWED };

  ExpoSpeechRecognitionModule.start({
    lang: EN_US,
    interimResults: true,
    continuous: false,
    requiresOnDeviceRecognition: true,
  });
  return { listening: true };
}
