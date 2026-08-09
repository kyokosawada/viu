import { PROTOCOL_VERSION, type Trouble } from '@viu/protocol';

import type { Machine } from '../machine';
import type { MiddlemanClient, Reach, ReachMachine } from '../middleman/client';

export interface FakeMiddleman {
  readonly reach: ReachMachine;
  greets(herdr: string): void;
  troubles(trouble: Trouble): void;
  goesAway(): void;
  comesBack(): void;
  greetedFrom(): readonly Machine[];
}

export function createFakeMiddleman(herdr = '0.7.5'): FakeMiddleman {
  let greeting = { viu: 'middleman' as const, protocol: PROTOCOL_VERSION, herdr };
  let trouble: Trouble | null = null;
  let there = true;
  const greeted: Machine[] = [];

  const answer = (): Reach => {
    if (!there) return { kind: 'unreachable', why: 'no route to the machine' };
    if (trouble !== null) return { kind: 'trouble', trouble };
    return { kind: 'reached', greeting };
  };

  const client = (machine: Machine): MiddlemanClient => ({
    greet: () => {
      greeted.push(machine);
      return Promise.resolve(answer());
    },
  });

  return {
    reach: client,

    greets(named: string): void {
      greeting = { ...greeting, herdr: named };
      trouble = null;
    },

    troubles(named: Trouble): void {
      trouble = named;
    },

    goesAway(): void {
      there = false;
    },

    comesBack(): void {
      there = true;
    },

    greetedFrom(): readonly Machine[] {
      return greeted;
    },
  };
}
