import type { Dictation, Heard, Held } from '../dictation/dictation';

export interface FakeDictation {
  readonly engine: Dictation;
  hears(words: string): void;
  settlesOn(words: string): void;
  settles(): void;
  breaksOff(why: string): void;
  beingHeld(): boolean;
}

export function createFakeDictation(): FakeDictation {
  let hearing: ((heard: Heard) => void) | null = null;
  let words = '';
  let settled: string | null = null;

  const say = (heard: Heard): void => {
    const told = hearing;
    if (told === null) return;
    if (heard.kind !== 'hearing') hearing = null;
    told(heard);
  };

  const engine: Dictation = {
    hold(listening: (heard: Heard) => void): Held {
      words = '';
      settled = null;
      hearing = listening;
      return {
        release: () => {
          say({ kind: 'heard', words: settled ?? words });
        },
      };
    },
  };

  return {
    engine,

    hears(said: string): void {
      words = said;
      say({ kind: 'hearing', words });
    },

    settlesOn(said: string): void {
      settled = said;
    },

    settles(): void {
      say({ kind: 'heard', words: settled ?? words });
    },

    breaksOff(why: string): void {
      say({ kind: 'cut-short', words, why });
    },

    beingHeld(): boolean {
      return hearing !== null;
    },
  };
}
