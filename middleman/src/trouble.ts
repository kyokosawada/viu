import type { Trouble } from '@viu/protocol';

import {
  HerdrConnectionLost,
  HerdrNotRunning,
  HerdrProtocolMismatch,
  Malformed,
  PaneGone,
  PaneNotAcceptingInput,
  TooMuch,
  UnsupportedKey,
} from './errors.js';
import { HerdrRefusal } from './herdr/connection.js';

const STATUSES: Record<Trouble['kind'], number> = {
  'pane-gone': 404,
  'pane-not-accepting-input': 409,
  'herdr-unreachable': 503,
  'protocol-mismatch': 502,
  'herdr-refused': 502,
  'unsupported-key': 400,
  'malformed-request': 400,
  'too-much': 413,
  'no-such-endpoint': 404,
  'middleman-failed': 500,
};

export function troubleOf(error: unknown): Trouble {
  const message = error instanceof Error ? error.message : String(error);

  if (error instanceof PaneGone) return { kind: 'pane-gone', paneId: error.paneId, message };
  if (error instanceof PaneNotAcceptingInput) {
    return { kind: 'pane-not-accepting-input', paneId: error.paneId, message };
  }
  if (error instanceof HerdrNotRunning || error instanceof HerdrConnectionLost) {
    return { kind: 'herdr-unreachable', message };
  }
  if (error instanceof HerdrProtocolMismatch) return { kind: 'protocol-mismatch', message };
  if (error instanceof HerdrRefusal) return { kind: 'herdr-refused', message };
  if (error instanceof UnsupportedKey) {
    return { kind: 'unsupported-key', key: error.key, message };
  }
  if (error instanceof Malformed) return { kind: 'malformed-request', message };
  if (error instanceof TooMuch) return { kind: 'too-much', message };
  return { kind: 'middleman-failed', message };
}

export function noSuchEndpoint(url: string): Trouble {
  return { kind: 'no-such-endpoint', message: `nothing is served at ${url}` };
}

export function statusFor(trouble: Trouble): number {
  return STATUSES[trouble.kind];
}
