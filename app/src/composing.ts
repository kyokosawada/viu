import type { Image, SendPart } from '@viu/protocol';

export interface Draft {
  readonly words: string;
  readonly cutShort: string | null;
  readonly attached: readonly Image[];
}

export const NOTHING_DRAFTED: Draft = { words: '', cutShort: null, attached: [] };

const A_TOKEN = /\[Image #(\d+)\]/g;

type Piece<T> = { readonly text: string } | { readonly stands: T };

export function tokenFor(which: number): string {
  return `[Image #${which + 1}]`;
}

export function placed(draft: Draft, picture: Image, at: number): Draft {
  const attached = [...draft.attached, picture];
  return { ...draft, words: wedged(draft.words, tokenFor(attached.length - 1), at), attached };
}

export function spoken(draft: Draft, said: string, at: number): Draft {
  return reworded(draft, wedged(draft.words, said, at));
}

export function reworded(draft: Draft, words: string): Draft {
  const standing = new Set(
    [...words.matchAll(A_TOKEN)]
      .map(([, digits]) => Number(digits) - 1)
      .filter((which) => draft.attached[which] !== undefined),
  );
  const renumbering = new Map<number, number>();
  for (const [which] of draft.attached.entries()) {
    if (standing.has(which)) renumbering.set(which, renumbering.size);
  }
  return {
    ...draft,
    words: rewritten(words, (which) => renumbering.get(which) ?? null),
    attached: draft.attached.filter((_picture, which) => standing.has(which)),
  };
}

export function removed(draft: Draft, which: number): Draft {
  return reworded(
    draft,
    rewritten(draft.words, (standing) => (standing === which ? null : standing)),
  );
}

export function partsOf(draft: Draft): readonly SendPart[] {
  return pieced(draft.words, (which) => draft.attached[which] ?? null).map((piece) =>
    'text' in piece ? { text: piece.text } : { image: piece.stands },
  );
}

function pieced<T>(words: string, standingFor: (which: number) => T | null): readonly Piece<T>[] {
  const pieces: Piece<T>[] = [];
  let text = '';
  let from = 0;
  for (const match of words.matchAll(A_TOKEN)) {
    text += words.slice(from, match.index);
    from = match.index + match[0].length;
    const stands = standingFor(Number(match[1]) - 1);
    if (stands === null) {
      const after = words.slice(from);
      if (after.startsWith(' ')) from += 1;
      else if (text.endsWith(' ')) text = text.slice(0, -1);
      else if (wouldRunTogether(text, after)) text += ' ';
      continue;
    }
    if (text !== '') pieces.push({ text });
    text = '';
    pieces.push({ stands });
  }
  text += words.slice(from);
  if (text !== '') pieces.push({ text });
  return pieces;
}

function wouldRunTogether(text: string, after: string): boolean {
  return text !== '' && after !== '' && !/\s$/.test(text) && !/^\s/.test(after);
}

function rewritten(words: string, renumbering: (which: number) => number | null): string {
  return pieced(words, renumbering)
    .map((piece) => ('text' in piece ? piece.text : tokenFor(piece.stands)))
    .join('');
}

function wedged(words: string, wedge: string, at: number): string {
  if (wedge === '') return words;
  const where = clearOfAToken(words, Math.max(0, Math.min(at, words.length)));
  const before = words.slice(0, where);
  const after = words.slice(where);
  const opening = before === '' || /\s$/.test(before) ? '' : ' ';
  const closing = after === '' || /^\s/.test(after) ? '' : ' ';
  return `${before}${opening}${wedge}${closing}${after}`;
}

function clearOfAToken(words: string, at: number): number {
  for (const match of words.matchAll(A_TOKEN)) {
    const ends = match.index + match[0].length;
    if (at > match.index && at < ends) return ends;
  }
  return at;
}
