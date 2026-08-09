import type { Conversation, Fleet, Key, PaneId, Sent } from '@viu/protocol';

import { turnsOf } from './chat.js';
import { readFleet, readScreenful } from './fleet.js';
import type { HerdrConnection } from './herdr/connection.js';
import { pressKeys, sendText } from './send.js';

export interface Middleman {
  fleet(): Promise<Fleet>;
  conversation(paneId: PaneId): Promise<Conversation>;
  send(paneId: PaneId, text: string): Promise<Sent>;
  press(paneId: PaneId, keys: readonly Key[]): Promise<void>;
}

export function createMiddleman(herdr: HerdrConnection): Middleman {
  return {
    fleet: () => readFleet(herdr),

    conversation: async (paneId) => ({
      paneId,
      turns: turnsOf(await readScreenful(herdr, paneId)),
    }),

    send: (paneId, text) => sendText(herdr, paneId, text),

    press: (paneId, keys) => pressKeys(herdr, paneId, keys),
  };
}
