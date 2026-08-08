import { randomUUID } from 'node:crypto';
import { connect } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { HerdrConnection } from './connection.js';

export function herdrSocketPath(): string {
  return process.env.HERDR_SOCKET ?? join(homedir(), '.config', 'herdr', 'herdr.sock');
}

export function connectToHerdr(socketPath: string): HerdrConnection {
  return {
    request: (method, params) => requestOverOneConnection(socketPath, method, params),
  };
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
        reject(new Error(`herdr socket at ${socketPath} is unreachable: ${error.message}`));
      });
    });

    socket.on('close', () => {
      settle(() => {
        reject(new Error(`herdr closed the connection without answering ${method}`));
      });
    });
  });
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
    throw new Error(`herdr refused ${method}: ${describe(error)}`);
  }
  if (result === undefined) {
    throw new Error(`herdr answered ${method} with neither a result nor an error`);
  }
  return result;
}

function describe(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const { code, message } = error as { code?: unknown; message?: unknown };
    if (typeof code === 'string' && typeof message === 'string') return `${code} - ${message}`;
    if (typeof message === 'string') return message;
  }
  return JSON.stringify(error);
}
