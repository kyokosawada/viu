import type { Update } from '@viu/protocol';

import { readFleet, watchPanes } from './fleet.js';
import type { HerdrConnection } from './herdr/connection.js';

export type Receive = (update: Update) => void;

export interface Connection {
  close(): void;
}

export interface Connections {
  open(receive: Receive): Connection;
}

interface Client {
  readonly receive: Receive;
}

export function createConnections(herdr: HerdrConnection): Connections {
  const clients = new Set<Client>();
  let stopListening: (() => void) | null = null;
  let pushedFleet: string | null = null;
  let readingFleet = false;
  let changesSeen = 0;
  let changesRead = 0;

  const pushFleet = async (): Promise<void> => {
    changesSeen += 1;
    if (readingFleet) return;
    readingFleet = true;
    try {
      while (changesRead < changesSeen) {
        changesRead = changesSeen;
        const fleet = await readFleet(herdr).catch(() => null);
        if (fleet === null) continue;
        const asPushed = JSON.stringify(fleet);
        if (asPushed === pushedFleet) continue;
        pushedFleet = asPushed;
        for (const client of clients) client.receive({ kind: 'fleet', fleet });
      }
    } finally {
      readingFleet = false;
    }
  };

  const pushFleetTo = async (client: Client): Promise<void> => {
    const fleet = await readFleet(herdr).catch(() => null);
    if (fleet === null || !clients.has(client)) return;
    pushedFleet = JSON.stringify(fleet);
    client.receive({ kind: 'fleet', fleet });
  };

  return {
    open(receive) {
      const client: Client = { receive };
      clients.add(client);
      stopListening ??= watchPanes(herdr, () => void pushFleet());
      void pushFleetTo(client);

      let open = true;
      return {
        close() {
          if (!open) return;
          open = false;
          clients.delete(client);
          if (clients.size > 0) return;
          stopListening?.();
          stopListening = null;
          pushedFleet = null;
        },
      };
    },
  };
}
