import type { Image } from '@viu/protocol';

import {
  NOTHING_DRAFTED,
  partsOf,
  placed,
  removed,
  reworded,
  spoken,
  type Draft,
} from './composing';

const A_PICTURE: Image = { format: 'jpeg', base64: 'AAAABBBB' };

const ANOTHER_PICTURE: Image = { format: 'png', base64: 'CCCCDDDD' };

const A_THIRD_PICTURE: Image = { format: 'jpeg', base64: 'EEEEFFFF' };

function drafted(words: string, attached: readonly Image[]): Draft {
  return { ...NOTHING_DRAFTED, words, attached };
}

function everyTagStands(draft: Draft): boolean {
  return [...draft.words.matchAll(/\[Image #(\d+)\]/g)].every(
    ([, digits]) => draft.attached[Number(digits) - 1] !== undefined,
  );
}

describe('a tag that stands for no attached image', () => {
  test('never leaves the phone as words of its own', () => {
    const draft = drafted('[Image #31] [Image #1] this is a test', [A_PICTURE]);

    expect(partsOf(draft)).toEqual([{ image: A_PICTURE }, { text: ' this is a test' }]);
  });

  test('is gone from the words as soon as they are read again', () => {
    const draft = reworded(drafted('[Image #1] look', [A_PICTURE]), '[Image #31] [Image #1] look');

    expect(draft.words).toBe('[Image #1] look');
    expect(draft.attached).toEqual([A_PICTURE]);
  });

  test('leaves nothing behind when it stood alone in the words', () => {
    const draft = reworded(drafted('', []), '[Image #2]');

    expect(draft.words).toBe('');
    expect(partsOf(draft)).toEqual([]);
  });
});

describe('the words and the images they name', () => {
  test('keep every tag answerable through attaching, dictating, typing and removing', () => {
    let draft = placed(NOTHING_DRAFTED, A_PICTURE, 0);
    draft = spoken(draft, 'look at this', 0);
    draft = placed(draft, ANOTHER_PICTURE, draft.words.length);
    draft = placed(draft, A_THIRD_PICTURE, draft.words.length);
    draft = removed(draft, 1);
    draft = reworded(draft, `${draft.words} and this`);

    expect(everyTagStands(draft)).toBe(true);
    expect(partsOf(draft)).toEqual([
      { text: 'look at this ' },
      { image: A_PICTURE },
      { text: ' ' },
      { image: A_THIRD_PICTURE },
      { text: ' and this' },
    ]);
  });

  test('drop the tag of an image the owner rubbed out, and renumber the rest', () => {
    const draft = reworded(
      drafted('[Image #1] [Image #2] [Image #3]', [A_PICTURE, ANOTHER_PICTURE, A_THIRD_PICTURE]),
      '[Image #1] [Image #3]',
    );

    expect(draft.words).toBe('[Image #1] [Image #2]');
    expect(draft.attached).toEqual([A_PICTURE, A_THIRD_PICTURE]);
    expect(everyTagStands(draft)).toBe(true);
  });

  test('survive words that were typed against a draft an image older', () => {
    const older = drafted('[Image #1] [Image #2] [Image #3] hi', [
      A_PICTURE,
      ANOTHER_PICTURE,
      A_THIRD_PICTURE,
    ]);
    const now = removed(older, 0);

    const draft = reworded(now, `${older.words}!`);

    expect(everyTagStands(draft)).toBe(true);
    expect(partsOf(draft)).toEqual([
      { image: ANOTHER_PICTURE },
      { text: ' ' },
      { image: A_THIRD_PICTURE },
      { text: ' hi!' },
    ]);
  });
});

describe('placing something where the owner is composing', () => {
  test('does not split a tag the caret is sitting inside', () => {
    const standing = placed(reworded(NOTHING_DRAFTED, 'look at this here'), A_PICTURE, 12);

    const draft = placed(standing, ANOTHER_PICTURE, standing.words.indexOf('#1'));

    expect(everyTagStands(draft)).toBe(true);
    expect(partsOf(draft)).toEqual([
      { text: 'look at this ' },
      { image: A_PICTURE },
      { text: ' ' },
      { image: ANOTHER_PICTURE },
      { text: ' here' },
    ]);
  });

  test('does not split a tag the dictated words land inside', () => {
    const standing = placed(reworded(NOTHING_DRAFTED, 'look at this'), A_PICTURE, 12);

    const draft = spoken(standing, 'and this', standing.words.indexOf('#1'));

    expect(everyTagStands(draft)).toBe(true);
    expect(partsOf(draft)).toEqual([
      { text: 'look at this ' },
      { image: A_PICTURE },
      { text: ' and this' },
    ]);
  });
});
