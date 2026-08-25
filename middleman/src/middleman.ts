import type { Conversation, Fleet, Key, PaneId, Send, SendPart, Sent } from '@viu/protocol';

import { attachmentsDirectory, attachmentsIn, promptFor, type Attachments } from './attachments.js';
import { turnsOf } from './chat.js';
import { readFleet, readScreenful } from './fleet.js';
import type { HerdrConnection } from './herdr/connection.js';
import { pressKeys, sendText } from './send.js';
import { createConnections, type Connection, type Receive } from './watch.js';

export interface Middleman {
  fleet(): Promise<Fleet>;
  conversation(paneId: PaneId): Promise<Conversation>;
  send(paneId: PaneId, sending: Send): Promise<Sent>;
  press(paneId: PaneId, keys: readonly Key[]): Promise<void>;
  connect(receive: Receive): Connection;
}

export function createMiddleman(
  herdr: HerdrConnection,
  attachments: Attachments = attachmentsIn({ directory: attachmentsDirectory() }),
): Middleman {
  const connections = createConnections(herdr);

  const pathsFor = async (parts: readonly SendPart[]): Promise<string[]> => {
    const paths: string[] = [];
    for (const part of parts) {
      if ('image' in part) paths.push(await attachments.keep(part.image));
    }
    return paths;
  };

  return {
    fleet: () => readFleet(herdr),

    conversation: async (paneId) => ({
      paneId,
      turns: turnsOf(await readScreenful(herdr, paneId)),
    }),

    send: async (paneId, { parts }) =>
      sendText(herdr, paneId, promptFor(parts, await pathsFor(parts))),

    press: (paneId, keys) => pressKeys(herdr, paneId, keys),

    connect: (receive) => connections.open(receive),
  };
}
