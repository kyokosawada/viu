import type { Conversation, Fleet, Trouble, Update } from '@viu/protocol';
import { afterEach, describe, expect, test } from 'vitest';
import { WebSocket } from 'ws';

import { serveMiddleman, type Service } from './service.js';
import { createFakeHerdr, herdrPane, type FakeHerdr } from './testing/fake-herdr.js';

const HERE = '127.0.0.2';

const PATIENCE = 4000;

const thinking = herdrPane({ pane_id: 'w1:p1', agent: 'claude', agent_status: 'working' });
const asking = herdrPane({ pane_id: 'w1:p1', agent: 'claude', agent_status: 'blocked' });
const shell = herdrPane({ pane_id: 'w1:p2' });

let running: Service | null = null;
const held: Phone[] = [];

afterEach(async () => {
  for (const phone of held) phone.close();
  held.length = 0;
  await running?.close();
  running = null;
});

interface Phone {
  readonly updates: readonly Update[];
  watch(paneId: string): void;
  stopWatching(): void;
  says(message: string): void;
  close(): void;
}

async function serve(herdr: FakeHerdr): Promise<Service> {
  running = await serveMiddleman({ herdr, addresses: [HERE], port: 0 });
  return running;
}

async function phoneOn(service: Service): Promise<Phone> {
  const socket = new WebSocket(`${(service.urls[0] ?? '').replace('http://', 'ws://')}/updates`);
  const updates: Update[] = [];
  socket.on('message', (data) => {
    updates.push(JSON.parse(Buffer.isBuffer(data) ? data.toString('utf8') : '') as Update);
  });
  await new Promise<void>((open, fail) => {
    socket.once('open', open);
    socket.once('error', fail);
  });

  const phone: Phone = {
    updates,
    watch: (paneId) => {
      socket.send(JSON.stringify({ kind: 'watch', paneId }));
    },
    stopWatching: () => {
      socket.send(JSON.stringify({ kind: 'stop-watching' }));
    },
    says: (message) => {
      socket.send(message);
    },
    close: () => {
      socket.close();
    },
  };
  held.push(phone);
  return phone;
}

async function until<Told>(told: () => Told | undefined, wanted: string): Promise<Told> {
  const giveUpAt = Date.now() + PATIENCE;
  for (;;) {
    const seen = told();
    if (seen !== undefined) return seen;
    if (Date.now() > giveUpAt) throw new Error(`nothing ${wanted} arrived on the connection`);
    await new Promise((again) => setTimeout(again, 10));
  }
}

function fleets(phone: Phone): readonly Fleet[] {
  return phone.updates.flatMap((update) => (update.kind === 'fleet' ? [update.fleet] : []));
}

function conversations(phone: Phone): readonly Conversation[] {
  return phone.updates.flatMap((update) =>
    update.kind === 'conversation' ? [update.conversation] : [],
  );
}

function troubles(phone: Phone): readonly Trouble[] {
  return phone.updates.flatMap((update) => (update.kind === 'trouble' ? [update.trouble] : []));
}

function lastFleet(phone: Phone): () => Fleet | undefined {
  return () => fleets(phone).at(-1);
}

describe('the connection the phone holds open', () => {
  test('pushes the fleet down it without the phone asking for anything', async () => {
    const phone = await phoneOn(await serve(createFakeHerdr([thinking, shell])));

    const fleet = await until(lastFleet(phone), 'of the fleet');

    expect(fleet.panes.map((pane) => pane.id)).toEqual(['w1:p1', 'w1:p2']);
  });

  test('pushes a pane that starts needing you while the phone is inside a different pane', async () => {
    const herdr = createFakeHerdr([thinking, shell]);
    const phone = await phoneOn(await serve(herdr));
    herdr.showScreen('w1:p2', '$ ');
    phone.watch('w1:p2');
    await until(() => conversations(phone).at(-1), 'of the pane being watched');

    herdr.showPanes([asking, shell]);

    const fleet = await until(
      () => (fleets(phone).at(-1)?.panes[0]?.state === 'needs-you' ? fleets(phone).at(-1) : undefined),
      'saying a pane needs you',
    );
    expect(fleet.panes[0]?.id).toBe('w1:p1');
  });

  test('pushes the conversation of the pane it is told to watch, and its later output', async () => {
    const herdr = createFakeHerdr([shell]);
    herdr.showScreen('w1:p2', '$ npm test');
    const phone = await phoneOn(await serve(herdr));

    phone.watch('w1:p2');
    const first = await until(() => conversations(phone).at(-1), 'of the pane');
    expect(first.turns[0]?.text).toContain('npm test');

    herdr.showScreen('w1:p2', '$ npm test\nall good');
    const later = await until(
      () => conversations(phone).find((seen) => seen.turns[0]?.text.includes('all good')),
      'carrying what the pane printed next',
    );
    expect(later.paneId).toBe('w1:p2');
  });

  test('stops reading a pane once the phone stops watching it', async () => {
    const herdr = createFakeHerdr([shell]);
    herdr.showScreen('w1:p2', '$ ');
    const phone = await phoneOn(await serve(herdr));
    phone.watch('w1:p2');
    await until(() => conversations(phone).at(-1), 'of the pane');

    phone.stopWatching();
    await until(() => (herdr.reads().length > 0 ? true : undefined), 'read of the pane');
    const readSoFar = herdr.reads().length;
    await new Promise((later) => setTimeout(later, 1200));

    expect(herdr.reads().length).toBe(readSoFar);
  });

  test('stops reading a pane once the phone puts the connection down', async () => {
    const herdr = createFakeHerdr([shell]);
    herdr.showScreen('w1:p2', '$ ');
    const phone = await phoneOn(await serve(herdr));
    phone.watch('w1:p2');
    await until(() => conversations(phone).at(-1), 'of the pane');

    phone.close();
    await until(() => (herdr.subscriptions() === 0 ? true : undefined), 'end of the subscription');
    const readSoFar = herdr.reads().length;
    await new Promise((later) => setTimeout(later, 1200));

    expect(herdr.reads().length).toBe(readSoFar);
  });

  test('names a trouble on the same connection rather than dropping it', async () => {
    const herdr = createFakeHerdr([shell]);
    const phone = await phoneOn(await serve(herdr));
    await until(lastFleet(phone), 'of the fleet');

    phone.watch('w9:pX');

    const trouble = await until(() => troubles(phone).at(-1), 'naming a trouble');
    expect(trouble.kind).toBe('pane-gone');
  });

  test('refuses something it cannot read as a thing to watch, and stays open', async () => {
    const herdr = createFakeHerdr([shell]);
    const phone = await phoneOn(await serve(herdr));
    await until(lastFleet(phone), 'of the fleet');

    phone.says('watch it then');

    const trouble = await until(() => troubles(phone).at(-1), 'naming a trouble');
    expect(trouble.kind).toBe('malformed-request');

    herdr.showPanes([asking]);
    await until(
      () => (fleets(phone).at(-1)?.panes[0]?.state === 'needs-you' ? true : undefined),
      'of the fleet after it',
    );
  });
});
