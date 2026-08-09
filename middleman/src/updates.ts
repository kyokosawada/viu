import type { Server } from 'node:http';

import { UPDATES_PATH, type Update, type Watching } from '@viu/protocol';
import { WebSocketServer, type RawData, type WebSocket } from 'ws';

import { Malformed } from './errors.js';
import type { Middleman } from './middleman.js';
import { troubleOf } from './trouble.js';

export const HEARTBEAT_MS = 30000;

export function serveUpdates(server: Server, middleman: Middleman): () => Promise<void> {
  const sockets = new WebSocketServer({ server, path: UPDATES_PATH });
  const answering = new WeakSet<WebSocket>();

  sockets.on('error', () => undefined);

  sockets.on('connection', (socket: WebSocket) => {
    answering.add(socket);
    socket.on('pong', () => {
      answering.add(socket);
    });

    const say = (update: Update): void => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(update));
    };
    const connection = middleman.connect(say);

    socket.on('message', (data: RawData) => {
      let asked: Watching;
      try {
        asked = watchingIn(textOf(data));
      } catch (reason) {
        say({ kind: 'trouble', trouble: troubleOf(reason) });
        return;
      }
      if (asked.kind === 'watch') connection.watch(asked.paneId);
      else connection.stopWatching();
    });

    socket.on('close', () => {
      connection.close();
    });

    socket.on('error', () => {
      connection.close();
      socket.terminate();
    });
  });

  const beat = setInterval(() => {
    for (const socket of sockets.clients) {
      if (!answering.delete(socket)) {
        socket.terminate();
        continue;
      }
      socket.ping();
    }
  }, HEARTBEAT_MS);
  beat.unref();

  return () =>
    new Promise<void>((closed) => {
      clearInterval(beat);
      for (const socket of sockets.clients) socket.terminate();
      sockets.close(() => {
        closed();
      });
    });
}

function textOf(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  return data.toString('utf8');
}

function watchingIn(message: string): Watching {
  let asked: unknown;
  try {
    asked = JSON.parse(message);
  } catch {
    throw new Malformed('what was said on the connection is not JSON');
  }
  if (typeof asked !== 'object' || asked === null || Array.isArray(asked)) {
    throw new Malformed('what was said on the connection is not an object');
  }
  const { kind, paneId } = asked as { kind?: unknown; paneId?: unknown };
  if (kind === 'stop-watching') return { kind };
  if (kind === 'watch' && typeof paneId === 'string' && paneId !== '') {
    return { kind, paneId };
  }
  throw new Malformed('a connection is only told to watch a pane or to stop watching');
}
