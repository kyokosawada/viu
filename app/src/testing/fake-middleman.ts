import { PROTOCOL_VERSION, type Trouble } from '@viu/protocol';

import type { Machine } from '../machine';
import type { MiddlemanAt, MiddlemanClient, Reach } from '../middleman/client';

export interface FakeMiddleman {
  readonly at: MiddlemanAt;
  greets(herdr: string): void;
  troubles(trouble: Trouble): void;
  answersAsSomethingElse(why: string): void;
  failsToAnswerAtAll(why: string): void;
  goesAway(): void;
  comesBack(): void;
  greetedFrom(): readonly Machine[];
}

export function createFakeMiddleman(herdr = '0.7.5'): FakeMiddleman {
  let greeting = { viu: 'middleman' as const, protocol: PROTOCOL_VERSION, herdr };
  let instead: Reach | null = null;
  let breaks: string | null = null;
  let there = true;
  const greeted: Machine[] = [];

  const answer = (): Reach => {
    if (!there) return { kind: 'unreachable', why: 'no route to the machine' };
    return instead ?? { kind: 'reached', greeting };
  };

  const client = (machine: Machine): MiddlemanClient => ({
    greet: () => {
      greeted.push(machine);
      if (breaks !== null) return Promise.reject(new Error(breaks));
      return Promise.resolve(answer());
    },
  });

  return {
    at: client,

    greets(named: string): void {
      greeting = { ...greeting, herdr: named };
      instead = null;
      breaks = null;
    },

    troubles(trouble: Trouble): void {
      instead = { kind: 'trouble', trouble };
    },

    answersAsSomethingElse(why: string): void {
      instead = { kind: 'not-the-middleman', why };
    },

    failsToAnswerAtAll(why: string): void {
      breaks = why;
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
