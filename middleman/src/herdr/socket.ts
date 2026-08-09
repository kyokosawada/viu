import { randomUUID } from 'node:crypto';
import { connect } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { HerdrConnectionLost, HerdrNotRunning } from '../errors.js';

import { HerdrRefusal, type HerdrConnection, type HerdrWatcher } from './connection.js';

export function herdrSocketPath(): string {
  return join(homedir(), '.config', 'herdr', 'herdr.sock');
}

export function connectToHerdr(socketPath: string): HerdrConnection {
  return {
    request: (method, params) => requestOverOneConnection(socketPath, method, params),
    subscribe: (method, params, watcher) =>
      subscribeOverOneHeldConnection(socketPath, method, params, watcher),
  };
}

function subscribeOverOneHeldConnection(
  socketPath: string,
  method: string,
  params: Record<string, unknown>,
  watcher: HerdrWatcher,
): () => void {
  const socket = connect(socketPath);
  let received = '';
  let held = true;

  const lose = (reason: Error): void => {
    if (!held) return;
    held = false;
    socket.destroy();
    watcher.onLost(reason);
  };

  socket.setEncoding('utf8');

  socket.on('connect', () => {
    socket.write(`${JSON.stringify({ id: randomUUID(), method, params })}\n`);
  });

  socket.on('data', (chunk: string) => {
    received += chunk;
    for (let end = received.indexOf('\n'); end !== -1; end = received.indexOf('\n')) {
      const line = received.slice(0, end);
      received = received.slice(end + 1);
      if (isEvent(line)) watcher.onEvent();
    }
  });

  socket.on('error', (error: Error) => {
    lose(unreachable(socketPath, error));
  });

  socket.on('close', () => {
    lose(new HerdrConnectionLost(socketPath, 'was closed under a subscription it was holding'));
  });

  return () => {
    held = false;
    socket.destroy();
  };
}

function isEvent(line: string): boolean {
  let envelope: unknown;
  try {
    envelope = JSON.parse(line);
  } catch {
    return false;
  }

  if (typeof envelope !== 'object' || envelope === null) return false;
  const { id, event } = envelope as { id?: unknown; event?: unknown };
  return id === undefined && event !== undefined;
}

function requestOverOneConnection(
  socketPath: string,
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = connect(socketPath);
    let received = '';
    let settled = false;

    const settle = (outcome: () => void): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      outcome();
    };

    socket.setEncoding('utf8');

    socket.on('connect', () => {
      socket.write(`${JSON.stringify({ id: randomUUID(), method, params })}\n`);
    });

    socket.on('data', (chunk: string) => {
      received += chunk;
      const end = received.indexOf('\n');
      if (end === -1) return;
      settle(() => {
        try {
          resolve(resultOf(received.slice(0, end), method));
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
    });

    socket.on('error', (error: Error) => {
      settle(() => {
        reject(unreachable(socketPath, error));
      });
    });

    socket.on('close', () => {
      settle(() => {
        reject(new HerdrConnectionLost(socketPath, 'was closed before the answer came back'));
      });
    });
  });
}

function unreachable(socketPath: string, error: Error): Error {
  switch ((error as NodeJS.ErrnoException).code) {
    case 'ENOENT':
      return new HerdrNotRunning(socketPath, 'there is no socket at');
    case 'ECONNREFUSED':
      return new HerdrNotRunning(socketPath, 'nothing is listening on');
    default:
      return new HerdrConnectionLost(socketPath, `could not be opened: ${error.message}`);
  }
}

function resultOf(line: string, method: string): unknown {
  let envelope: unknown;
  try {
    envelope = JSON.parse(line);
  } catch {
    throw new Error(`herdr answered ${method} with something that is not JSON`);
  }

  if (typeof envelope !== 'object' || envelope === null) {
    throw new Error(`herdr answered ${method} with something that is not a response`);
  }

  const { result, error } = envelope as { result?: unknown; error?: unknown };

  if (error !== undefined) {
    throw refusal(method, error);
  }
  if (result === undefined) {
    throw new Error(`herdr answered ${method} with neither a result nor an error`);
  }
  return result;
}

function refusal(method: string, error: unknown): Error {
  const reported = `herdr refused ${method}: ${describe(error)}`;
  const code = codeOf(error);
  return code === null ? new Error(reported) : new HerdrRefusal(code, reported);
}

function codeOf(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const { code } = error as { code?: unknown };
  return typeof code === 'string' && code !== '' ? code : null;
}

function describe(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const { code, message } = error as { code?: unknown; message?: unknown };
    if (typeof code === 'string' && typeof message === 'string') return `${code} - ${message}`;
    if (typeof message === 'string') return message;
  }
  return JSON.stringify(error);
}
