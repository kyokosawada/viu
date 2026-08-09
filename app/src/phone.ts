import { AppState } from 'react-native';

export interface Phone {
  inHand(): boolean;
  changes(told: (inHand: boolean) => void): () => void;
}

export const ALWAYS_IN_HAND: Phone = {
  inHand: () => true,
  changes: () => () => undefined,
};

export function thePhone(): Phone {
  return {
    inHand: () => AppState.currentState === 'active',

    changes: (told) => {
      const listening = AppState.addEventListener('change', (state) => {
        told(state === 'active');
      });
      return () => {
        listening.remove();
      };
    },
  };
}
