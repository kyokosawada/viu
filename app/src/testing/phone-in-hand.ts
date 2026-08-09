import type { Phone } from '../phone';

export interface FakePhone extends Phone {
  isPutAway(): void;
  isPickedUp(): void;
}

export function phoneInHand(): FakePhone {
  let held = true;
  const listeners = new Set<(inHand: boolean) => void>();

  const becomes = (nowHeld: boolean): void => {
    if (held === nowHeld) return;
    held = nowHeld;
    for (const told of listeners) told(nowHeld);
  };

  return {
    inHand: () => held,

    changes: (told) => {
      listeners.add(told);
      return () => {
        listeners.delete(told);
      };
    },

    isPutAway: () => {
      becomes(false);
    },

    isPickedUp: () => {
      becomes(true);
    },
  };
}
