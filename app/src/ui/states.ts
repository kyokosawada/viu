import type { PaneState } from '@viu/protocol';

import { colour } from './look';

const WORDS = {
  'needs-you': 'Needs you',
  thinking: 'Thinking',
  idle: 'Idle',
  dormant: 'Dormant',
  unknown: 'Unclear',
} satisfies Record<PaneState, string>;

const LAMPS = {
  'needs-you': colour.wants,
  thinking: colour.good,
  idle: colour.faded,
  dormant: colour.faded,
  unknown: colour.faded,
} satisfies Record<PaneState, string>;

export function wordFor(state: PaneState): string {
  return WORDS[state];
}

export function lampFor(state: PaneState): string {
  return LAMPS[state];
}
