import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import {
  IMAGE_FORMATS,
  KEYS,
  PROTOCOL_VERSION,
  type Greeting,
  type Image,
  type ImageFormat,
  type Key,
  type Send,
} from '@viu/protocol';

import { attachmentsDirectory, attachmentsIn, type Attachments } from './attachments.js';
import { Malformed, NoTailnet, NotTheTailnet, TooMuch, UnsupportedKey } from './errors.js';
import type { HerdrConnection } from './herdr/connection.js';
import { createMiddleman, type Middleman } from './middleman.js';
import { greetHerdr } from './startup.js';
import { noSuchEndpoint, statusFor, troubleOf } from './trouble.js';
import { serveUpdates } from './updates.js';

const DEFAULT_PORT = 8787;
const LARGEST_KEYS = 64 * 1024;
const LARGEST_SEND = 12 * 1024 * 1024;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const EVERY_INTERFACE = new Set(['', '*', '0.0.0.0', '::', '[::]']);

export interface ServiceOptions {
  readonly herdr: HerdrConnection;
  readonly addresses: readonly string[];
  readonly port: number;
  readonly attachments?: Attachments;
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

export async function serveMiddleman({
  herdr,
  addresses,
  port,
  attachments = attachmentsIn({ directory: attachmentsDirectory() }),
}: ServiceOptions): Promise<Service> {
  refuseEveryInterface(addresses);

  const herdrVersion = await greetHerdr(herdr);
  const middleman = createMiddleman(herdr, attachments);
  const answer = answering(middleman, herdrVersion);
  await attachments.sweep();
  const listeners = await Promise.all(
    addresses.map((address) => listen(createServer(answer), address, port)),
  );
  const stopUpdating = listeners.map((server) => serveUpdates(server, middleman));

  return {
    urls: listeners.map(urlOf),
    herdr: herdrVersion,
    close: async () => {
      await Promise.all(stopUpdating.map((stop) => stop()));
      await Promise.all(listeners.map(shut));
    },
  };
}

function refuseEveryInterface(addresses: readonly string[]): void {
  if (addresses.length === 0) throw new NoTailnet();
  for (const address of addresses) {
    if (EVERY_INTERFACE.has(address)) throw new NotTheTailnet(address);
  }
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
        const trouble = troubleOf(error);
        reply(response, statusFor(trouble), trouble);
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
  const [head, paneId, of] = path;

  if (method === 'GET' && head === undefined) {
    const greeting: Greeting = { viu: 'middleman', protocol: PROTOCOL_VERSION, herdr: herdrVersion };
    return { status: 200, body: greeting };
  }
  if (method === 'GET' && head === 'fleet' && path.length === 1) {
    return { status: 200, body: await middleman.fleet() };
  }
  if (head === 'panes' && path.length === 3 && paneId !== undefined && paneId !== '') {
    if (method === 'GET' && of === 'conversation') {
      return { status: 200, body: await middleman.conversation(paneId) };
    }
    if (method === 'POST' && of === 'send') {
      return { status: 200, body: await middleman.send(paneId, await sendOf(request)) };
    }
    if (method === 'POST' && of === 'keys') {
      await middleman.press(paneId, await keysOf(request));
      return { status: 204, body: null };
    }
  }
  const nothing = noSuchEndpoint(request.url ?? '/');
  return { status: statusFor(nothing), body: nothing };
}

function segmentsOf(url: string): string[] {
  return new URL(url, 'http://middleman').pathname
    .split('/')
    .filter((segment) => segment !== '')
    .map((segment) => decodeURIComponent(segment));
}

async function sendOf(request: IncomingMessage): Promise<Send> {
  const { text, images } = (await sentIn(
    request,
    LARGEST_SEND,
    'the send is larger than the middleman takes',
  )) as { text?: unknown; images?: unknown };
  if (typeof text !== 'string') throw new Malformed('the body carries no text to send');
  if (images === undefined) return { text, images: [] };
  if (!Array.isArray(images)) throw new Malformed('the images are not a list');
  return { text, images: (images as unknown[]).map(imageIn) };
}

function imageIn(value: unknown): Image {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Malformed('an image is not an object');
  }
  const { format, base64 } = value as { format?: unknown; base64?: unknown };
  if (!isFormat(format)) {
    throw new Malformed(`an image is ${IMAGE_FORMATS.join(' or ')}, and the body says otherwise`);
  }
  if (typeof base64 !== 'string' || base64 === '' || base64.length % 4 !== 0) {
    throw new Malformed('the body carries no image encoded as base64');
  }
  if (!BASE64.test(base64)) throw new Malformed('the body carries no image encoded as base64');
  return { format, base64 };
}

function isFormat(value: unknown): value is ImageFormat {
  return IMAGE_FORMATS.some((format) => format === value);
}

async function sentIn(
  request: IncomingMessage,
  largest: number,
  tooMuch: string,
): Promise<object> {
  const body = await bodyOf(request, largest, tooMuch);
  let sent: unknown;
  try {
    sent = JSON.parse(body);
  } catch {
    throw new Malformed('the body is not JSON');
  }
  if (typeof sent !== 'object' || sent === null || Array.isArray(sent)) {
    throw new Malformed('the body is not an object');
  }
  return sent;
}

async function keysOf(request: IncomingMessage): Promise<Key[]> {
  const asked = await sentIn(
    request,
    LARGEST_KEYS,
    'the body names more keys than any press needs',
  );
  const { keys } = asked as { keys?: unknown };
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Malformed('the body names no keys to press');
  }
  return keys.map((key) => {
    if (typeof key !== 'string') throw new Malformed('a key was not named as text');
    if (!(KEYS as readonly string[]).includes(key)) throw new UnsupportedKey(key);
    return key as Key;
  });
}

async function bodyOf(
  request: IncomingMessage,
  largest: number,
  tooMuch: string,
): Promise<string> {
  let body = '';
  request.setEncoding('utf8');
  for await (const chunk of request) {
    body += chunk as string;
    if (body.length > largest) throw new TooMuch(tooMuch);
  }
  return body;
}

function reply(response: ServerResponse, status: number, body: unknown): void {
  if (body === null) {
    response.writeHead(status, { 'cache-control': 'no-store' });
    response.end();
    return;
  }
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
