import type { Image, SendPart } from '@viu/protocol';

export interface Draft {
  readonly words: string;
  readonly cutShort: string | null;
  readonly attached: readonly Image[];
}

export const NOTHING_DRAFTED: Draft = { words: '', cutShort: null, attached: [] };

const A_TOKEN = /\[Image #(\d+)\]/g;

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
      .filter((at) => draft.attached[at] !== undefined),
  );
  const renumbering = new Map<number, number>();
  for (const [at] of draft.attached.entries()) {
    if (standing.has(at)) renumbering.set(at, renumbering.size);
  }
  return {
    ...draft,
    words: retagged(words, (at) => renumbering.get(at) ?? null),
    attached: draft.attached.filter((_picture, at) => standing.has(at)),
  };
}

export function removed(draft: Draft, which: number): Draft {
  return reworded(draft, retagged(draft.words, (at) => (at === which ? null : at)));
}

export function partsOf(draft: Draft): readonly SendPart[] {
  const words = retagged(draft.words, (at) => (draft.attached[at] === undefined ? null : at));
  const parts: SendPart[] = [];
  let from = 0;
  for (const match of words.matchAll(A_TOKEN)) {
    const picture = draft.attached[Number(match[1]) - 1];
    if (picture === undefined) continue;
    if (match.index > from) parts.push({ text: words.slice(from, match.index) });
    parts.push({ image: picture });
    from = match.index + match[0].length;
  }
  if (from < words.length) parts.push({ text: words.slice(from) });
  return parts;
}

function retagged(words: string, to: (which: number) => number | null): string {
  let kept = '';
  let from = 0;
  for (const match of words.matchAll(A_TOKEN)) {
    kept += words.slice(from, match.index);
    from = match.index + match[0].length;
    const renumbered = to(Number(match[1]) - 1);
    if (renumbered !== null) {
      kept += tokenFor(renumbered);
    } else if (words[from] === ' ') {
      from += 1;
    } else if (kept.endsWith(' ')) {
      kept = kept.slice(0, -1);
    }
  }
  return kept + words.slice(from);
}

function wedged(words: string, wedge: string, at: number): string {
  if (wedge === '') return words;
  const where = clearOfATag(words, Math.max(0, Math.min(at, words.length)));
  const before = words.slice(0, where);
  const after = words.slice(where);
  const opening = before === '' || /\s$/.test(before) ? '' : ' ';
  const closing = after === '' || /^\s/.test(after) ? '' : ' ';
  return `${before}${opening}${wedge}${closing}${after}`;
}

function clearOfATag(words: string, at: number): number {
  for (const match of words.matchAll(A_TOKEN)) {
    const ends = match.index + match[0].length;
    if (at > match.index && at < ends) return ends;
  }
  return at;
}
