import type { PaneState } from '@viu/protocol';

import type { Colours } from './look';

const WORDS = {
  'needs-you': 'Needs you',
  thinking: 'Thinking',
  idle: 'Idle',
  dormant: 'Dormant',
  unknown: 'Unclear',
} satisfies Record<PaneState, string>;

const COLOURS = {
  'needs-you': 'stateNeedsYou',
  thinking: 'stateThinking',
  idle: 'stateIdle',
  dormant: 'stateIdle',
  unknown: 'stateIdle',
} satisfies Record<PaneState, keyof Colours>;

export function wordFor(state: PaneState): string {
  return WORDS[state];
}

export function colourFor(state: PaneState, colour: Colours): string {
  return colour[COLOURS[state]];
}
