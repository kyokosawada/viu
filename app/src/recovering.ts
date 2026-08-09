import type { Missed } from './middleman/client';

const WAITS = [500, 1000, 2000, 5000, 10000, 20000];

const LONGEST = 20000;

export function recoversOnItsOwn(missed: Missed): boolean {
  return missed.kind === 'unreachable';
}

export function waitBefore(since: number): number {
  return WAITS[Math.min(Math.max(since, 0), WAITS.length - 1)] ?? LONGEST;
}
