import { PROTOCOL_VERSION, type Trouble } from '@viu/protocol';

import type { Missed } from './client';

type PaneTrouble = Extract<Trouble, { paneId: string }>;
type AboutAPane = PaneTrouble['kind'];
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
  'attachment-not-stored': true,
  'middleman-failed': true,
} satisfies Record<AboutTheMachine, true>;

export function aboutAPane(trouble: Trouble): trouble is PaneTrouble {
  return named(ABOUT_A_PANE, trouble.kind);
}

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

export function protocolMismatch(spoken: number): Trouble {
  return {
    kind: 'protocol-mismatch',
    message: `the middleman speaks protocol v${spoken}, this Viu speaks v${PROTOCOL_VERSION}`,
  };
}

export function nothingAnswered(error: unknown): Missed {
  if (error instanceof Error && error.name === 'AbortError') {
    return { kind: 'unreachable', why: 'it did not answer in time' };
  }
  return { kind: 'unreachable', why: error instanceof Error ? error.message : String(error) };
}

function named<Kind extends string>(kinds: Record<Kind, true>, kind: string): kind is Kind {
  return Object.hasOwn(kinds, kind);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
