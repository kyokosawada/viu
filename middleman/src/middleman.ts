import type { Conversation, Fleet, Image, Key, PaneId, Send, Sent } from '@viu/protocol';

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

  const keptPaths = async (images: readonly Image[]): Promise<string[]> => {
    const paths: string[] = [];
    for (const image of images) paths.push(await attachments.keep(image));
    return paths;
  };

  return {
    fleet: () => readFleet(herdr),

    conversation: async (paneId) => ({
      paneId,
      turns: turnsOf(await readScreenful(herdr, paneId)),
    }),

    send: async (paneId, { text, images }) =>
      sendText(herdr, paneId, promptFor(text, await keptPaths(images))),

    press: (paneId, keys) => pressKeys(herdr, paneId, keys),

    connect: (receive) => connections.open(receive),
  };
}
