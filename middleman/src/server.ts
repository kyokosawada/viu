import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { PROTOCOL_VERSION } from '@viu/protocol';

import { HerdrNotRunning, NoTailnet, PaneGone } from './errors.js';
import type { HerdrConnection } from './herdr/connection.js';
import { createMiddleman, type Middleman } from './middleman.js';
import { greetHerdr } from './startup.js';

const DEFAULT_PORT = 8787;
const LARGEST_SEND = 64 * 1024;

export interface ServiceOptions {
  readonly herdr: HerdrConnection;
  readonly addresses: readonly string[];
  readonly port: number;
}

export interface Service {
  readonly urls: readonly string[];
  readonly herdr: string;
  close(): Promise<void>;
}

export function portFrom(value: string | undefined): number {
  if (value === undefined || value === '') return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`VIU_PORT is ${value}, which is not a port number between 1 and 65535`);
  }
  return port;
}

export async function serveMiddleman({ herdr, addresses, port }: ServiceOptions): Promise<Service> {
  if (addresses.length === 0) throw new NoTailnet();

  const greeting = await greetHerdr(herdr);
  const middleman = createMiddleman(herdr);
  const answer = answering(middleman, greeting.herdr);
  const listeners = await Promise.all(
    addresses.map((address) => listen(createServer(answer), address, port)),
  );

  return {
    urls: listeners.map(urlOf),
    herdr: greeting.herdr,
    close: async () => {
      await Promise.all(listeners.map(shut));
    },
  };
}

function answering(
  middleman: Middleman,
  herdrVersion: string,
): (request: IncomingMessage, response: ServerResponse) => void {
  return (request, response) => {
    void route(middleman, herdrVersion, request)
      .then((answer) => {
        reply(response, answer.status, answer.body);
      })
      .catch((error: unknown) => {
        reply(response, ...failure(error));
      });
  };
}

interface Answer {
  readonly status: number;
  readonly body: unknown;
}

async function route(
  middleman: Middleman,
  herdrVersion: string,
  request: IncomingMessage,
): Promise<Answer> {
  const path = segmentsOf(request.url ?? '/');
  const method = request.method ?? 'GET';

  if (method === 'GET' && path.length === 0) {
    return {
      status: 200,
      body: { viu: 'middleman', protocol: PROTOCOL_VERSION, herdr: herdrVersion },
    };
  }
  if (method === 'GET' && path.length === 1 && path[0] === 'fleet') {
    return { status: 200, body: await middleman.fleet() };
  }
  if (method === 'GET' && path.length === 3 && path[0] === 'panes' && path[2] === 'conversation') {
    return { status: 200, body: await middleman.conversation(paneIdOf(path)) };
  }
  if (method === 'POST' && path.length === 3 && path[0] === 'panes' && path[2] === 'send') {
    return { status: 200, body: await middleman.send(paneIdOf(path), await textOf(request)) };
  }
  return {
    status: 404,
    body: { error: 'no-such-endpoint', message: `nothing is served at ${request.url ?? '/'}` },
  };
}

class Malformed extends Error {}
class TooMuch extends Error {}

function segmentsOf(url: string): string[] {
  return new URL(url, 'http://middleman').pathname
    .split('/')
    .filter((segment) => segment !== '')
    .map((segment) => decodeURIComponent(segment));
}

function paneIdOf(path: readonly string[]): string {
  const paneId = path[1];
  if (paneId === undefined || paneId === '') throw new Malformed('no pane was named');
  return paneId;
}

async function textOf(request: IncomingMessage): Promise<string> {
  const body = await bodyOf(request);
  let sent: unknown;
  try {
    sent = JSON.parse(body);
  } catch {
    throw new Malformed('the body is not JSON');
  }
  if (typeof sent !== 'object' || sent === null) {
    throw new Malformed('the body is not a send');
  }
  const { text } = sent as { text?: unknown };
  if (typeof text !== 'string') throw new Malformed('the body carries no text to send');
  return text;
}

async function bodyOf(request: IncomingMessage): Promise<string> {
  let body = '';
  request.setEncoding('utf8');
  for await (const chunk of request) {
    body += chunk as string;
    if (body.length > LARGEST_SEND) {
      throw new TooMuch('the body is larger than any send needs to be');
    }
  }
  return body;
}

function failure(error: unknown): [number, unknown] {
  if (error instanceof PaneGone) {
    return [404, { error: 'pane-gone', paneId: error.paneId, message: error.message }];
  }
  if (error instanceof Malformed) {
    return [400, { error: 'malformed-request', message: error.message }];
  }
  if (error instanceof TooMuch) {
    return [413, { error: 'too-much', message: error.message }];
  }
  if (error instanceof HerdrNotRunning) {
    return [503, { error: 'herdr-unreachable', message: error.message }];
  }
  const message = error instanceof Error ? error.message : String(error);
  return [502, { error: 'herdr-unreachable', message }];
}

function reply(response: ServerResponse, status: number, body: unknown): void {
  const rendered = `${JSON.stringify(body)}\n`;
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(rendered),
    'cache-control': 'no-store',
  });
  response.end(rendered);
}

function listen(server: Server, address: string, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host: address, port, ipv6Only: address.includes(':') }, () => {
      server.removeListener('error', reject);
      resolve(server);
    });
  });
}

function shut(server: Server): Promise<void> {
  return new Promise((closed) => {
    server.closeAllConnections();
    server.close(() => {
      closed();
    });
  });
}

function urlOf(server: Server): string {
  const { address, port } = server.address() as AddressInfo;
  return address.includes(':') ? `http://[${address}]:${port}` : `http://${address}:${port}`;
}
