import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer, type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { attachmentsIn } from './attachments.js';
import { HerdrProtocolMismatch, NoTailnet, NotTheTailnet } from './errors.js';
import { portFrom, serveMiddleman, type Service } from './service.js';
import {
  createFakeHerdr,
  herdrAnswering,
  herdrPane,
  type FakeHerdr,
} from './testing/fake-herdr.js';

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
const swept: string[] = [];

afterEach(async () => {
  await running?.close();
  running = null;
  for (const directory of swept.splice(0)) await rm(directory, { recursive: true, force: true });
});

async function serve(
  herdr: FakeHerdr,
  addresses: readonly string[] = [HERE],
  port = 0,
): Promise<Service> {
  running = await serveMiddleman({ herdr, addresses, port });
  return running;
}

async function keptSomewhere(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'viu-service-'));
  swept.push(directory);
  return directory;
}

async function serving(herdr: FakeHerdr, directory: string): Promise<Service> {
  running = await serveMiddleman({
    herdr,
    addresses: [HERE],
    port: 0,
    attachments: attachmentsIn({ directory }),
  });
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

  test('takes an image on the tailnet address alone, and nowhere else on the machine', async () => {
    const service = await serving(createFakeHerdr([agentPane]), await keptSomewhere());
    const port = portOf(service.urls[0] ?? '');
    const image = {
      method: 'POST',
      body: JSON.stringify({ format: 'jpeg', base64: 'AAAA', caption: null }),
    };

    await expect(fetch(`http://${HERE}:${port}/panes/w2%3Ap6J/image`, image)).resolves.toMatchObject(
      { ok: true },
    );
    await expect(fetch(`http://${ELSEWHERE}:${port}/panes/w2%3Ap6J/image`, image)).rejects.toThrow();
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
    expect(await answer.json()).toMatchObject({ kind: 'pane-gone', paneId: 'w9:p9' });
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
    expect(await answer.json()).toMatchObject({ kind: 'unsupported-key', key: 'page-up' });
    expect(herdr.delivered()).toEqual([]);
  });

  test('says a pane it is asked to read is gone, rather than blaming herdr for refusing', async () => {
    const answer = await asked(await serve(createFakeHerdr()), '/panes/w9%3Ap9/conversation');

    expect(answer.status).toBe(404);
    expect(await answer.json()).toMatchObject({ kind: 'pane-gone', paneId: 'w9:p9' });
  });

  test('keeps a herdr refusal apart from a pane that is gone and from its own faults', async () => {
    const herdr = createFakeHerdr([agentPane]);
    herdr.refuses('pane.read', 'internal_error', 'the pane runtime is unavailable');

    const answer = await asked(await serve(herdr), '/panes/w2%3Ap6J/conversation');

    expect(answer.status).toBe(502);
    expect(await answer.json()).toMatchObject({ kind: 'herdr-refused' });
  });

  test('says a pane would not take the input apart from a pane that is gone', async () => {
    const herdr = createFakeHerdr([agentPane]);
    herdr.refuses('agent.prompt', 'agent_prompt_stalled', 'agent prompt stalled');
    const service = await serve(herdr);

    const answer = await fetch(`${service.urls[0] ?? ''}/panes/w2%3Ap6J/send`, {
      method: 'POST',
      body: JSON.stringify({ text: 'the second one' }),
    });

    expect(answer.status).toBe(409);
    expect(await answer.json()).toMatchObject({
      kind: 'pane-not-accepting-input',
      paneId: 'w2:p6J',
    });
  });

  test('says the machine is unreachable when herdr goes away under it', async () => {
    const herdr = createFakeHerdr([agentPane]);
    const service = await serve(herdr);

    await expect(asked(service, '/fleet')).resolves.toMatchObject({ ok: true });
    herdr.goesAway();
    const answer = await asked(service, '/fleet');

    expect(answer.status).toBe(503);
    expect(await answer.json()).toMatchObject({ kind: 'herdr-unreachable' });
  });

  test('owns a fault of its own rather than blaming herdr or the pane for it', async () => {
    const confused = herdrAnswering((method) =>
      Promise.resolve(
        method === 'ping' ? { type: 'pong', version: '0.7.5', protocol: 17 } : { type: 'pane_list' },
      ),
    );
    running = await serveMiddleman({ herdr: confused, addresses: [HERE], port: 0 });

    const answer = await fetch(`${running.urls[0] ?? ''}/fleet`);

    expect(answer.status).toBe(500);
    expect(await answer.json()).toMatchObject({ kind: 'middleman-failed' });
  });

  test('says so when asked for something it does not serve', async () => {
    const answer = await asked(await serve(createFakeHerdr()), '/panes');

    expect(answer.status).toBe(404);
    expect(await answer.json()).toMatchObject({ kind: 'no-such-endpoint' });
  });

  test('turns down a send it cannot read as a send', async () => {
    const service = await serve(createFakeHerdr([agentPane]));

    const answer = await fetch(`${service.urls[0] ?? ''}/panes/w2%3Ap6J/send`, {
      method: 'POST',
      body: 'not json at all',
    });

    expect(answer.status).toBe(400);
    expect(await answer.json()).toMatchObject({ kind: 'malformed-request' });
  });

  test('takes an image for a pane, keeps it, and answers with the guarantee it got', async () => {
    const herdr = createFakeHerdr([agentPane]);
    const directory = await keptSomewhere();
    const service = await serving(herdr, directory);

    const answer = await fetch(`${service.urls[0] ?? ''}/panes/w2%3Ap6J/image`, {
      method: 'POST',
      body: JSON.stringify({
        format: 'jpeg',
        base64: Buffer.from('a screenshot').toString('base64'),
        caption: 'this button is wrong',
      }),
    });

    expect(await answer.json()).toEqual({
      paneId: 'w2:p6J',
      confidence: 'confirmed',
      state: 'thinking',
    });
    const [kept] = await readdir(directory);
    expect(herdr.delivered()[0]?.text).toBe(
      `this button is wrong\n\nImage: ${join(directory, kept ?? '')}`,
    );
  });

  test('says a pane an image was sent to is gone, with a status of its own', async () => {
    const service = await serving(createFakeHerdr([agentPane]), await keptSomewhere());

    const answer = await fetch(`${service.urls[0] ?? ''}/panes/w9%3Ap9/image`, {
      method: 'POST',
      body: JSON.stringify({ format: 'png', base64: 'AAAA', caption: null }),
    });

    expect(answer.status).toBe(404);
    expect(await answer.json()).toMatchObject({ kind: 'pane-gone', paneId: 'w9:p9' });
  });

  test('turns down an image in a format Viu does not name, before anything is written', async () => {
    const herdr = createFakeHerdr([agentPane]);
    const directory = await keptSomewhere();
    const service = await serving(herdr, directory);

    const answer = await fetch(`${service.urls[0] ?? ''}/panes/w2%3Ap6J/image`, {
      method: 'POST',
      body: JSON.stringify({ format: 'heic', base64: 'AAAA', caption: null }),
    });

    expect(answer.status).toBe(400);
    expect(await answer.json()).toMatchObject({ kind: 'malformed-request' });
    expect(herdr.delivered()).toEqual([]);
    await expect(readdir(directory)).resolves.toEqual([]);
  });

  test('turns down a body that carries no image, rather than sending an empty attachment', async () => {
    const herdr = createFakeHerdr([agentPane]);
    const service = await serving(herdr, await keptSomewhere());

    for (const body of [
      { format: 'jpeg', caption: null },
      { format: 'jpeg', base64: 'not base64!!', caption: null },
      { format: 'jpeg', base64: 'AAAA', caption: 7 },
    ]) {
      const answer = await fetch(`${service.urls[0] ?? ''}/panes/w2%3Ap6J/image`, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      expect(answer.status).toBe(400);
      expect(await answer.json()).toMatchObject({ kind: 'malformed-request' });
    }
    expect(herdr.delivered()).toEqual([]);
  });

  test('says the image was never stored, rather than blaming herdr or falling over', async () => {
    const herdr = createFakeHerdr([agentPane]);
    const directory = join(await keptSomewhere(), 'taken');
    await writeFile(directory, 'not a directory');
    const service = await serving(herdr, directory);

    const answer = await fetch(`${service.urls[0] ?? ''}/panes/w2%3Ap6J/image`, {
      method: 'POST',
      body: JSON.stringify({ format: 'jpeg', base64: 'AAAA', caption: null }),
    });

    expect(answer.status).toBe(500);
    expect(await answer.json()).toMatchObject({ kind: 'attachment-not-stored' });
    expect(herdr.delivered()).toEqual([]);
  });

  test('takes an image far larger than a send, and turns down one larger than any photo', async () => {
    const directory = await keptSomewhere();
    const service = await serving(createFakeHerdr([agentPane]), directory);

    const big = await fetch(`${service.urls[0] ?? ''}/panes/w2%3Ap6J/image`, {
      method: 'POST',
      body: JSON.stringify({ format: 'jpeg', base64: 'A'.repeat(400_000), caption: null }),
    });
    const enormous = await fetch(`${service.urls[0] ?? ''}/panes/w2%3Ap6J/image`, {
      method: 'POST',
      body: JSON.stringify({ format: 'jpeg', base64: 'A'.repeat(20_000_000), caption: null }),
    });

    expect(big.status).toBe(200);
    expect(enormous.status).toBe(413);
    expect(await enormous.json()).toMatchObject({ kind: 'too-much' });
    await expect(readdir(directory)).resolves.toHaveLength(1);
  });

  test('turns down a body far larger than anything a person dictates', async () => {
    const service = await serve(createFakeHerdr([agentPane]));

    const answer = await fetch(`${service.urls[0] ?? ''}/panes/w2%3Ap6J/send`, {
      method: 'POST',
      body: JSON.stringify({ text: 'x'.repeat(200_000) }),
    });

    expect(answer.status).toBe(413);
    expect(await answer.json()).toMatchObject({ kind: 'too-much' });
  });
});
