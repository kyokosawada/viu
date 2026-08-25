import type { Turn, TurnRole } from '@viu/protocol';

import type { Screenful } from './screenful.js';
import { screenRows, type ScreenRow } from './terminal.js';

type Grammar = (screen: readonly ScreenRow[], moreAbove: boolean) => readonly Turn[];

interface Draft {
  readonly role: TurnRole;
  readonly cut: boolean;
  readonly rows: string[];
}

interface PaintedRun {
  readonly from: number;
  readonly through: number;
}

const OPENING = /^[\u{25cf}\u{23fa}]\s+/u;

const GRAMMARS: Readonly<Record<string, Grammar>> = {
  claude: claudeTurns,
  pi: piTurns,
};

const RULE = /\u{2500}{12,}/u;
const BOX_CORNER =
  /[\u{2502}\u{250c}\u{2510}\u{2514}\u{2518}\u{251c}\u{2524}\u{252c}\u{2534}\u{253c}\u{256d}-\u{2570}]/u;
const PROMPT = /^\s*\u{276f}/u;
const WAITING_ON_YOU =
  /(enter to select|enter to confirm|esc to cancel|do you want to proceed\?|to navigate)/iu;
const STATUS_GLYPH = /^[^\p{L}\p{N}\s]\s/u;
const STATUS_TAIL = /\u{2026}|\bfor \d|\(\d+[hms]/u;
const PI_SPINNER = /^\s*[\u{2800}-\u{28ff}]\s+\S/u;
const PI_STATUS = /(\d+\.\d+%|\?)\/[\d.]+[kM]?/u;
const PI_ASKING =
  /(enter (select|confirm|submit|toggle)|esc(ape)?(\/ctrl\+c)? (cancel|dismiss)|\u{2191}\u{2193} navigate)/iu;

export function turnsOf(screenful: Screenful): readonly Turn[] {
  const screen = screenRows(screenful.screen);
  const grammar = grammarFor(screenful.agent);
  if (grammar === null) return [rawTurn(screen, screenful.moreAbove)];
  return grammar(screen, screenful.moreAbove);
}

function grammarFor(agent: string | null): Grammar | null {
  if (agent === null) return null;
  return GRAMMARS[agent.toLowerCase()] ?? null;
}

function rawTurn(screen: readonly ScreenRow[], moreAbove: boolean): Turn {
  return { role: 'pane', text: paragraphs(screen.map((row) => row.text)), cut: moreAbove };
}

function claudeTurns(screen: readonly ScreenRow[], moreAbove: boolean): readonly Turn[] {
  const rows = withoutChrome(screen);
  const painted = new Map(paintedRuns(rows).map((run) => [run.from, run]));
  const drafts: Draft[] = [];
  let at = 0;

  while (at < rows.length) {
    const person = painted.get(at);
    if (person !== undefined) {
      drafts.push({ role: 'person', cut: at === 0, rows: rowsOf(rows, person) });
      at = person.through + 1;
      continue;
    }

    const text = rows[at]?.text ?? '';
    const opening = OPENING.exec(text);
    if (opening !== null) {
      drafts.push({ role: 'agent', cut: false, rows: [text.slice(opening[0].length)] });
    } else if (drafts.length > 0) {
      drafts.at(-1)?.rows.push(unindented(text));
    } else if (text !== '') {
      drafts.push({ role: 'agent', cut: true, rows: [unindented(text)] });
    }
    at += 1;
  }

  const turns = drafts
    .map((draft) => ({ role: draft.role, text: paragraphs(draft.rows), cut: draft.cut }))
    .filter((turn) => turn.text !== '');

  if (!moreAbove) return turns;
  return turns.map((turn, at) => (at === 0 ? { ...turn, cut: true } : turn));
}

function piTurns(screen: readonly ScreenRow[], moreAbove: boolean): readonly Turn[] {
  const rows = withoutPiChrome(screen);
  const painted = new Map(paintedRuns(rows).map((run) => [run.from, run]));
  const drafts: Draft[] = [];
  let at = 0;

  while (at < rows.length) {
    const block = painted.get(at);
    if (block !== undefined) {
      const lines = piRowsOf(rows, block);
      if (isPiToolActivity(rows, block)) piAgentDraft(drafts).rows.push(...lines);
      else drafts.push({ role: 'person', cut: piCutsInto(rows, at), rows: lines });
      at = block.through + 1;
      continue;
    }

    piAgentDraft(drafts).rows.push(withoutPiIndent(rows[at]?.text ?? ''));
    at += 1;
  }

  const turns = drafts
    .map((draft) => ({ role: draft.role, text: paragraphs(draft.rows), cut: draft.cut }))
    .filter((turn) => turn.text !== '');

  if (!moreAbove) return turns;
  return turns.map((turn, at) => (at === 0 ? { ...turn, cut: true } : turn));
}

function piCutsInto(rows: readonly ScreenRow[], at: number): boolean {
  return at === 0 && (rows[at]?.text ?? '') !== '';
}

function piAgentDraft(drafts: Draft[]): Draft {
  const last = drafts.at(-1);
  if (last?.role === 'agent') return last;
  const opened: Draft = { role: 'agent', cut: drafts.length === 0, rows: [] };
  drafts.push(opened);
  return opened;
}

function isPiToolActivity(rows: readonly ScreenRow[], run: PaintedRun): boolean {
  for (let at = run.from; at <= run.through; at += 1) {
    const row = rows[at];
    if (row === undefined || row.text === '') continue;
    return row.opensBold;
  }
  return false;
}

function piRowsOf(rows: readonly ScreenRow[], run: PaintedRun): string[] {
  return rows.slice(run.from, run.through + 1).map((row) => withoutPiIndent(row.text));
}

function withoutPiChrome(rows: readonly ScreenRow[]): readonly ScreenRow[] {
  const body = withoutPiStatus(rows);
  const closes = piInputAreaCloses(body);
  if (closes === null) return withoutPiSpinner(body);

  const opens = lastRuleIn(body, closes);
  if (opens === null) return withoutPiSpinner(body.slice(0, closes));

  const inside = body.slice(opens + 1, closes);
  const transcript = withoutPiSpinner(body.slice(0, opens));
  if (inside.some((row) => PI_ASKING.test(row.text))) return [...transcript, ...inside];
  return transcript;
}

function piInputAreaCloses(rows: readonly ScreenRow[]): number | null {
  const at = lastRuleIn(rows, rows.length);
  if (at === null || nonBlank(rows.slice(at + 1)).length > 0) return null;
  return at;
}

function withoutPiStatus(rows: readonly ScreenRow[]): readonly ScreenRow[] {
  const last = lastNonBlankIn(rows);
  if (last === null || !PI_STATUS.test(rows[last]?.text ?? '')) return rows;
  const above = rows[last - 1]?.text ?? '';
  return rows.slice(0, above !== '' && !isRule(above) ? last - 1 : last);
}

function withoutPiSpinner(rows: readonly ScreenRow[]): readonly ScreenRow[] {
  const last = lastNonBlankIn(rows);
  if (last === null || !PI_SPINNER.test(rows[last]?.text ?? '')) return rows;
  return rows.slice(0, last);
}

function withoutPiIndent(text: string): string {
  return text.startsWith(' ') ? text.slice(1) : text;
}

function paintedRuns(rows: readonly ScreenRow[]): readonly PaintedRun[] {
  const runs: PaintedRun[] = [];
  let at = 0;

  while (at < rows.length) {
    if (rows[at]?.painted !== true) {
      at += 1;
      continue;
    }

    let through = at;
    while (rows[through + 1]?.painted === true) through += 1;
    if (isBlankOrEdge(rows, at - 1) && isBlankOrEdge(rows, through + 1)) {
      runs.push({ from: at, through });
    }
    at = through + 1;
  }

  return runs;
}

function isBlankOrEdge(rows: readonly ScreenRow[], at: number): boolean {
  return at < 0 || at >= rows.length || (rows[at]?.text ?? '') === '';
}

function rowsOf(rows: readonly ScreenRow[], run: PaintedRun): string[] {
  return rows.slice(run.from, run.through + 1).map((row) => unindented(row.text));
}

function withoutChrome(rows: readonly ScreenRow[]): readonly ScreenRow[] {
  const box = promptBoxAt(rows);
  return withoutStatus(box === null ? rows : rows.slice(0, box));
}

function promptBoxAt(rows: readonly ScreenRow[]): number | null {
  const closes = lastRuleIn(rows, rows.length);
  if (closes === null) return null;
  const opens = lastRuleIn(rows, closes);
  if (opens === null) return null;

  const inside = nonBlank(rows.slice(opens + 1, closes));
  const below = nonBlank(rows.slice(closes + 1));
  if (!inside.some((text) => PROMPT.test(text))) return null;
  if ([...inside, ...below].some((text) => WAITING_ON_YOU.test(text))) return null;
  return opens;
}

function lastRuleIn(rows: readonly ScreenRow[], before: number): number | null {
  for (let at = before - 1; at >= 0; at -= 1) {
    if (isRule(rows[at]?.text ?? '')) return at;
  }
  return null;
}

function isRule(text: string): boolean {
  return RULE.test(text) && !BOX_CORNER.test(text);
}

function withoutStatus(rows: readonly ScreenRow[]): readonly ScreenRow[] {
  const last = lastNonBlankIn(rows);
  if (last === null || !isStatus(rows[last]?.text ?? '')) return rows;
  return rows.slice(0, last);
}

function lastNonBlankIn(rows: readonly ScreenRow[]): number | null {
  for (let at = rows.length - 1; at >= 0; at -= 1) {
    if ((rows[at]?.text ?? '') !== '') return at;
  }
  return null;
}

function isStatus(text: string): boolean {
  return !OPENING.test(text) && STATUS_GLYPH.test(text) && STATUS_TAIL.test(text);
}

function nonBlank(rows: readonly ScreenRow[]): readonly string[] {
  return rows.map((row) => row.text).filter((text) => text !== '');
}

function unindented(text: string): string {
  return text.startsWith('  ') ? text.slice(2) : text;
}

function paragraphs(rows: readonly string[]): string {
  return rows.join('\n').replace(/\n{3,}/gu, '\n\n').trim();
}
