import {
  PROTOCOL_VERSION,
  type Conversation,
  type Fleet,
  type Pane,
  type PaneId,
  type PaneState,
  type Sent,
  type Trouble,
  type Turn,
} from '@viu/protocol';

import type { Machine } from '../machine';
import type { MiddlemanAt, MiddlemanClient, Missed, Reach } from '../middleman/client';

export interface Told {
  readonly paneId: PaneId;
  readonly text: string;
}

export interface FakeMiddleman {
  readonly at: MiddlemanAt;
  greets(herdr: string): void;
  shows(panes: readonly Pane[]): void;
  showsThePane(paneId: PaneId, turns: readonly Turn[]): void;
  picksUpWhatIsSent(state: PaneState): void;
  onlyQueuesWhatIsSent(mayBeCut?: boolean): void;
  troubles(trouble: Trouble): void;
  troublesTheFleet(trouble: Trouble): void;
  troublesThePane(trouble: Trouble): void;
  troublesTheSend(trouble: Trouble): void;
  answersAsSomethingElse(why: string): void;
  failsToAnswerAtAll(why: string): void;
  goesAway(): void;
  comesBack(): void;
  greetedFrom(): readonly Machine[];
  askedForTheFleet(): readonly Machine[];
  askedForTheConversationOf(): readonly PaneId[];
  whatWasSent(): readonly Told[];
}

export function createFakeMiddleman(herdr = '0.7.5'): FakeMiddleman {
  let greeting = { viu: 'middleman' as const, protocol: PROTOCOL_VERSION, herdr };
  let fleet: Fleet = { panes: [] };
  let instead: Missed | null = null;
  let insteadOfTheFleet: Missed | null = null;
  let insteadOfThePane: Missed | null = null;
  let insteadOfTheSend: Missed | null = null;
  let breaks: string | null = null;
  let there = true;
  let pickedUp: PaneState | null = null;
  let cut = false;
  const conversations = new Map<PaneId, readonly Turn[]>();
  const greeted: Machine[] = [];
  const askedFor: Machine[] = [];
  const opened: PaneId[] = [];
  const told: Told[] = [];

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

    conversation: (paneId: PaneId) => {
      opened.push(paneId);
      if (breaks !== null) return Promise.reject(new Error(breaks));
      const conversation: Conversation = { paneId, turns: conversations.get(paneId) ?? [] };
      return Promise.resolve(insteadOfThePane ?? answer(conversation));
    },

    send: (paneId: PaneId, text: string) => {
      told.push({ paneId, text });
      if (breaks !== null) return Promise.reject(new Error(breaks));
      const sent: Sent =
        pickedUp === null
          ? { paneId, confidence: 'queued', mayBeCut: cut }
          : { paneId, confidence: 'confirmed', state: pickedUp };
      return Promise.resolve(insteadOfTheSend ?? answer(sent));
    },
  });

  return {
    at: client,

    greets(named: string): void {
      greeting = { ...greeting, herdr: named };
      instead = null;
      insteadOfTheFleet = null;
      insteadOfThePane = null;
      insteadOfTheSend = null;
      breaks = null;
    },

    shows(panes: readonly Pane[]): void {
      fleet = { panes };
    },

    showsThePane(paneId: PaneId, turns: readonly Turn[]): void {
      conversations.set(paneId, turns);
    },

    picksUpWhatIsSent(state: PaneState): void {
      pickedUp = state;
    },

    onlyQueuesWhatIsSent(mayBeCut = false): void {
      pickedUp = null;
      cut = mayBeCut;
    },

    troubles(trouble: Trouble): void {
      instead = { kind: 'trouble', trouble };
    },

    troublesTheFleet(trouble: Trouble): void {
      insteadOfTheFleet = { kind: 'trouble', trouble };
    },

    troublesThePane(trouble: Trouble): void {
      insteadOfThePane = { kind: 'trouble', trouble };
    },

    troublesTheSend(trouble: Trouble): void {
      insteadOfTheSend = { kind: 'trouble', trouble };
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

    askedForTheConversationOf(): readonly PaneId[] {
      return opened;
    },

    whatWasSent(): readonly Told[] {
      return told;
    },
  };
}
