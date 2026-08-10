import type { From, Picked, Picking, Picture } from '../picking/picking';

export interface FakePicking {
  readonly picker: Picking;
  picks(picture: Picture): void;
  picksNothing(): void;
  breaksOff(why: string): void;
  failsToAnswerAtAll(why: string): void;
  whatWasPickedFrom(): readonly From[];
}

export function createFakePicking(): FakePicking {
  let answer: Picked = { kind: 'nothing' };
  let breaks: string | null = null;
  const from: From[] = [];

  const picker: Picking = {
    pick: (asked: From) => {
      from.push(asked);
      if (breaks !== null) return Promise.reject(new Error(breaks));
      return Promise.resolve(answer);
    },
  };

  return {
    picker,

    picks(picture: Picture): void {
      answer = { kind: 'picked', picture };
    },

    picksNothing(): void {
      answer = { kind: 'nothing' };
    },

    breaksOff(why: string): void {
      answer = { kind: 'cut-short', why };
    },

    failsToAnswerAtAll(why: string): void {
      breaks = why;
    },

    whatWasPickedFrom(): readonly From[] {
      return from;
    },
  };
}
