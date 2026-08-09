import { PROTOCOL_VERSION } from '@viu/protocol';

import type { Machine } from '../machine';

import { httpMiddleman, type Fetching } from './http';

const THE_MACHINE: Machine = { host: 'desk.tail1234.ts.net', port: 8787 };

function answering(status: number, body: unknown): { fetching: Fetching; asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    fetching: (url) => {
      asked.push(url);
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
      );
    },
  };
}

function stalling<T>(signal: AbortSignal): Promise<T> {
  return new Promise((_never, giveUp) => {
    signal.addEventListener('abort', () => {
      const aborted = new Error('Aborted');
      aborted.name = 'AbortError';
      giveUp(aborted);
    });
  });
}

async function givingUp<T>(ask: () => Promise<T>): Promise<T> {
  jest.useFakeTimers();
  try {
    const answering = ask();
    await jest.advanceTimersByTimeAsync(PATIENCE_AND_MORE);
    return await answering;
  } finally {
    jest.useRealTimers();
  }
}

const PATIENCE_AND_MORE = 6000;

describe('greeting the middleman over HTTP', () => {
  test('asks the machine it was given, at the root', async () => {
    const { fetching, asked } = answering(200, {
      viu: 'middleman',
      protocol: PROTOCOL_VERSION,
      herdr: '0.7.5',
    });

    await httpMiddleman(THE_MACHINE, fetching).greet();

    expect(asked).toEqual(['http://desk.tail1234.ts.net:8787/']);
  });

  test('reads back the herdr the middleman greeted', async () => {
    const { fetching } = answering(200, {
      viu: 'middleman',
      protocol: PROTOCOL_VERSION,
      herdr: '0.7.5',
    });

    const reach = await httpMiddleman(THE_MACHINE, fetching).greet();

    expect(reach).toEqual({
      kind: 'reached',
      greeting: { viu: 'middleman', protocol: PROTOCOL_VERSION, herdr: '0.7.5' },
    });
  });

  test('calls a middleman speaking another protocol a mismatch, not a connection', async () => {
    const { fetching } = answering(200, {
      viu: 'middleman',
      protocol: PROTOCOL_VERSION + 1,
      herdr: '0.7.5',
    });

    const reach = await httpMiddleman(THE_MACHINE, fetching).greet();

    expect(reach.kind).toBe('trouble');
    expect(reach).toMatchObject({ trouble: { kind: 'protocol-mismatch' } });
  });

  test('passes back the trouble the middleman named', async () => {
    const { fetching } = answering(503, {
      kind: 'herdr-unreachable',
      message: 'herdr is not running',
    });

    const reach = await httpMiddleman(THE_MACHINE, fetching).greet();

    expect(reach).toEqual({
      kind: 'trouble',
      trouble: { kind: 'herdr-unreachable', message: 'herdr is not running' },
    });
  });

  test('reports a machine that does not answer as unreachable', async () => {
    const fetching: Fetching = () => Promise.reject(new Error('Network request failed'));

    const reach = await httpMiddleman(THE_MACHINE, fetching).greet();

    expect(reach).toEqual({ kind: 'unreachable', why: 'Network request failed' });
  });

  test('reports a machine that never answers as unreachable', async () => {
    const fetching: Fetching = (_url, { signal }) => stalling(signal);

    const reach = await givingUp(() => httpMiddleman(THE_MACHINE, fetching).greet());

    expect(reach).toEqual({ kind: 'unreachable', why: 'it did not answer in time' });
  });

  test('gives up on a machine that answers and then stalls the body', async () => {
    const fetching: Fetching = (_url, { signal }) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => stalling(signal),
      } as unknown as Response);

    const reach = await givingUp(() => httpMiddleman(THE_MACHINE, fetching).greet());

    expect(reach).toEqual({ kind: 'unreachable', why: 'it did not answer in time' });
  });

  test('refuses to take something else at that address for the middleman', async () => {
    const { fetching } = answering(200, { hello: 'i am a router' });

    const reach = await httpMiddleman(THE_MACHINE, fetching).greet();

    expect(reach.kind).toBe('not-the-middleman');
  });

  test('refuses a failure Viu has no name for', async () => {
    const { fetching } = answering(500, { kind: 'kaboom', message: 'something went wrong' });

    const reach = await httpMiddleman(THE_MACHINE, fetching).greet();

    expect(reach.kind).toBe('not-the-middleman');
  });
});
