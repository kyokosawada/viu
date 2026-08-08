import type { Conversation, Fleet, PaneId, Sent } from '@viu/protocol';

import { turnsOf } from './chat.js';
import { readFleet, readScreenful } from './fleet.js';
import type { HerdrConnection } from './herdr/connection.js';
import { sendText } from './send.js';

export interface Middleman {
  fleet(): Promise<Fleet>;
  conversation(paneId: PaneId): Promise<Conversation>;
  send(paneId: PaneId, text: string): Promise<Sent>;
}

export function createMiddleman(herdr: HerdrConnection): Middleman {
  return {
    fleet: () => readFleet(herdr),

    conversation: async (paneId) => ({
      paneId,
      turns: turnsOf(await readScreenful(herdr, paneId)),
    }),

    send: (paneId, text) => sendText(herdr, paneId, text),
  };
}
