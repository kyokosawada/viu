import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { Pane, PaneState, Turn } from '@viu/protocol';

import { App } from './App';
import type { Machine } from './machine';
import { createFakeDictation, type FakeDictation } from './testing/fake-dictation';
import { createFakeMiddleman, type FakeMiddleman } from './testing/fake-middleman';
import { machineInMemory } from './testing/machine-in-memory';
import { phoneInHand, type FakePhone } from './testing/phone-in-hand';

const THE_MACHINE: Machine = { host: 'desk.tail1234.ts.net', port: 8787 };

const THE_PANE = 'w2:p6J';

const ANOTHER_PANE = 'w1:p1';

function pane(id: string, project: string | null, state: PaneState): Pane {
  return { id, project, agent: null, activity: null, state };
}

function turn(text: string): Turn {
  return { role: 'agent', text, cut: false };
}

interface Watching {
  readonly middleman: FakeMiddleman;
  readonly phone: FakePhone;
  readonly speech: FakeDictation;
}

async function watching(panes: readonly Pane[]): Promise<Watching> {
  const middleman = createFakeMiddleman();
  const phone = phoneInHand();
  const speech = createFakeDictation();
  middleman.shows(panes);
  await render(
    <App
      middleman={middleman.at}
      machines={machineInMemory(THE_MACHINE)}
      phone={phone}
      dictation={speech.engine}
    />,
  );
  return { middleman, phone, speech };
}

async function onTheMachine(happens: () => void): Promise<void> {
  await act(async () => {
    happens();
    await Promise.resolve();
  });
}

async function fleetShows(...projects: readonly string[]): Promise<void> {
  const shown = await screen.findAllByRole('header');
  expect(shown).toHaveLength(projects.length);
  projects.forEach((project, at) => {
    expect(shown[at]).toHaveTextContent(project);
  });
}

describe('the fleet, live', () => {
  test('reorders as states change, without anything being asked for again', async () => {
    const { middleman } = await watching([
      pane(ANOTHER_PANE, 'viu', 'thinking'),
      pane(THE_PANE, 'herdr', 'idle'),
    ]);
    await fleetShows('viu', 'herdr');

    await onTheMachine(() => {
      middleman.shows([
        pane(ANOTHER_PANE, 'viu', 'thinking'),
        pane(THE_PANE, 'herdr', 'needs-you'),
      ]);
    });

    await fleetShows('herdr', 'viu');
    expect(middleman.connectedFrom()).toEqual([THE_MACHINE]);
  });

  test('shows a pane that has gone from the fleet no longer', async () => {
    const { middleman } = await watching([
      pane(ANOTHER_PANE, 'viu', 'idle'),
      pane(THE_PANE, 'herdr', 'idle'),
    ]);
    await fleetShows('viu', 'herdr');

    await onTheMachine(() => {
      middleman.shows([pane(ANOTHER_PANE, 'viu', 'idle')]);
    });

    await fleetShows('viu');
  });

  test('says the machine is unreachable, and shows no fleet, when it goes', async () => {
    const { middleman } = await watching([pane(ANOTHER_PANE, 'viu', 'idle')]);
    await fleetShows('viu');

    await onTheMachine(() => {
      middleman.goesAway();
    });

    expect(await screen.findByText('Cannot reach the machine')).toBeOnTheScreen();
    expect(screen.queryByText('viu')).not.toBeOnTheScreen();
  });
});

describe('the pane being read, live', () => {
  async function opened(turns: readonly Turn[]): Promise<Watching> {
    const held = await watching([pane(THE_PANE, 'viu', 'thinking')]);
    held.middleman.showsThePane(THE_PANE, turns);
    await fireEvent.press(await screen.findByText('viu'));
    return held;
  }

  test('updates as the agent works', async () => {
    const { middleman } = await opened([turn('Reading the fleet')]);
    expect(await screen.findByText('Reading the fleet')).toBeOnTheScreen();

    await onTheMachine(() => {
      middleman.showsThePane(THE_PANE, [
        turn('Reading the fleet'),
        turn('Which one shall I take?'),
      ]);
    });

    expect(await screen.findByText('Which one shall I take?')).toBeOnTheScreen();
    expect(screen.getByText('Reading the fleet')).toBeOnTheScreen();
    expect(middleman.watchedPanes()).toEqual([THE_PANE]);
  });

  test('replaces what the pane said rather than adding to it', async () => {
    const { middleman } = await opened([turn('Reading the fleet')]);
    expect(await screen.findByText('Reading the fleet')).toBeOnTheScreen();

    await onTheMachine(() => {
      middleman.showsThePane(THE_PANE, [turn('Something else entirely')]);
    });

    expect(await screen.findByText('Something else entirely')).toBeOnTheScreen();
    expect(screen.queryByText('Reading the fleet')).not.toBeOnTheScreen();
  });

  test('follows the state of the pane it is reading', async () => {
    const { middleman } = await opened([turn('Reading the fleet')]);
    expect(await screen.findByText('Thinking')).toBeOnTheScreen();

    await onTheMachine(() => {
      middleman.shows([pane(THE_PANE, 'viu', 'needs-you')]);
    });

    expect(await screen.findByText('Needs you')).toBeOnTheScreen();
  });

  test('says the machine is unreachable, and shows no turns, when it goes mid-read', async () => {
    const { middleman } = await opened([turn('Reading the fleet')]);
    expect(await screen.findByText('Reading the fleet')).toBeOnTheScreen();

    await onTheMachine(() => {
      middleman.goesAway();
    });

    expect(await screen.findByText('Cannot reach the machine')).toBeOnTheScreen();
    expect(screen.queryByText('Reading the fleet')).not.toBeOnTheScreen();
  });

  test('says the pane is gone rather than an empty conversation, and stays on it', async () => {
    const { middleman } = await opened([turn('Reading the fleet')]);
    expect(await screen.findByText('Reading the fleet')).toBeOnTheScreen();

    await onTheMachine(() => {
      middleman.troublesThePane({
        kind: 'pane-gone',
        paneId: THE_PANE,
        message: `herdr knows no pane ${THE_PANE}`,
      });
    });

    expect(await screen.findByText('That pane is gone')).toBeOnTheScreen();
    expect(screen.queryByText('Reading the fleet')).not.toBeOnTheScreen();
  });

  test('leaves the words waiting in the Slab alone when the pane says something new', async () => {
    const { middleman, speech } = await opened([turn('Which one shall I take?')]);
    await fireEvent(await screen.findByLabelText('The Slab'), 'longPress');
    await onTheMachine(() => {
      speech.hears('take the second one');
    });
    await fireEvent(screen.getByLabelText('The Slab'), 'pressOut');
    expect(await screen.findByDisplayValue('take the second one')).toBeOnTheScreen();

    await onTheMachine(() => {
      middleman.showsThePane(THE_PANE, [
        turn('Which one shall I take?'),
        turn('Still waiting on you'),
      ]);
    });

    expect(await screen.findByText('Still waiting on you')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('take the second one')).toBeOnTheScreen();
    expect(screen.getByText('Send')).toBeOnTheScreen();
  });

  test('stops watching the pane when the fleet is gone back to', async () => {
    const { middleman } = await opened([turn('Reading the fleet')]);
    expect(middleman.nowWatching()).toBe(THE_PANE);

    await fireEvent.press(screen.getByText('Back to the fleet'));

    expect(await screen.findByText('The fleet')).toBeOnTheScreen();
    expect(middleman.nowWatching()).toBeNull();
    expect(middleman.connectionsHeld()).toBe(1);
  });
});

describe('a pane that starts needing you while another is open', () => {
  async function reading(): Promise<FakeMiddleman> {
    const { middleman } = await watching([
      pane(THE_PANE, 'viu', 'thinking'),
      pane(ANOTHER_PANE, 'herdr', 'thinking'),
    ]);
    middleman.showsThePane(THE_PANE, [turn('Reading the fleet')]);
    await fireEvent.press(await screen.findByText('viu'));
    await screen.findByText('Reading the fleet');
    return middleman;
  }

  test('says so on the pane being read', async () => {
    const middleman = await reading();
    expect(screen.queryByText('herdr needs you')).not.toBeOnTheScreen();

    await onTheMachine(() => {
      middleman.shows([
        pane(THE_PANE, 'viu', 'thinking'),
        pane(ANOTHER_PANE, 'herdr', 'needs-you'),
      ]);
    });

    expect(await screen.findByText('herdr needs you')).toBeOnTheScreen();
  });

  test('opens that pane when it is tapped, and watches it instead', async () => {
    const middleman = await reading();
    middleman.showsThePane(ANOTHER_PANE, [turn('Which one shall I take?')]);
    await onTheMachine(() => {
      middleman.shows([
        pane(THE_PANE, 'viu', 'thinking'),
        pane(ANOTHER_PANE, 'herdr', 'needs-you'),
      ]);
    });

    await fireEvent.press(await screen.findByText('herdr needs you'));

    expect(await screen.findByText('Which one shall I take?')).toBeOnTheScreen();
    expect(middleman.nowWatching()).toBe(ANOTHER_PANE);
    expect(middleman.watchedPanes()).toEqual([THE_PANE, ANOTHER_PANE]);
  });

  test('does not say the pane being read needs you', async () => {
    const middleman = await reading();

    await onTheMachine(() => {
      middleman.shows([pane(THE_PANE, 'viu', 'needs-you')]);
    });

    expect(await screen.findByText('Needs you')).toBeOnTheScreen();
    expect(screen.queryByText('viu needs you')).not.toBeOnTheScreen();
  });
});

describe('putting the phone away', () => {
  test('puts the connection down, and takes it up again when it is picked up', async () => {
    const { middleman, phone } = await watching([pane(ANOTHER_PANE, 'viu', 'idle')]);
    await screen.findByText('viu');

    await onTheMachine(() => {
      phone.isPutAway();
    });
    expect(middleman.connectionsHeld()).toBe(0);

    middleman.shows([pane(ANOTHER_PANE, 'herdr', 'needs-you')]);
    await onTheMachine(() => {
      phone.isPickedUp();
    });

    expect(await screen.findByText('herdr')).toBeOnTheScreen();
    expect(screen.getByText('Needs you')).toBeOnTheScreen();
    expect(middleman.connectionsHeld()).toBe(1);
  });

  test('stops watching the pane being read, and watches it again on being picked up', async () => {
    const { middleman, phone } = await watching([pane(THE_PANE, 'viu', 'thinking')]);
    middleman.showsThePane(THE_PANE, [turn('Reading the fleet')]);
    await fireEvent.press(await screen.findByText('viu'));
    await screen.findByText('Reading the fleet');

    await onTheMachine(() => {
      phone.isPutAway();
    });
    expect(middleman.nowWatching()).toBeNull();

    middleman.showsThePane(THE_PANE, [turn('Which one shall I take?')]);
    await onTheMachine(() => {
      phone.isPickedUp();
    });

    expect(await screen.findByText('Which one shall I take?')).toBeOnTheScreen();
    expect(middleman.nowWatching()).toBe(THE_PANE);
  });
});
