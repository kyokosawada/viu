import type { Conversation, Fleet, PaneId, Trouble, Update } from '@viu/protocol';

import { turnsOf } from './chat.js';
import { PaneGone } from './errors.js';
import { readFleet, readScreenful, watchPanes } from './fleet.js';
import type { HerdrConnection } from './herdr/connection.js';
import { greetHerdr } from './startup.js';
import { troubleOf } from './trouble.js';

export const CONTENT_POLL_MS = 1000;
export const HERDR_RETRY_MS = 1000;

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
  let trouble: Trouble | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;

  const tellFleet = (client: Client, fleet: Fleet, asTold: string): void => {
    if (asTold === client.toldFleet) return;
    client.toldFleet = asTold;
    client.receive({ kind: 'fleet', fleet });
  };

  const forgetWhatWasTold = (): void => {
    for (const client of clients) client.toldFleet = null;
    for (const watch of watched.values()) watch.pushed = null;
  };

  const herdrLost = (reason: unknown): void => {
    keepTrying();
    const told = troubleOf(reason);
    if (trouble?.kind === told.kind) return;
    trouble = told;
    forgetWhatWasTold();
    for (const client of clients) client.receive({ kind: 'trouble', trouble: told });
  };

  const paneLost = (paneId: PaneId, reason: PaneGone): void => {
    const watch = watched.get(paneId);
    if (watch !== undefined) {
      clearInterval(watch.poll);
      watched.delete(paneId);
    }
    const told = troubleOf(reason);
    for (const client of clients) {
      if (client.watching !== paneId) continue;
      client.watching = null;
      client.receive({ kind: 'trouble', trouble: told });
    }
  };

  const pushFleet = async (): Promise<void> => {
    changesSeen += 1;
    if (readingFleet || trouble !== null) return;
    readingFleet = true;
    try {
      while (changesRead < changesSeen) {
        changesRead = changesSeen;
        let fleet: Fleet;
        try {
          fleet = await readFleet(herdr);
        } catch (reason) {
          herdrLost(reason);
          return;
        }
        const asTold = JSON.stringify(fleet);
        for (const client of clients) tellFleet(client, fleet, asTold);
      }
    } finally {
      readingFleet = false;
    }
  };

  const pushConversation = async (paneId: PaneId): Promise<void> => {
    const watch = watched.get(paneId);
    if (watch === undefined || watch.reading || trouble !== null) return;
    watch.reading = true;
    try {
      const screenful = await readScreenful(herdr, paneId);
      if (watched.get(paneId) !== watch) return;
      const conversation: Conversation = { paneId, turns: turnsOf(screenful) };
      if (JSON.stringify(watch.pushed) === JSON.stringify(conversation)) return;
      watch.pushed = conversation;
      for (const client of clients) {
        if (client.watching === paneId) client.receive({ kind: 'conversation', conversation });
      }
    } catch (reason) {
      if (reason instanceof PaneGone) paneLost(paneId, reason);
      else herdrLost(reason);
    } finally {
      watch.reading = false;
    }
  };

  const listen = (): void => {
    stopListening?.();
    stopListening = watchPanes(herdr, () => void pushFleet(), herdrLost);
  };

  const keepTrying = (): void => {
    if (retry !== null || clients.size === 0) return;
    retry = setTimeout(() => {
      retry = null;
      void tryHerdrAgain();
    }, HERDR_RETRY_MS);
  };

  const stopTrying = (): void => {
    if (retry === null) return;
    clearTimeout(retry);
    retry = null;
  };

  const tryHerdrAgain = async (): Promise<void> => {
    if (clients.size === 0) return;
    try {
      await greetHerdr(herdr);
    } catch (reason) {
      herdrLost(reason);
      return;
    }
    trouble = null;
    listen();
    await pushFleet();
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
      if (stopListening === null) listen();
      if (trouble !== null) {
        receive({ kind: 'trouble', trouble });
        keepTrying();
      }
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
          stopTrying();
          trouble = null;
        },
      };
    },
  };
}
