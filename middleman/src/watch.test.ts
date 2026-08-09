import type { Conversation, Fleet, Update } from '@viu/protocol';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { createMiddleman } from './middleman.js';
import { createFakeHerdr, herdrPane } from './testing/fake-herdr.js';
import { CONTENT_POLL_MS } from './watch.js';

interface Client {
  readonly updates: readonly Update[];
  readonly receive: (update: Update) => void;
}

function client(): Client {
  const updates: Update[] = [];
  return {
    updates,
    receive: (update) => {
      updates.push(update);
    },
  };
}

function fleets(of: Client): readonly Fleet[] {
  return of.updates.flatMap((update) => (update.kind === 'fleet' ? [update.fleet] : []));
}

function conversations(of: Client): readonly Conversation[] {
  return of.updates.flatMap((update) =>
    update.kind === 'conversation' ? [update.conversation] : [],
  );
}

async function settled(): Promise<void> {
  for (let turn = 0; turn < 20; turn += 1) await Promise.resolve();
}

async function onePollLater(): Promise<void> {
  await vi.advanceTimersByTimeAsync(CONTENT_POLL_MS);
  await settled();
}

const thinking = herdrPane({ pane_id: 'w1:p1', agent: 'claude', agent_status: 'working' });
const asking = herdrPane({ pane_id: 'w1:p1', agent: 'claude', agent_status: 'blocked' });
const shell = herdrPane({ pane_id: 'w1:p2' });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('holding a connection open', () => {
  test('pushes the fleet down it without the client asking for anything', async () => {
    const herdr = createFakeHerdr([thinking, shell]);
    const phone = client();

    createMiddleman(herdr).connect(phone.receive);
    await settled();

    expect(fleets(phone).at(-1)?.panes.map((pane) => pane.id)).toEqual(['w1:p1', 'w1:p2']);
  });

  test('pushes the fleet again when a pane starts needing you', async () => {
    const herdr = createFakeHerdr([thinking, shell]);
    const phone = client();

    createMiddleman(herdr).connect(phone.receive);
    await settled();
    herdr.showPanes([asking, shell]);
    await settled();

    expect(fleets(phone).map((fleet) => fleet.panes[0]?.state)).toEqual(['thinking', 'needs-you']);
  });

  test('pushes the fleet when a pane joins it or leaves it', async () => {
    const herdr = createFakeHerdr([thinking]);
    const phone = client();

    createMiddleman(herdr).connect(phone.receive);
    await settled();
    herdr.showPanes([thinking, shell]);
    await settled();
    herdr.showPanes([shell]);
    await settled();

    expect(fleets(phone).map((fleet) => fleet.panes.map((pane) => pane.id))).toEqual([
      ['w1:p1'],
      ['w1:p1', 'w1:p2'],
      ['w1:p2'],
    ]);
  });

  test('stays quiet when herdr reports a change the phone would not see', async () => {
    const herdr = createFakeHerdr([thinking]);
    const phone = client();

    createMiddleman(herdr).connect(phone.receive);
    await settled();
    herdr.showPanes([{ ...thinking, focused: true, revision: 41 }]);
    await settled();

    expect(fleets(phone)).toHaveLength(1);
  });

  test('pushes nothing more once the client has closed the connection', async () => {
    const herdr = createFakeHerdr([thinking]);
    const phone = client();

    const connection = createMiddleman(herdr).connect(phone.receive);
    await settled();
    connection.close();
    herdr.showPanes([asking]);
    await settled();

    expect(fleets(phone)).toHaveLength(1);
  });

  test('listens to herdr only while a client is connected', async () => {
    const herdr = createFakeHerdr([thinking]);

    expect(herdr.subscriptions()).toBe(0);
    const connection = createMiddleman(herdr).connect(client().receive);
    await settled();

    expect(herdr.subscriptions()).toBe(1);
    connection.close();
    expect(herdr.subscriptions()).toBe(0);
  });
});

describe('several clients at once', () => {
  test('each gets the fleet on connecting and every change after it', async () => {
    const herdr = createFakeHerdr([thinking]);
    const middleman = createMiddleman(herdr);
    const phone = client();
    const tablet = client();

    middleman.connect(phone.receive);
    middleman.connect(tablet.receive);
    await settled();
    herdr.showPanes([asking]);
    await settled();

    expect(fleets(phone).map((fleet) => fleet.panes[0]?.state)).toEqual(['thinking', 'needs-you']);
    expect(fleets(tablet).map((fleet) => fleet.panes[0]?.state)).toEqual(['thinking', 'needs-you']);
  });

  test('one closing leaves the other still receiving', async () => {
    const herdr = createFakeHerdr([thinking]);
    const middleman = createMiddleman(herdr);
    const phone = client();
    const tablet = client();

    middleman.connect(phone.receive).close();
    middleman.connect(tablet.receive);
    await settled();
    herdr.showPanes([asking]);
    await settled();

    expect(fleets(phone)).toHaveLength(0);
    expect(fleets(tablet)).toHaveLength(2);
  });
});

describe('watching a pane', () => {
  test('pushes its conversation straight away, before anything has changed', async () => {
    const herdr = createFakeHerdr([shell]);
    herdr.showScreen('w1:p2', 'the deploy finished');
    const phone = client();

    createMiddleman(herdr).connect(phone.receive).watch('w1:p2');
    await settled();

    expect(conversations(phone)).toEqual([
      { paneId: 'w1:p2', turns: [{ role: 'pane', text: 'the deploy finished', cut: false }] },
    ]);
  });

  test('pushes new output without the client asking for it', async () => {
    const herdr = createFakeHerdr([shell]);
    herdr.showScreen('w1:p2', 'running the tests');
    const phone = client();

    createMiddleman(herdr).connect(phone.receive).watch('w1:p2');
    await settled();
    herdr.showScreen('w1:p2', 'running the tests\r\n58 passed');
    await onePollLater();

    expect(conversations(phone).map((each) => each.turns[0]?.text)).toEqual([
      'running the tests',
      'running the tests\n58 passed',
    ]);
  });

  test('stays quiet while the pane says nothing new', async () => {
    const herdr = createFakeHerdr([shell]);
    herdr.showScreen('w1:p2', 'waiting for something to happen');
    const phone = client();

    createMiddleman(herdr).connect(phone.receive).watch('w1:p2');
    await settled();
    await onePollLater();
    await onePollLater();
    await onePollLater();

    expect(conversations(phone)).toHaveLength(1);
  });

  test('reads only the pane being watched, however busy the rest of the fleet is', async () => {
    const herdr = createFakeHerdr([thinking, shell]);
    const phone = client();

    createMiddleman(herdr).connect(phone.receive).watch('w1:p2');
    await settled();
    herdr.showScreen('w1:p1', 'another agent is talking to itself');
    await onePollLater();
    await onePollLater();

    expect(new Set(herdr.reads())).toEqual(new Set(['w1:p2']));
  });

  test('stops reading the pane when the client stops watching it', async () => {
    const herdr = createFakeHerdr([shell]);
    const phone = client();

    const connection = createMiddleman(herdr).connect(phone.receive);
    connection.watch('w1:p2');
    await settled();
    await onePollLater();
    const readsWhileWatching = herdr.reads().length;

    connection.stopWatching();
    await onePollLater();
    await onePollLater();
    await onePollLater();

    expect(readsWhileWatching).toBeGreaterThan(0);
    expect(herdr.reads()).toHaveLength(readsWhileWatching);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('stops reading the pane when the client closes the connection', async () => {
    const herdr = createFakeHerdr([shell]);
    const phone = client();

    const connection = createMiddleman(herdr).connect(phone.receive);
    connection.watch('w1:p2');
    await settled();
    const readsWhileWatching = herdr.reads().length;

    connection.close();
    await onePollLater();
    await onePollLater();

    expect(herdr.reads()).toHaveLength(readsWhileWatching);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('stops reading the pane it left when the client opens another', async () => {
    const herdr = createFakeHerdr([thinking, shell]);
    const phone = client();

    const connection = createMiddleman(herdr).connect(phone.receive);
    connection.watch('w1:p2');
    await settled();
    connection.watch('w1:p1');
    await settled();
    const readSoFar = herdr.reads().length;
    await onePollLater();

    expect(herdr.reads().slice(readSoFar)).toEqual(['w1:p1']);
  });

  test('tells the client a pane needs you while it is watching a different one', async () => {
    const herdr = createFakeHerdr([thinking, shell]);
    herdr.showScreen('w1:p2', 'nothing to see here');
    const phone = client();

    createMiddleman(herdr).connect(phone.receive).watch('w1:p2');
    await settled();
    herdr.showPanes([asking, shell]);
    await settled();

    expect(fleets(phone).at(-1)?.panes[0]).toMatchObject({ id: 'w1:p1', state: 'needs-you' });
    expect(conversations(phone).map((each) => each.paneId)).toEqual(['w1:p2']);
  });
});

describe('several clients watching', () => {
  test('each receives the pane it opened and no other', async () => {
    const herdr = createFakeHerdr([thinking, shell]);
    herdr.showScreen('w1:p1', 'the agent is thinking');
    herdr.showScreen('w1:p2', 'the shell is idle');
    const middleman = createMiddleman(herdr);
    const phone = client();
    const tablet = client();

    middleman.connect(phone.receive).watch('w1:p1');
    middleman.connect(tablet.receive).watch('w1:p2');
    await settled();

    expect(conversations(phone).map((each) => each.paneId)).toEqual(['w1:p1']);
    expect(conversations(tablet).map((each) => each.paneId)).toEqual(['w1:p2']);
  });

  test('one read serves everyone watching the same pane', async () => {
    const herdr = createFakeHerdr([shell]);
    herdr.showScreen('w1:p2', 'before');
    const middleman = createMiddleman(herdr);
    const phone = client();
    const tablet = client();

    middleman.connect(phone.receive).watch('w1:p2');
    middleman.connect(tablet.receive).watch('w1:p2');
    await settled();
    const readsOnOpening = herdr.reads().length;
    herdr.showScreen('w1:p2', 'after');
    await onePollLater();

    expect(readsOnOpening).toBe(1);
    expect(herdr.reads()).toHaveLength(2);
    expect(conversations(phone).map((each) => each.turns[0]?.text)).toEqual(['before', 'after']);
    expect(conversations(tablet).map((each) => each.turns[0]?.text)).toEqual(['before', 'after']);
  });

  test('keeps reading a pane until the last client watching it leaves', async () => {
    const herdr = createFakeHerdr([shell]);
    const middleman = createMiddleman(herdr);
    const staying = middleman.connect(client().receive);
    const leaving = middleman.connect(client().receive);

    staying.watch('w1:p2');
    leaving.watch('w1:p2');
    await settled();
    leaving.close();
    const readsBefore = herdr.reads().length;
    await onePollLater();

    expect(herdr.reads()).toHaveLength(readsBefore + 1);

    staying.close();
    await onePollLater();

    expect(herdr.reads()).toHaveLength(readsBefore + 1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
