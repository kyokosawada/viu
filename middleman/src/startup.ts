import { PROTOCOL_VERSION } from '@viu/protocol';

import { HerdrProtocolMismatch } from './errors.js';
import type { HerdrConnection } from './herdr/connection.js';

export const UNDERSTOOD_PROTOCOL = 17;

const REFUSED = 78;
const FAILED = 1;

export function startupLine(): string {
  return `viu middleman - protocol v${PROTOCOL_VERSION} - node ${process.versions.node}`;
}

export async function greetHerdr(herdr: HerdrConnection): Promise<string> {
  const pong = await herdr.request('ping', {});
  const spoken = protocolOf(pong);

  if (spoken !== UNDERSTOOD_PROTOCOL) {
    throw new HerdrProtocolMismatch(UNDERSTOOD_PROTOCOL, spoken, versionOf(pong));
  }
  return versionOf(pong);
}

export function exitCodeFor(error: unknown): number {
  return error instanceof HerdrProtocolMismatch ? REFUSED : FAILED;
}

function protocolOf(pong: unknown): number | null {
  if (!isRecord(pong) || typeof pong.protocol !== 'number') return null;
  return pong.protocol;
}

function versionOf(pong: unknown): string {
  if (!isRecord(pong) || typeof pong.version !== 'string' || pong.version === '') return 'unknown';
  return pong.version;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
