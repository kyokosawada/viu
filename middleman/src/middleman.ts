import type { Conversation, Fleet, Key, PaneId, Send, SendPart, Sent } from '@viu/protocol';

import {
  attachmentsDirectory,
  attachmentsIn,
  promptFor,
  type Attachments,
  type Piece,
} from './attachments.js';
import { turnsOf } from './chat.js';
import { readFleet, readScreenful } from './fleet.js';
import type { HerdrConnection } from './herdr/connection.js';
import { pressKeys, sendTurn } from './send.js';
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
  const conversationOf = async (paneId: PaneId): Promise<Conversation> => ({
    paneId,
    turns: turnsOf(await readScreenful(herdr, paneId)).map((turn) => ({
      ...turn,
      text: attachments.marked(turn.text),
    })),
  });

  const connections = createConnections(herdr, conversationOf);

  const keptFor = async (parts: readonly SendPart[]): Promise<Piece[]> => {
    const pieces: Piece[] = [];
    for (const part of parts) {
      pieces.push('image' in part ? { path: await attachments.keep(part.image) } : part);
    }
    return pieces;
  };

  return {
    fleet: () => readFleet(herdr),

    conversation: conversationOf,

    send: async (paneId, { parts }) => {
      const pieces = await keptFor(parts);
      return sendTurn(herdr, paneId, {
        text: promptFor(pieces),
        carriesAnImage: pieces.some((piece) => 'path' in piece),
      });
    },

    press: (paneId, keys) => pressKeys(herdr, paneId, keys),

    connect: (receive) => connections.open(receive),
  };
}
