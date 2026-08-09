import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { App } from './App';
import type { Machine } from './machine';
import { createFakeMiddleman } from './testing/fake-middleman';
import { machineInMemory } from './testing/machine-in-memory';

const THE_MACHINE: Machine = { host: 'desk.tail1234.ts.net', port: 8787 };

const THE_NAME_FIELD = 'my-machine.tail1234.ts.net';

describe('opening Viu', () => {
  it('asks for the machine when none has been set', async () => {
    const middleman = createFakeMiddleman();

    await render(<App reach={middleman.reach} machines={machineInMemory()} />);

    expect(await screen.findByPlaceholderText(THE_NAME_FIELD)).toBeOnTheScreen();
    expect(middleman.greetedFrom()).toEqual([]);
  });

  it('reaches the machine that was set, and names the herdr the middleman greeted', async () => {
    const middleman = createFakeMiddleman('0.7.5');

    await render(<App reach={middleman.reach} machines={machineInMemory(THE_MACHINE)} />);

    expect(await screen.findByText('Connected')).toBeOnTheScreen();
    expect(screen.getByText('The middleman greeted herdr 0.7.5.')).toBeOnTheScreen();
    expect(screen.getByText('desk.tail1234.ts.net:8787')).toBeOnTheScreen();
    expect(middleman.greetedFrom()).toEqual([THE_MACHINE]);
  });

  it('says it cannot reach the machine, and shows nothing of the fleet', async () => {
    const middleman = createFakeMiddleman();
    middleman.goesAway();

    await render(<App reach={middleman.reach} machines={machineInMemory(THE_MACHINE)} />);

    expect(await screen.findByText('Cannot reach the machine')).toBeOnTheScreen();
    expect(screen.queryByText('Connected')).not.toBeOnTheScreen();
  });

  it('reaches the machine again when the network comes back', async () => {
    const middleman = createFakeMiddleman('0.7.5');
    middleman.goesAway();
    await render(<App reach={middleman.reach} machines={machineInMemory(THE_MACHINE)} />);
    expect(await screen.findByText('Cannot reach the machine')).toBeOnTheScreen();

    middleman.comesBack();
    await fireEvent.press(screen.getByText('Try again'));

    expect(await screen.findByText('Connected')).toBeOnTheScreen();
  });

  it('names a trouble the middleman reported rather than a generic failure', async () => {
    const middleman = createFakeMiddleman();
    middleman.troubles({ kind: 'herdr-unreachable', message: 'herdr is not running' });

    await render(<App reach={middleman.reach} machines={machineInMemory(THE_MACHINE)} />);

    expect(await screen.findByText('The middleman cannot reach herdr')).toBeOnTheScreen();
    expect(screen.getByText('herdr is not running')).toBeOnTheScreen();
  });
});

describe('setting the machine', () => {
  it('reaches it once set, and remembers it for the next opening', async () => {
    const middleman = createFakeMiddleman('0.7.5');
    const machines = machineInMemory();
    const first = await render(<App reach={middleman.reach} machines={machines} />);

    await fireEvent.changeText(
      await screen.findByPlaceholderText(THE_NAME_FIELD),
      'desk.tail1234.ts.net',
    );
    await fireEvent.press(screen.getByText('Reach the machine'));

    expect(await screen.findByText('Connected')).toBeOnTheScreen();
    expect(middleman.greetedFrom()).toEqual([THE_MACHINE]);

    await first.unmount();
    await render(<App reach={middleman.reach} machines={machines} />);

    expect(await screen.findByText('Connected')).toBeOnTheScreen();
    expect(screen.queryByPlaceholderText(THE_NAME_FIELD)).not.toBeOnTheScreen();
  });

  it('refuses a machine with no name', async () => {
    const middleman = createFakeMiddleman();

    await render(<App reach={middleman.reach} machines={machineInMemory()} />);
    await fireEvent.press(await screen.findByText('Reach the machine'));

    await waitFor(() => {
      expect(middleman.greetedFrom()).toEqual([]);
    });
    expect(screen.getByPlaceholderText(THE_NAME_FIELD)).toBeOnTheScreen();
  });

  it('can be changed after it has been set', async () => {
    const middleman = createFakeMiddleman();
    await render(<App reach={middleman.reach} machines={machineInMemory(THE_MACHINE)} />);
    expect(await screen.findByText('Connected')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Change the machine'));
    await fireEvent.changeText(screen.getByPlaceholderText(THE_NAME_FIELD), 'other.ts.net');
    await fireEvent.press(screen.getByText('Reach the machine'));

    expect(await screen.findByText('other.ts.net:8787')).toBeOnTheScreen();
  });
});
