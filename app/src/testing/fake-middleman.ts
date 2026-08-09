import { PROTOCOL_VERSION, type Fleet, type Pane, type Trouble } from '@viu/protocol';

import type { Machine } from '../machine';
import type { MiddlemanAt, MiddlemanClient, Missed, Reach } from '../middleman/client';

export interface FakeMiddleman {
  readonly at: MiddlemanAt;
  greets(herdr: string): void;
  shows(panes: readonly Pane[]): void;
  troubles(trouble: Trouble): void;
  troublesTheFleet(trouble: Trouble): void;
  answersAsSomethingElse(why: string): void;
  failsToAnswerAtAll(why: string): void;
  goesAway(): void;
  comesBack(): void;
  greetedFrom(): readonly Machine[];
  askedForTheFleet(): readonly Machine[];
}

export function createFakeMiddleman(herdr = '0.7.5'): FakeMiddleman {
  let greeting = { viu: 'middleman' as const, protocol: PROTOCOL_VERSION, herdr };
  let fleet: Fleet = { panes: [] };
  let instead: Missed | null = null;
  let insteadOfTheFleet: Missed | null = null;
  let breaks: string | null = null;
  let there = true;
  const greeted: Machine[] = [];
  const askedFor: Machine[] = [];

  const answer = <Got>(got: Got): Reach<Got> => {
    if (!there) return { kind: 'unreachable', why: 'no route to the machine' };
    return instead ?? { kind: 'reached', got };
  };

  const client = (machine: Machine): MiddlemanClient => ({
    greet: () => {
      greeted.push(machine);
      if (breaks !== null) return Promise.reject(new Error(breaks));
      return Promise.resolve(answer(greeting));
    },

    fleet: () => {
      askedFor.push(machine);
      if (breaks !== null) return Promise.reject(new Error(breaks));
      return Promise.resolve(insteadOfTheFleet ?? answer(fleet));
    },
  });

  return {
    at: client,

    greets(named: string): void {
      greeting = { ...greeting, herdr: named };
      instead = null;
      insteadOfTheFleet = null;
      breaks = null;
    },

    shows(panes: readonly Pane[]): void {
      fleet = { panes };
    },

    troubles(trouble: Trouble): void {
      instead = { kind: 'trouble', trouble };
    },

    troublesTheFleet(trouble: Trouble): void {
      insteadOfTheFleet = { kind: 'trouble', trouble };
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

    askedForTheFleet(): readonly Machine[] {
      return askedFor;
    },
  };
}
