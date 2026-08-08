import type { PaneId, PaneState, Sent } from '@viu/protocol';

import { PaneGone } from './errors.js';
import { paneStateOf } from './fleet.js';
import { refusalCode, type HerdrConnection } from './herdr/connection.js';

const PICKUP_WINDOW_MS = 5000;
const CANONICAL_LINE_LIMIT = 4096;

export async function sendText(
  herdr: HerdrConnection,
  paneId: PaneId,
  text: string,
): Promise<Sent> {
  const confirmed = await promptAgent(herdr, paneId, text);
  return confirmed ?? (await queueIntoPane(herdr, paneId, text));
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
        return { paneId, confidence: 'confirmed', state: await stateNow(herdr, paneId) };
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

async function stateNow(herdr: HerdrConnection, paneId: PaneId): Promise<PaneState> {
  try {
    return stateAfter(await herdr.request('agent.get', { target: paneId }));
  } catch {
    return 'unknown';
  }
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
