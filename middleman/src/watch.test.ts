import type { Fleet, Update } from '@viu/protocol';
import { describe, expect, test } from 'vitest';

import { createMiddleman } from './middleman.js';
import { createFakeHerdr, herdrPane } from './testing/fake-herdr.js';

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

async function settled(): Promise<void> {
  for (let turn = 0; turn < 20; turn += 1) await Promise.resolve();
}

const thinking = herdrPane({ pane_id: 'w1:p1', agent: 'claude', agent_status: 'working' });
const asking = herdrPane({ pane_id: 'w1:p1', agent: 'claude', agent_status: 'blocked' });
const shell = herdrPane({ pane_id: 'w1:p2' });

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
