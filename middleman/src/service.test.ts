import { createServer, type AddressInfo } from 'node:net';

import { afterEach, describe, expect, test } from 'vitest';

import { HerdrProtocolMismatch, NoTailnet, NotTheTailnet } from './errors.js';
import { portFrom, serveMiddleman, type Service } from './service.js';
import { createFakeHerdr, herdrPane, type FakeHerdr } from './testing/fake-herdr.js';

const HERE = '127.0.0.2';
const ELSEWHERE = '127.0.0.1';

const agentPane = herdrPane({
  pane_id: 'w2:p6J',
  agent: 'claude',
  display_agent: 'Claude',
  agent_status: 'blocked',
  cwd: '/home/gcpaps/dev/viu',
});

let running: Service | null = null;

afterEach(async () => {
  await running?.close();
  running = null;
});

async function serve(
  herdr: FakeHerdr,
  addresses: readonly string[] = [HERE],
  port = 0,
): Promise<Service> {
  running = await serveMiddleman({ herdr, addresses, port });
  return running;
}

function portOf(url: string): number {
  return Number(new URL(url).port);
}

async function freePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((ready) => probe.listen(0, HERE, ready));
  const { port } = probe.address() as AddressInfo;
  await new Promise<void>((closed) => {
    probe.close(() => {
      closed();
    });
  });
  return port;
}

async function nothingHolds(port: number): Promise<boolean> {
  const probe = createServer();
  return new Promise<boolean>((answer) => {
    probe.once('error', () => {
      answer(false);
    });
    probe.listen(port, HERE, () => {
      probe.close(() => {
        answer(true);
      });
    });
  });
}

describe('binding to the tailnet and nothing else', () => {
  test('listens on exactly the address it was given', async () => {
    const service = await serve(createFakeHerdr());

    expect(service.urls).toEqual([expect.stringMatching(new RegExp(`^http://${HERE}:\\d+$`))]);
  });

  test('is unreachable on another address of the same machine, on the same port', async () => {
    const service = await serve(createFakeHerdr([agentPane]));
    const port = portOf(service.urls[0] ?? '');

    await expect(fetch(`http://${HERE}:${port}/fleet`)).resolves.toMatchObject({ ok: true });
    await expect(fetch(`http://${ELSEWHERE}:${port}/fleet`)).rejects.toThrow();
  });

  test('listens on every tailnet address it is given, because MagicDNS answers with both', async () => {
    const service = await serve(createFakeHerdr(), [HERE, '127.0.0.3']);

    expect(service.urls).toHaveLength(2);
    for (const url of service.urls) {
      await expect(fetch(`${url}/fleet`)).resolves.toMatchObject({ ok: true });
    }
  });

  test('refuses to serve with no address rather than falling back to all of them', async () => {
    const nowhere = serveMiddleman({ herdr: createFakeHerdr(), addresses: [], port: 0 });

    await expect(nowhere).rejects.toThrow(NoTailnet);
  });

  test('refuses every interface even when it is handed one, and leaves the port free', async () => {
    const port = await freePort();

    for (const everywhere of ['0.0.0.0', '::', '']) {
      const asked = serveMiddleman({ herdr: createFakeHerdr(), addresses: [everywhere], port });
      await expect(asked).rejects.toThrow(NotTheTailnet);
    }
    await expect(nothingHolds(port)).resolves.toBe(true);
  });

  test('refuses every interface even when a tailnet address is offered alongside it', async () => {
    const both = serveMiddleman({
      herdr: createFakeHerdr(),
      addresses: [HERE, '0.0.0.0'],
      port: 0,
    });

    await expect(both).rejects.toThrow(NotTheTailnet);
  });

  test('takes the port from the environment, and refuses one that is not a port', () => {
    expect(portFrom(undefined)).toBe(8787);
    expect(portFrom('9000')).toBe(9000);
    expect(() => portFrom('herdr')).toThrow(/port/i);
    expect(() => portFrom('70000')).toThrow(/port/i);
  });
});

describe('checking herdr before opening anything', () => {
  test('refuses a protocol it does not understand and leaves the port free', async () => {
    const herdr = createFakeHerdr();
    herdr.speaksProtocol(19, '0.9.0');
    const port = await freePort();

    await expect(serveMiddleman({ herdr, addresses: [HERE], port })).rejects.toThrow(
      HerdrProtocolMismatch,
    );
    await expect(nothingHolds(port)).resolves.toBe(true);
  });

  test('names the herdr it greeted once it is serving', async () => {
    const service = await serve(createFakeHerdr());

    expect(service.herdr).toBe('0.7.5');
  });
});

describe('what the phone can ask the middleman for', () => {
  async function asked(service: Service, path: string): Promise<Response> {
    return fetch(`${service.urls[0] ?? ''}${path}`);
  }

  test('answers at the root, so reachability can be checked from a phone browser', async () => {
    const answer = await asked(await serve(createFakeHerdr()), '/');

    expect(await answer.json()).toMatchObject({ viu: 'middleman' });
  });

  test('hands over the fleet as the phone would receive it', async () => {
    const answer = await asked(await serve(createFakeHerdr([agentPane])), '/fleet');

    expect(await answer.json()).toEqual({
      panes: [
        {
          id: 'w2:p6J',
          project: 'viu',
          agent: 'Claude',
          activity: null,
          state: 'needs-you',
        },
      ],
    });
  });

  test('hands over a pane as a conversation', async () => {
    const herdr = createFakeHerdr([agentPane]);
    herdr.showScreen('w2:p6J', '● Ready when you are\n');

    const answer = await asked(await serve(herdr), '/panes/w2%3Ap6J/conversation');

    expect(await answer.json()).toEqual({
      paneId: 'w2:p6J',
      turns: [{ role: 'agent', text: 'Ready when you are', cut: false }],
    });
  });

  test('takes an answer for a pane and reports the guarantee it got', async () => {
    const service = await serve(createFakeHerdr([agentPane]));

    const answer = await fetch(`${service.urls[0] ?? ''}/panes/w2%3Ap6J/send`, {
      method: 'POST',
      body: JSON.stringify({ text: 'use the second one' }),
    });

    expect(await answer.json()).toEqual({
      paneId: 'w2:p6J',
      confidence: 'confirmed',
      state: 'thinking',
    });
  });

  test('says a pane is gone with a status of its own, not a generic failure', async () => {
    const service = await serve(createFakeHerdr([agentPane]));

    const answer = await fetch(`${service.urls[0] ?? ''}/panes/w9%3Ap9/send`, {
      method: 'POST',
      body: JSON.stringify({ text: 'anyone home' }),
    });

    expect(answer.status).toBe(404);
    expect(await answer.json()).toMatchObject({ error: 'pane-gone', paneId: 'w9:p9' });
  });

  test('presses named keys into a pane', async () => {
    const herdr = createFakeHerdr([agentPane]);
    const service = await serve(herdr);

    const answer = await fetch(`${service.urls[0] ?? ''}/panes/w2%3Ap6J/keys`, {
      method: 'POST',
      body: JSON.stringify({ keys: ['down', 'enter'] }),
    });

    expect(answer.status).toBe(204);
    expect(await answer.text()).toBe('');
    expect(herdr.delivered()).toEqual([{ paneId: 'w2:p6J', text: null, submits: true }]);
  });

  test('turns down a key Viu has no name for rather than passing it through', async () => {
    const herdr = createFakeHerdr([agentPane]);
    const service = await serve(herdr);

    const answer = await fetch(`${service.urls[0] ?? ''}/panes/w2%3Ap6J/keys`, {
      method: 'POST',
      body: JSON.stringify({ keys: ['page-up'] }),
    });

    expect(answer.status).toBe(400);
    expect(await answer.json()).toMatchObject({ error: 'unsupported-key' });
    expect(herdr.delivered()).toEqual([]);
  });

  test('keeps a herdr refusal apart from a pane that is gone and from its own faults', async () => {
    const answer = await asked(await serve(createFakeHerdr()), '/panes/w9%3Ap9/conversation');

    expect(answer.status).toBe(502);
    expect(await answer.json()).toMatchObject({ error: 'herdr-refused' });
  });

  test('says so when asked for something it does not serve', async () => {
    const answer = await asked(await serve(createFakeHerdr()), '/panes');

    expect(answer.status).toBe(404);
    expect(await answer.json()).toMatchObject({ error: 'no-such-endpoint' });
  });

  test('turns down a send it cannot read as a send', async () => {
    const service = await serve(createFakeHerdr([agentPane]));

    const answer = await fetch(`${service.urls[0] ?? ''}/panes/w2%3Ap6J/send`, {
      method: 'POST',
      body: 'not json at all',
    });

    expect(answer.status).toBe(400);
    expect(await answer.json()).toMatchObject({ error: 'malformed-request' });
  });

  test('turns down a body far larger than anything a person dictates', async () => {
    const service = await serve(createFakeHerdr([agentPane]));

    const answer = await fetch(`${service.urls[0] ?? ''}/panes/w2%3Ap6J/send`, {
      method: 'POST',
      body: JSON.stringify({ text: 'x'.repeat(200_000) }),
    });

    expect(answer.status).toBe(413);
  });
});
