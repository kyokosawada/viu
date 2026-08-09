import { render, screen } from '@testing-library/react-native';

import type { Pane, PaneState } from '@viu/protocol';

import { App } from './App';
import type { Machine } from './machine';
import { createFakeMiddleman, type FakeMiddleman } from './testing/fake-middleman';
import { machineInMemory } from './testing/machine-in-memory';

const THE_MACHINE: Machine = { host: 'desk.tail1234.ts.net', port: 8787 };

function pane(id: string, project: string | null, state: PaneState): Pane {
  return { id, project, agent: null, activity: null, state };
}

async function opened(panes: readonly Pane[]): Promise<FakeMiddleman> {
  const middleman = createFakeMiddleman('0.7.5');
  middleman.shows(panes);
  await render(<App middleman={middleman.at} machines={machineInMemory(THE_MACHINE)} />);
  return middleman;
}

async function panesShown(): Promise<string[]> {
  const labels = await screen.findAllByRole('header');
  return labels.map((label) => label.props.children as string);
}

describe('seeing the fleet', () => {
  test('shows every pane the middleman knows of as one flat list', async () => {
    await opened([
      pane('w1:p1', 'viu', 'thinking'),
      pane('w2:p6J', 'herdr', 'idle'),
      pane('w3:p2', 'notes', 'dormant'),
    ]);

    expect(await panesShown()).toEqual(['viu', 'herdr', 'notes']);
  });

  test('puts the panes that need you at the top', async () => {
    await opened([
      pane('w1:p1', 'viu', 'thinking'),
      pane('w2:p6J', 'herdr', 'needs-you'),
      pane('w3:p2', 'notes', 'idle'),
      pane('w4:p9', 'slab', 'needs-you'),
    ]);

    expect(await panesShown()).toEqual(['herdr', 'slab', 'viu', 'notes']);
  });

  test('leaves the panes that do not need you in the order the middleman gave', async () => {
    await opened([
      pane('w1:p1', 'notes', 'dormant'),
      pane('w2:p6J', 'viu', 'idle'),
      pane('w3:p2', 'herdr', 'thinking'),
    ]);

    expect(await panesShown()).toEqual(['notes', 'viu', 'herdr']);
  });

  test('shows each pane its state', async () => {
    await opened([
      pane('w1:p1', 'viu', 'needs-you'),
      pane('w2:p6J', 'herdr', 'thinking'),
      pane('w3:p2', 'notes', 'idle'),
      pane('w4:p9', 'slab', 'dormant'),
      pane('w5:p3', 'spike', 'unknown'),
    ]);

    expect(await screen.findByText('Needs you')).toBeOnTheScreen();
    expect(screen.getByText('Thinking')).toBeOnTheScreen();
    expect(screen.getByText('Idle')).toBeOnTheScreen();
    expect(screen.getByText('Dormant')).toBeOnTheScreen();
    expect(screen.getByText('Unknown')).toBeOnTheScreen();
  });

  test('labels a pane with no project by the handle it is addressed by', async () => {
    await opened([pane('w1:p1', null, 'idle')]);

    expect(await panesShown()).toEqual(['w1:p1']);
  });

  test('says what an agent is doing when the pane carries it', async () => {
    await opened([{ ...pane('w1:p1', 'viu', 'thinking'), activity: 'Reading the fleet' }]);

    expect(await screen.findByText('Reading the fleet')).toBeOnTheScreen();
  });

  test('reads the fleet from the machine that was set', async () => {
    const middleman = await opened([pane('w1:p1', 'viu', 'idle')]);

    await screen.findByText('viu');

    expect(middleman.askedForTheFleet()).toEqual([THE_MACHINE]);
  });

  test('says so rather than showing an empty screen when herdr knows of no panes', async () => {
    await opened([]);

    expect(await screen.findByText('herdr knows of no panes on this machine.')).toBeOnTheScreen();
  });
});
