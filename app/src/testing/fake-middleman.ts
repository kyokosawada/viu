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
import type {
  Change,
  Connection,
  MiddlemanAt,
  MiddlemanClient,
  Missed,
  Reach,
  Receive,
} from '../middleman/client';

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
  connectedFrom(): readonly Machine[];
  connectionsHeld(): number;
  watchedPanes(): readonly PaneId[];
  nowWatching(): PaneId | null;
  whatWasSent(): readonly Told[];
}

interface Held {
  readonly receive: Receive;
  watching: PaneId | null;
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
  const connected: Machine[] = [];
  const watched: PaneId[] = [];
  const held = new Set<Held>();
  const told: Told[] = [];

  const answer = <Got>(got: Got): Reach<Got> => {
    if (!there) return { kind: 'unreachable', why: 'no route to the machine' };
    return instead ?? { kind: 'reached', got };
  };

  const asFleet = (): Reach<Change> =>
    insteadOfTheFleet ?? answer<Change>({ kind: 'fleet', fleet });

  const asConversation = (paneId: PaneId): Reach<Change> => {
    const conversation: Conversation = { paneId, turns: conversations.get(paneId) ?? [] };
    return insteadOfThePane ?? answer<Change>({ kind: 'conversation', conversation });
  };

  const pushTheFleet = (): void => {
    for (const connection of held) connection.receive(asFleet());
  };

  const pushThePane = (paneId: PaneId): void => {
    for (const connection of held) {
      if (connection.watching === paneId) connection.receive(asConversation(paneId));
    }
  };

  const client = (machine: Machine): MiddlemanClient => ({
    greet: () => {
      greeted.push(machine);
      if (breaks !== null) return Promise.reject(new Error(breaks));
      return Promise.resolve(answer(greeting));
    },

    connect: (receive: Receive): Connection => {
      connected.push(machine);
      const connection: Held = { receive, watching: null };
      held.add(connection);
      receive(asFleet());

      return {
        watch: (paneId: PaneId) => {
          if (!held.has(connection) || connection.watching === paneId) return;
          connection.watching = paneId;
          watched.push(paneId);
          receive(asConversation(paneId));
        },

        stopWatching: () => {
          if (!held.has(connection)) return;
          connection.watching = null;
        },

        close: () => {
          connection.watching = null;
          held.delete(connection);
        },
      };
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
      pushTheFleet();
    },

    showsThePane(paneId: PaneId, turns: readonly Turn[]): void {
      conversations.set(paneId, turns);
      pushThePane(paneId);
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
      pushTheFleet();
    },

    troublesThePane(trouble: Trouble): void {
      insteadOfThePane = { kind: 'trouble', trouble };
      for (const connection of held) {
        if (connection.watching !== null) connection.receive(insteadOfThePane);
      }
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
      for (const connection of held) {
        connection.receive({ kind: 'unreachable', why: 'no route to the machine' });
      }
    },

    comesBack(): void {
      there = true;
      pushTheFleet();
    },

    greetedFrom(): readonly Machine[] {
      return greeted;
    },

    connectedFrom(): readonly Machine[] {
      return connected;
    },

    connectionsHeld(): number {
      return held.size;
    },

    watchedPanes(): readonly PaneId[] {
      return watched;
    },

    nowWatching(): PaneId | null {
      for (const connection of held) {
        if (connection.watching !== null) return connection.watching;
      }
      return null;
    },

    whatWasSent(): readonly Told[] {
      return told;
    },
  };
}
