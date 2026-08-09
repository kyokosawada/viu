import type { Trouble } from '@viu/protocol';

type AboutAPane = Extract<Trouble, { paneId: string }>['kind'];
type AboutAKey = Extract<Trouble, { key: string }>['kind'];
type AboutTheMachine = Exclude<Trouble['kind'], AboutAPane | AboutAKey>;

const ABOUT_A_PANE = {
  'pane-gone': true,
  'pane-not-accepting-input': true,
} satisfies Record<AboutAPane, true>;

const ABOUT_A_KEY = {
  'unsupported-key': true,
} satisfies Record<AboutAKey, true>;

const ABOUT_THE_MACHINE = {
  'herdr-unreachable': true,
  'protocol-mismatch': true,
  'herdr-refused': true,
  'malformed-request': true,
  'too-much': true,
  'no-such-endpoint': true,
  'middleman-failed': true,
} satisfies Record<AboutTheMachine, true>;

export function troubleIn(body: unknown): Trouble | null {
  if (!isRecord(body)) return null;
  const { kind, message } = body;
  if (typeof kind !== 'string' || typeof message !== 'string') return null;

  if (named(ABOUT_A_PANE, kind)) {
    return typeof body.paneId === 'string' ? { kind, paneId: body.paneId, message } : null;
  }
  if (named(ABOUT_A_KEY, kind)) {
    return typeof body.key === 'string' ? { kind, key: body.key, message } : null;
  }
  return named(ABOUT_THE_MACHINE, kind) ? { kind, message } : null;
}

function named<Kind extends string>(kinds: Record<Kind, true>, kind: string): kind is Kind {
  return Object.hasOwn(kinds, kind);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
