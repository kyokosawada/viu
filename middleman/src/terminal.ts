export interface ScreenRow {
  readonly text: string;
  readonly painted: boolean;
  readonly opensBold: boolean;
}

interface Run {
  readonly text: string;
  readonly painted: boolean;
  readonly bold: boolean;
}

interface Ink {
  readonly painted: boolean;
  readonly bold: boolean;
}

const COLOUR = /\x1b\[([0-9;]*)m/g;
const WINDOW_TITLE = /\x1b\][\s\S]*?(?:\x07|\x1b\\)/g;
const CURSOR_AND_ERASE = /\x1b\[[0-?]*[ -/]*[@-~]/g;
const OTHER_ESCAPE = /\x1b[\s\S]?/g;
const ICON_GLYPH = /[\u{e000}-\u{f8ff}]/gu;
const HARD_SPACE = /[\u{a0}\u{2007}\u{202f}]/gu;
const CONTROL = /[\x00-\x08\x0b-\x1f\x7f]/g;

export function screenRows(screen: string): readonly ScreenRow[] {
  return screen.split(/\r?\n/).map(readRow);
}

function readRow(row: string): ScreenRow {
  const runs = runsOf(row);
  return {
    text: legible(runs.map((run) => run.text).join('')),
    painted: runs.some((run) => run.painted) && runs.every(isPaintedOrBlank),
    opensBold: runs.find((run) => run.text.trim() !== '')?.bold ?? false,
  };
}

function isPaintedOrBlank(run: Run): boolean {
  return run.painted || run.text.trim() === '';
}

function runsOf(row: string): readonly Run[] {
  const runs: Run[] = [];
  let ink: Ink = { painted: false, bold: false };
  let cursor = 0;

  for (const change of row.matchAll(COLOUR)) {
    const before = row.slice(cursor, change.index);
    if (before !== '') runs.push({ text: before, ...ink });
    cursor = change.index + change[0].length;
    ink = inkAfter(change[1] ?? '', ink);
  }

  const rest = row.slice(cursor);
  if (rest !== '') runs.push({ text: rest, ...ink });
  return runs;
}

function inkAfter(parameters: string, ink: Ink): Ink {
  const codes = parameters === '' ? [0] : parameters.split(';').map(Number);
  let { painted, bold } = ink;

  for (let at = 0; at < codes.length; at += 1) {
    const code = codes[at];
    if (code === 0) {
      painted = false;
      bold = false;
    } else if (code === 49) painted = false;
    else if (code === 1) bold = true;
    else if (code === 22) bold = false;
    else if (code === 48) {
      painted = true;
      at += extendedColourCodes(codes[at + 1]);
    } else if (code === 38) at += extendedColourCodes(codes[at + 1]);
    else if (isBackground(code)) painted = true;
  }

  return { painted, bold };
}

function extendedColourCodes(selector: number | undefined): number {
  if (selector === 5) return 2;
  if (selector === 2) return 4;
  return 0;
}

function isBackground(code: number | undefined): boolean {
  if (code === undefined) return false;
  return (code >= 40 && code <= 47) || (code >= 100 && code <= 107);
}

function legible(text: string): string {
  return text
    .replace(WINDOW_TITLE, '')
    .replace(CURSOR_AND_ERASE, '')
    .replace(OTHER_ESCAPE, '')
    .replace(ICON_GLYPH, '')
    .replace(HARD_SPACE, ' ')
    .replace(CONTROL, '')
    .replace(/\s+$/, '');
}
