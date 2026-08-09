export type Heard =
  | { readonly kind: 'hearing'; readonly words: string }
  | { readonly kind: 'heard'; readonly words: string }
  | { readonly kind: 'cut-short'; readonly words: string; readonly why: string };

export interface Held {
  release(): void;
}

export interface Dictation {
  hold(hearing: (heard: Heard) => void): Held;
}

const NOTHING_TO_DICTATE_WITH = 'this phone has nothing to dictate with';

export function noDictation(): Dictation {
  return {
    hold(hearing) {
      hearing({ kind: 'cut-short', words: '', why: NOTHING_TO_DICTATE_WITH });
      return { release: () => undefined };
    },
  };
}
