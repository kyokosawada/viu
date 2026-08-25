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
  const where = Math.max(0, Math.min(at, draft.words.length));
  const before = draft.words.slice(0, where);
  const after = draft.words.slice(where);
  const attached = [...draft.attached, picture];
  const token = tokenFor(attached.length - 1);
  const opening = before === '' || /\s$/.test(before) ? '' : ' ';
  const closing = after === '' || /^\s/.test(after) ? '' : ' ';
  return { ...draft, words: `${before}${opening}${token}${closing}${after}`, attached };
}

export function reworded(draft: Draft, words: string): Draft {
  const standing = new Set(
    [...words.matchAll(A_TOKEN)].map(([, digits]) => Number(digits) - 1),
  );
  const attached = draft.attached.filter((_picture, at) => standing.has(at));
  return { ...draft, words: renumbered(draft, words, standing), attached };
}

export function removed(draft: Draft, which: number): Draft {
  const token = tokenFor(which);
  const at = draft.words.indexOf(token);
  if (at < 0) return reworded(draft, draft.words);
  const before = draft.words.slice(0, at);
  const after = draft.words.slice(at + token.length);
  if (after.startsWith(' ')) return reworded(draft, before + after.slice(1));
  if (before.endsWith(' ')) return reworded(draft, before.slice(0, -1) + after);
  return reworded(draft, before + after);
}

export function partsOf(draft: Draft): readonly SendPart[] {
  const parts: SendPart[] = [];
  let from = 0;
  for (const match of draft.words.matchAll(A_TOKEN)) {
    const picture = draft.attached[Number(match[1]) - 1];
    if (picture === undefined) continue;
    if (match.index > from) parts.push({ text: draft.words.slice(from, match.index) });
    parts.push({ image: picture });
    from = match.index + match[0].length;
  }
  if (from < draft.words.length) parts.push({ text: draft.words.slice(from) });
  return parts;
}

function renumbered(draft: Draft, words: string, standing: ReadonlySet<number>): string {
  const renumbering = new Map<number, number>();
  for (const [at] of draft.attached.entries()) {
    if (standing.has(at)) renumbering.set(at, renumbering.size);
  }
  return words.replace(A_TOKEN, (whole, digits: string) => {
    const to = renumbering.get(Number(digits) - 1);
    return to === undefined ? whole : tokenFor(to);
  });
}
