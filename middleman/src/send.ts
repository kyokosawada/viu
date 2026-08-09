import type { Key, PaneId, PaneState, Sent } from '@viu/protocol';

import { PaneGone, UnsupportedKey } from './errors.js';
import { paneStateOf } from './fleet.js';
import { refusalCode, type HerdrConnection } from './herdr/connection.js';

const PICKUP_WINDOW_MS = 5000;
const CANONICAL_LINE_LIMIT = 4096;

const HERDR_KEYS = new Map<Key, string>([
  ['escape', 'esc'],
  ['enter', 'enter'],
  ['tab', 'tab'],
  ['up', 'up'],
  ['down', 'down'],
  ['left', 'left'],
  ['right', 'right'],
  ['backspace', 'backspace'],
  ['space', 'space'],
  ['ctrl-c', 'c-c'],
]);

export async function sendText(
  herdr: HerdrConnection,
  paneId: PaneId,
  text: string,
): Promise<Sent> {
  const confirmed = await promptAgent(herdr, paneId, text);
  return confirmed ?? (await queueIntoPane(herdr, paneId, text));
}

export async function pressKeys(
  herdr: HerdrConnection,
  paneId: PaneId,
  keys: readonly Key[],
): Promise<void> {
  const pressed = keys.map(herdrKeyFor);
  try {
    await herdr.request('pane.send_keys', { pane_id: paneId, keys: pressed });
  } catch (error) {
    if (refusalCode(error) === 'pane_not_found') throw new PaneGone(paneId);
    throw error;
  }
}

function herdrKeyFor(key: Key): string {
  const named = HERDR_KEYS.get(key);
  if (named === undefined) throw new UnsupportedKey(key);
  return named;
}

async function promptAgent(
  herdr: HerdrConnection,
  paneId: PaneId,
  text: string,
): Promise<Sent | null> {
  try {
    const prompted = await herdr.request('agent.prompt', {
      target: paneId,
      text,
      wait: { until: ['working'], timeout_ms: PICKUP_WINDOW_MS },
    });
    return { paneId, confidence: 'confirmed', state: stateAfter(prompted) };
  } catch (error) {
    switch (refusalCode(error)) {
      case 'timeout':
        return { paneId, confidence: 'queued', mayBeCut: false };
      case 'agent_not_found':
      case 'agent_not_ready':
        return null;
      default:
        throw error;
    }
  }
}

async function queueIntoPane(
  herdr: HerdrConnection,
  paneId: PaneId,
  text: string,
): Promise<Sent> {
  try {
    await herdr.request('pane.send_input', { pane_id: paneId, text, keys: ['enter'] });
  } catch (error) {
    if (refusalCode(error) === 'pane_not_found') throw new PaneGone(paneId);
    throw error;
  }
  return { paneId, confidence: 'queued', mayBeCut: exceedsOneCanonicalLine(text) };
}

function stateAfter(answer: unknown): PaneState {
  if (!isRecord(answer) || !isRecord(answer.agent)) return 'unknown';
  return paneStateOf(answer.agent);
}

function exceedsOneCanonicalLine(text: string): boolean {
  return text
    .split('\n')
    .some((line) => Buffer.byteLength(line, 'utf8') >= CANONICAL_LINE_LIMIT);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
