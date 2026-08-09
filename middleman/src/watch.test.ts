import type { Conversation, Fleet, Trouble, Update } from '@viu/protocol';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { createMiddleman } from './middleman.js';
import { createFakeHerdr, herdrPane } from './testing/fake-herdr.js';
import { CONTENT_POLL_MS, HERDR_RETRY_MS } from './watch.js';

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

function troubles(of: Client): readonly Trouble[] {
  return of.updates.flatMap((update) => (update.kind === 'trouble' ? [update.trouble] : []));
}

function kinds(of: Client): readonly string[] {
  return troubles(of).map((trouble) => trouble.kind);
}

async function onePollLater(): Promise<void> {
  await vi.advanceTimersByTimeAsync(CONTENT_POLL_MS);
  await settled();
}

async function oneRetryLater(): Promise<void> {
  await vi.advanceTimersByTimeAsync(HERDR_RETRY_MS);
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

  test('a client connecting later is told the fleet even though nothing has changed', async () => {
    const herdr = createFakeHerdr([thinking]);
    const middleman = createMiddleman(herdr);
    const phone = client();
    const tablet = client();

    middleman.connect(phone.receive);
    await settled();
    middleman.connect(tablet.receive);
    await settled();

    expect(fleets(phone)).toHaveLength(1);
    expect(fleets(tablet)).toHaveLength(1);
  });

  test('a client connecting while the fleet moves does not silence the ones already on', async () => {
    const herdr = createFakeHerdr([thinking, shell]);
    const middleman = createMiddleman(herdr);
    const phone = client();
    const tablet = client();

    middleman.connect(phone.receive);
    await settled();
    herdr.showPanes([asking, shell]);
    middleman.connect(tablet.receive);
    await settled();

    expect(fleets(phone).at(-1)?.panes[0]).toMatchObject({ state: 'needs-you' });
    expect(fleets(tablet).at(-1)?.panes[0]).toMatchObject({ state: 'needs-you' });
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

describe('when the pane being watched disappears', () => {
  test('says that pane is gone, and names it, rather than a failure the phone cannot read', async () => {
    const herdr = createFakeHerdr([thinking, shell]);
    herdr.showScreen('w1:p2', 'the deploy finished');
    const phone = client();

    createMiddleman(herdr).connect(phone.receive).watch('w1:p2');
    await settled();
    herdr.showPanes([thinking]);
    await onePollLater();

    expect(troubles(phone)).toEqual([
      { kind: 'pane-gone', paneId: 'w1:p2', message: 'pane w1:p2 is no longer in the fleet' },
    ]);
  });

  test('stops reading it, because there is nothing left there to read', async () => {
    const herdr = createFakeHerdr([thinking, shell]);
    const phone = client();

    createMiddleman(herdr).connect(phone.receive).watch('w1:p2');
    await settled();
    herdr.showPanes([thinking]);
    await onePollLater();

    expect(vi.getTimerCount()).toBe(0);
  });

  test('leaves a client reading a pane that is still there untouched', async () => {
    const herdr = createFakeHerdr([thinking, shell]);
    herdr.showScreen('w1:p1', 'still working');
    const middleman = createMiddleman(herdr);
    const phone = client();
    const tablet = client();

    middleman.connect(phone.receive).watch('w1:p2');
    middleman.connect(tablet.receive).watch('w1:p1');
    await settled();
    herdr.showPanes([thinking]);
    await onePollLater();

    expect(kinds(phone)).toEqual(['pane-gone']);
    expect(kinds(tablet)).toEqual([]);
  });
});

describe('when herdr goes away mid-stream', () => {
  test('says the machine is unreachable, which is not the same as a pane going away', async () => {
    const herdr = createFakeHerdr([shell]);
    herdr.showScreen('w1:p2', 'the deploy finished');
    const phone = client();

    createMiddleman(herdr).connect(phone.receive).watch('w1:p2');
    await settled();
    herdr.goesAway();
    await onePollLater();

    expect(kinds(phone)).toEqual(['herdr-unreachable']);
  });

  test('asks herdr before saying so, when it is only the subscription that died', async () => {
    const herdr = createFakeHerdr([shell]);
    herdr.showScreen('w1:p2', 'the deploy finished');
    const phone = client();

    createMiddleman(herdr).connect(phone.receive).watch('w1:p2');
    await settled();
    herdr.dropsSubscriptions();
    await settled();
    herdr.showPanes([shell, asking]);
    await settled();

    expect(kinds(phone)).toEqual([]);
    expect(herdr.subscriptions()).toBe(1);
    expect(fleets(phone).at(-1)?.panes.map((pane) => pane.id)).toEqual(['w1:p1', 'w1:p2']);
  });

  test('tells a client with nothing open, which has no read to discover it with', async () => {
    const herdr = createFakeHerdr([shell]);
    const phone = client();

    createMiddleman(herdr).connect(phone.receive);
    await settled();
    herdr.goesAway();
    await settled();

    expect(kinds(phone)).toEqual(['herdr-unreachable']);
  });

  test('says it once, not once a second for as long as it lasts', async () => {
    const herdr = createFakeHerdr([shell]);
    const phone = client();

    createMiddleman(herdr).connect(phone.receive).watch('w1:p2');
    await settled();
    herdr.goesAway();
    await onePollLater();
    await onePollLater();
    await onePollLater();

    expect(kinds(phone)).toEqual(['herdr-unreachable']);
  });

  test('serves nothing it read before the machine went away', async () => {
    const herdr = createFakeHerdr([shell]);
    herdr.showScreen('w1:p2', 'the deploy finished');
    const middleman = createMiddleman(herdr);
    const phone = client();
    const tablet = client();

    middleman.connect(phone.receive).watch('w1:p2');
    await settled();
    herdr.goesAway();
    await onePollLater();
    middleman.connect(tablet.receive).watch('w1:p2');
    await onePollLater();

    expect(conversations(tablet)).toEqual([]);
    expect(fleets(tablet)).toEqual([]);
    expect(kinds(tablet)).toEqual(['herdr-unreachable']);
  });

  test('drops a read that was already in flight when the machine went, rather than pushing it after', async () => {
    const herdr = createFakeHerdr([shell]);
    herdr.showScreen('w1:p2', 'the deploy finished');
    const phone = client();

    createMiddleman(herdr).connect(phone.receive).watch('w1:p2');
    await settled();
    herdr.holdsReads();
    await onePollLater();
    herdr.goesAway();
    await settled();
    herdr.showScreen('w1:p2', 'this read was in flight');
    herdr.releasesReads();
    await settled();

    expect(kinds(phone)).toEqual(['herdr-unreachable']);
    expect(phone.updates.at(-1)?.kind).toBe('trouble');
    expect(conversations(phone).map((each) => each.turns[0]?.text)).toEqual([
      'the deploy finished',
    ]);
  });

  test('picks the pane up again by itself when herdr comes back', async () => {
    const herdr = createFakeHerdr([shell]);
    herdr.showScreen('w1:p2', 'the deploy finished');
    const phone = client();

    createMiddleman(herdr).connect(phone.receive).watch('w1:p2');
    await settled();
    herdr.goesAway();
    await onePollLater();
    herdr.showScreen('w1:p2', 'the deploy finished\nand the next one started');
    herdr.comesBack();
    await oneRetryLater();
    await onePollLater();

    expect(kinds(phone)).toEqual(['herdr-unreachable']);
    expect(conversations(phone).map((each) => each.turns[0]?.text)).toEqual([
      'the deploy finished',
      'the deploy finished\nand the next one started',
    ]);
  });

  test('says the fleet again on coming back, because the phone was told it had nothing', async () => {
    const herdr = createFakeHerdr([shell]);
    const phone = client();

    createMiddleman(herdr).connect(phone.receive);
    await settled();
    herdr.goesAway();
    await settled();
    herdr.comesBack();
    await oneRetryLater();

    expect(fleets(phone).map((fleet) => fleet.panes.map((pane) => pane.id))).toEqual([
      ['w1:p2'],
      ['w1:p2'],
    ]);
  });

  test('subscribes again, so a fleet change after the outage still arrives', async () => {
    const herdr = createFakeHerdr([shell]);
    const phone = client();

    createMiddleman(herdr).connect(phone.receive);
    await settled();
    herdr.goesAway();
    await settled();
    herdr.comesBack();
    await oneRetryLater();
    herdr.showPanes([shell, asking]);
    await settled();

    expect(herdr.subscriptions()).toBe(1);
    expect(fleets(phone).at(-1)?.panes.map((pane) => pane.state)).toEqual(['needs-you', 'idle']);
  });

  test('refuses a herdr that comes back speaking a protocol Viu has not been read against', async () => {
    const herdr = createFakeHerdr([shell]);
    const phone = client();

    createMiddleman(herdr).connect(phone.receive);
    await settled();
    herdr.goesAway();
    await settled();
    herdr.speaksProtocol(19, '0.9.0');
    herdr.comesBack();
    await oneRetryLater();

    expect(kinds(phone)).toEqual(['herdr-unreachable', 'protocol-mismatch']);
    expect(fleets(phone)).toHaveLength(1);
  });

  test('recovers from that too, once the herdr it understands is back', async () => {
    const herdr = createFakeHerdr([shell]);
    const phone = client();

    createMiddleman(herdr).connect(phone.receive);
    await settled();
    herdr.goesAway();
    await settled();
    herdr.speaksProtocol(19, '0.9.0');
    herdr.comesBack();
    await oneRetryLater();
    herdr.speaksProtocol(17, '0.7.5');
    await oneRetryLater();

    expect(kinds(phone)).toEqual(['herdr-unreachable', 'protocol-mismatch']);
    expect(fleets(phone)).toHaveLength(2);
  });

  test('stops trying once the last client has gone', async () => {
    const herdr = createFakeHerdr([shell]);
    const connection = createMiddleman(herdr).connect(client().receive);

    await settled();
    herdr.goesAway();
    await settled();
    connection.close();

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('when herdr answers and refuses the pane being watched', () => {
  test('says herdr refused, which is neither a gone pane nor a gone machine', async () => {
    const herdr = createFakeHerdr([thinking, shell]);
    const phone = client();

    createMiddleman(herdr).connect(phone.receive).watch('w1:p2');
    await settled();
    herdr.refuses('pane.read', 'internal_error', 'the pane runtime is unavailable');
    await onePollLater();

    expect(kinds(phone)).toEqual(['herdr-refused']);
  });

  test('leaves the fleet and the other clients alone, because the machine is answering', async () => {
    const herdr = createFakeHerdr([thinking, shell]);
    const middleman = createMiddleman(herdr);
    const phone = client();
    const tablet = client();

    middleman.connect(phone.receive).watch('w1:p2');
    middleman.connect(tablet.receive);
    await settled();
    herdr.refuses('pane.read', 'internal_error', 'the pane runtime is unavailable');
    await onePollLater();
    herdr.showPanes([asking, shell]);
    await settled();

    expect(kinds(tablet)).toEqual([]);
    expect(fleets(tablet).at(-1)?.panes[0]).toMatchObject({ id: 'w1:p1', state: 'needs-you' });
    expect(fleets(phone).at(-1)?.panes[0]).toMatchObject({ id: 'w1:p1', state: 'needs-you' });
  });

  test('says it once rather than flapping between the refusal and the fleet', async () => {
    const herdr = createFakeHerdr([shell]);
    const phone = client();

    createMiddleman(herdr).connect(phone.receive).watch('w1:p2');
    await settled();
    herdr.refuses('pane.read', 'internal_error', 'the pane runtime is unavailable');
    await onePollLater();
    await onePollLater();
    await onePollLater();

    expect(kinds(phone)).toEqual(['herdr-refused']);
  });
});
