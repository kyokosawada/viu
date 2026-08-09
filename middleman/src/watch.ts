import type { Conversation, Fleet, PaneId, Update } from '@viu/protocol';

import { turnsOf } from './chat.js';
import { readFleet, readScreenful, watchPanes } from './fleet.js';
import type { HerdrConnection } from './herdr/connection.js';

export const CONTENT_POLL_MS = 1000;

export type Receive = (update: Update) => void;

export interface Connection {
  watch(paneId: PaneId): void;
  stopWatching(): void;
  close(): void;
}

export interface Connections {
  open(receive: Receive): Connection;
}

interface Client {
  readonly receive: Receive;
  watching: PaneId | null;
  toldFleet: string | null;
}

interface Watched {
  readonly poll: ReturnType<typeof setInterval>;
  reading: boolean;
  pushed: Conversation | null;
}

export function createConnections(herdr: HerdrConnection): Connections {
  const clients = new Set<Client>();
  const watched = new Map<PaneId, Watched>();
  let stopListening: (() => void) | null = null;
  let readingFleet = false;
  let changesSeen = 0;
  let changesRead = 0;

  const tellFleet = (client: Client, fleet: Fleet, asTold: string): void => {
    if (asTold === client.toldFleet) return;
    client.toldFleet = asTold;
    client.receive({ kind: 'fleet', fleet });
  };

  const pushFleet = async (): Promise<void> => {
    changesSeen += 1;
    if (readingFleet) return;
    readingFleet = true;
    try {
      while (changesRead < changesSeen) {
        changesRead = changesSeen;
        const fleet = await readFleet(herdr).catch(() => null);
        if (fleet === null) continue;
        const asTold = JSON.stringify(fleet);
        for (const client of clients) tellFleet(client, fleet, asTold);
      }
    } finally {
      readingFleet = false;
    }
  };

  const pushConversation = async (paneId: PaneId): Promise<void> => {
    const watch = watched.get(paneId);
    if (watch === undefined || watch.reading) return;
    watch.reading = true;
    try {
      const screenful = await readScreenful(herdr, paneId).catch(() => null);
      if (screenful === null || watched.get(paneId) !== watch) return;
      const conversation: Conversation = { paneId, turns: turnsOf(screenful) };
      if (JSON.stringify(watch.pushed) === JSON.stringify(conversation)) return;
      watch.pushed = conversation;
      for (const client of clients) {
        if (client.watching === paneId) client.receive({ kind: 'conversation', conversation });
      }
    } finally {
      watch.reading = false;
    }
  };

  const join = (client: Client, paneId: PaneId): void => {
    client.watching = paneId;
    const watch = watched.get(paneId);
    if (watch === undefined) {
      watched.set(paneId, {
        poll: setInterval(() => void pushConversation(paneId), CONTENT_POLL_MS),
        reading: false,
        pushed: null,
      });
      void pushConversation(paneId);
      return;
    }
    if (watch.pushed !== null) {
      client.receive({ kind: 'conversation', conversation: watch.pushed });
    }
  };

  const leave = (client: Client): void => {
    const paneId = client.watching;
    client.watching = null;
    if (paneId === null) return;
    for (const other of clients) if (other.watching === paneId) return;
    const watch = watched.get(paneId);
    if (watch === undefined) return;
    clearInterval(watch.poll);
    watched.delete(paneId);
  };

  return {
    open(receive) {
      const client: Client = { receive, watching: null, toldFleet: null };
      clients.add(client);
      stopListening ??= watchPanes(herdr, () => void pushFleet(), () => undefined);
      void pushFleet();

      let connected = true;
      return {
        watch(paneId) {
          if (!connected || client.watching === paneId) return;
          leave(client);
          join(client, paneId);
        },

        stopWatching() {
          if (connected) leave(client);
        },

        close() {
          if (!connected) return;
          connected = false;
          leave(client);
          clients.delete(client);
          if (clients.size > 0) return;
          stopListening?.();
          stopListening = null;
        },
      };
    },
  };
}
