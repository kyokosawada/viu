import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { Pane, PaneState, Turn } from '@viu/protocol';

import { App } from './App';
import type { Machine } from './machine';
import { createFakeMiddleman, type FakeMiddleman } from './testing/fake-middleman';
import { machineInMemory } from './testing/machine-in-memory';
import { phoneInHand, type FakePhone } from './testing/phone-in-hand';

const THE_MACHINE: Machine = { host: 'desk.tail1234.ts.net', port: 8787 };

const THE_PANE = 'w2:p6J';

function pane(state: PaneState): Pane {
  return { id: THE_PANE, project: 'viu', agent: null, activity: null, state };
}

function turn(text: string): Turn {
  return { role: 'agent', text, cut: false };
}

async function onTheMachine(happens: () => void): Promise<void> {
  await act(async () => {
    happens();
    await Promise.resolve();
  });
}

async function afterTheWait(): Promise<void> {
  await act(async () => {
    jest.runOnlyPendingTimers();
    await Promise.resolve();
  });
}

async function showingTheFleet(phone: FakePhone = phoneInHand()): Promise<FakeMiddleman> {
  const middleman = createFakeMiddleman();
  middleman.shows([pane('thinking')]);
  await render(
    <App middleman={middleman.at} machines={machineInMemory(THE_MACHINE)} phone={phone} />,
  );
  expect(await screen.findByText('viu')).toBeOnTheScreen();
  return middleman;
}

async function readingThePane(): Promise<FakeMiddleman> {
  const middleman = await showingTheFleet();
  middleman.showsThePane(THE_PANE, [turn('Which one shall I take?')]);
  await fireEvent.press(screen.getByText('viu'));
  expect(await screen.findByText('Which one shall I take?')).toBeOnTheScreen();
  return middleman;
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('each way of breaking says its own thing', () => {
  test('a pane that has gone is that, and not the machine being unreachable', async () => {
    const middleman = await readingThePane();

    await onTheMachine(() => {
      middleman.troublesThePane({
        kind: 'pane-gone',
        paneId: THE_PANE,
        message: `herdr knows no pane ${THE_PANE}`,
      });
    });

    expect(await screen.findByText('That pane is gone')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'The pane is no longer on the machine. Go back to the fleet for the panes that are.',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Cannot reach the machine')).not.toBeOnTheScreen();
    expect(screen.queryByText('Which one shall I take?')).not.toBeOnTheScreen();
    expect(middleman.connectionsHeld()).toBe(1);
  });

  test('herdr going down is that, and the connection is kept while it is', async () => {
    const middleman = await showingTheFleet();

    await onTheMachine(() => {
      middleman.troublesTheFleet({
        kind: 'herdr-unreachable',
        message: 'nothing is listening on the herdr socket',
      });
    });

    expect(await screen.findByText('The middleman cannot reach herdr')).toBeOnTheScreen();
    expect(screen.getByText('nothing is listening on the herdr socket')).toBeOnTheScreen();
    expect(screen.queryByText('Cannot reach the machine')).not.toBeOnTheScreen();
    expect(screen.queryByText('viu')).not.toBeOnTheScreen();
    expect(middleman.connectionsHeld()).toBe(1);
  });

  test('a protocol mismatch is that, and is not something to ask again about', async () => {
    const middleman = createFakeMiddleman();
    middleman.shows([{ id: 'w2:p6J', project: 'viu', agent: 'claude', activity: null, state: 'needs-you' }]);
    middleman.troubles({
      kind: 'protocol-mismatch',
      message: 'the middleman speaks protocol v5, this Viu speaks v4',
    });

    await render(<App middleman={middleman.at} machines={machineInMemory(THE_MACHINE)} />);

    expect(await screen.findByText('Viu and the middleman disagree')).toBeOnTheScreen();
    expect(
      screen.getByText('the middleman speaks protocol v5, this Viu speaks v4'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('viu')).not.toBeOnTheScreen();
    expect(screen.queryByText('Try again')).not.toBeOnTheScreen();
    expect(screen.queryByText('Cannot reach the machine')).not.toBeOnTheScreen();

    await afterTheWait();
    expect(middleman.greetedFrom()).toEqual([THE_MACHINE]);
  });

  test('an unreachable machine is that, and says Viu is still trying', async () => {
    const middleman = await showingTheFleet();

    await onTheMachine(() => {
      middleman.goesAway();
    });

    expect(await screen.findByText('Cannot reach the machine')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Viu keeps trying on its own, and the fleet returns the moment the machine does.',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText('The middleman cannot reach herdr')).not.toBeOnTheScreen();
    expect(screen.queryByText('viu')).not.toBeOnTheScreen();
  });
});

describe('the machine going away mid-stream', () => {
  test('blanks the pane being read rather than leaving it standing', async () => {
    const middleman = await readingThePane();

    await onTheMachine(() => {
      middleman.goesAway();
    });

    expect(await screen.findByText('Cannot reach the machine')).toBeOnTheScreen();
    expect(screen.queryByText('Which one shall I take?')).not.toBeOnTheScreen();
    expect(screen.queryByText('Thinking')).not.toBeOnTheScreen();
    expect(middleman.connectionsHeld()).toBe(0);
  });

  test('is reached for again without anything being tapped', async () => {
    const middleman = await showingTheFleet();
    await onTheMachine(() => {
      middleman.goesAway();
    });
    await screen.findByText('Cannot reach the machine');
    expect(middleman.greetedFrom()).toEqual([THE_MACHINE]);

    await afterTheWait();

    expect(middleman.greetedFrom()).toEqual([THE_MACHINE, THE_MACHINE]);
    expect(await screen.findByText('Cannot reach the machine')).toBeOnTheScreen();
  });

  test('shows the fleet again once the network returns, with no restart', async () => {
    const middleman = await showingTheFleet();
    await onTheMachine(() => {
      middleman.goesAway();
    });
    await screen.findByText('Cannot reach the machine');

    middleman.comesBack();
    await afterTheWait();

    expect(await screen.findByText('viu')).toBeOnTheScreen();
    expect(screen.queryByText('Cannot reach the machine')).not.toBeOnTheScreen();
    expect(middleman.connectionsHeld()).toBe(1);
  });

  test('takes up the pane it was reading again once the network returns', async () => {
    const middleman = await readingThePane();
    await onTheMachine(() => {
      middleman.goesAway();
    });
    await screen.findByText('Cannot reach the machine');

    middleman.showsThePane(THE_PANE, [
      turn('Which one shall I take?'),
      turn('Still waiting on you'),
    ]);
    middleman.comesBack();
    await afterTheWait();

    expect(await screen.findByText('Still waiting on you')).toBeOnTheScreen();
    expect(middleman.nowWatching()).toBe(THE_PANE);
    expect(middleman.watchedPanes()).toEqual([THE_PANE, THE_PANE]);
  });

  test('stops trying while the phone is away, and takes it up again on being picked up', async () => {
    const phone = phoneInHand();
    const middleman = await showingTheFleet(phone);
    await onTheMachine(() => {
      middleman.goesAway();
    });
    await screen.findByText('Cannot reach the machine');

    await onTheMachine(() => {
      phone.isPutAway();
    });
    await afterTheWait();
    expect(middleman.greetedFrom()).toEqual([THE_MACHINE]);

    await onTheMachine(() => {
      phone.isPickedUp();
    });
    await afterTheWait();

    expect(middleman.greetedFrom()).toEqual([THE_MACHINE, THE_MACHINE]);
  });

  test('keeps trying after an attempt that finds nothing either', async () => {
    const middleman = await showingTheFleet();
    await onTheMachine(() => {
      middleman.goesAway();
    });
    await screen.findByText('Cannot reach the machine');

    await afterTheWait();
    expect(await screen.findByText('Cannot reach the machine')).toBeOnTheScreen();
    middleman.comesBack();
    await afterTheWait();

    expect(await screen.findByText('viu')).toBeOnTheScreen();
  });
});
