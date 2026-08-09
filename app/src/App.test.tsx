import { fireEvent, render, screen } from '@testing-library/react-native';

import { App } from './App';
import type { Machine } from './machine';
import { createFakeMiddleman } from './testing/fake-middleman';
import { machineInMemory } from './testing/machine-in-memory';

const THE_MACHINE: Machine = { host: 'desk.tail1234.ts.net', port: 8787 };

const THE_NAME_FIELD = 'my-machine.tail1234.ts.net';

describe('opening Viu', () => {
  test('asks for the machine when none has been set', async () => {
    const middleman = createFakeMiddleman();

    await render(<App middleman={middleman.at} machines={machineInMemory()} />);

    expect(await screen.findByPlaceholderText(THE_NAME_FIELD)).toBeOnTheScreen();
    expect(middleman.greetedFrom()).toEqual([]);
  });

  test('reaches the machine that was set, and names the herdr the middleman greeted', async () => {
    const middleman = createFakeMiddleman('0.7.5');

    await render(<App middleman={middleman.at} machines={machineInMemory(THE_MACHINE)} />);

    expect(await screen.findByText('The fleet')).toBeOnTheScreen();
    expect(screen.getByText('desk.tail1234.ts.net:8787 · herdr 0.7.5')).toBeOnTheScreen();
    expect(middleman.greetedFrom()).toEqual([THE_MACHINE]);
  });

  test('says it cannot reach the machine, and shows nothing of the fleet', async () => {
    const middleman = createFakeMiddleman();
    middleman.goesAway();

    await render(<App middleman={middleman.at} machines={machineInMemory(THE_MACHINE)} />);

    expect(await screen.findByText('Cannot reach the machine')).toBeOnTheScreen();
    expect(screen.queryByText('The fleet')).not.toBeOnTheScreen();
  });

  test('reaches the machine again when the network comes back', async () => {
    const middleman = createFakeMiddleman('0.7.5');
    middleman.goesAway();
    await render(<App middleman={middleman.at} machines={machineInMemory(THE_MACHINE)} />);
    expect(await screen.findByText('Cannot reach the machine')).toBeOnTheScreen();

    middleman.comesBack();
    await fireEvent.press(screen.getByText('Try again'));

    expect(await screen.findByText('The fleet')).toBeOnTheScreen();
  });

  test('names a trouble the middleman reported rather than a generic failure', async () => {
    const middleman = createFakeMiddleman();
    middleman.troubles({ kind: 'herdr-unreachable', message: 'herdr is not running' });

    await render(<App middleman={middleman.at} machines={machineInMemory(THE_MACHINE)} />);

    expect(await screen.findByText('The middleman cannot reach herdr')).toBeOnTheScreen();
    expect(screen.getByText('herdr is not running')).toBeOnTheScreen();
  });

  test('says when something other than the middleman answered', async () => {
    const middleman = createFakeMiddleman();
    middleman.answersAsSomethingElse('it answered 404');

    await render(<App middleman={middleman.at} machines={machineInMemory(THE_MACHINE)} />);

    expect(await screen.findByText('That is not the middleman')).toBeOnTheScreen();
    expect(screen.getByText('Something answered, but it answered 404.')).toBeOnTheScreen();
  });

  test('does not sit reaching forever when the client itself fails', async () => {
    const middleman = createFakeMiddleman();
    middleman.failsToAnswerAtAll('the client fell over');

    await render(<App middleman={middleman.at} machines={machineInMemory(THE_MACHINE)} />);

    expect(await screen.findByText('Cannot reach the machine')).toBeOnTheScreen();
    expect(screen.getByText('Try again')).toBeOnTheScreen();
  });

  test('asks for the machine when the phone cannot say what was remembered', async () => {
    const middleman = createFakeMiddleman();
    const machines = machineInMemory(THE_MACHINE);
    machines.breaks('the store is unreadable');

    await render(<App middleman={middleman.at} machines={machines} />);

    expect(await screen.findByPlaceholderText(THE_NAME_FIELD)).toBeOnTheScreen();
  });
});

describe('setting the machine', () => {
  test('reaches it once set, and remembers it for the next opening', async () => {
    const middleman = createFakeMiddleman('0.7.5');
    const machines = machineInMemory();
    const first = await render(<App middleman={middleman.at} machines={machines} />);

    await fireEvent.changeText(
      await screen.findByPlaceholderText(THE_NAME_FIELD),
      'desk.tail1234.ts.net',
    );
    await fireEvent.press(screen.getByText('Reach the machine'));

    expect(await screen.findByText('The fleet')).toBeOnTheScreen();
    expect(middleman.greetedFrom()).toEqual([THE_MACHINE]);

    await first.unmount();
    await render(<App middleman={middleman.at} machines={machines} />);

    expect(await screen.findByText('The fleet')).toBeOnTheScreen();
    expect(screen.queryByPlaceholderText(THE_NAME_FIELD)).not.toBeOnTheScreen();
  });

  test('reaches a machine it could not write down rather than doing nothing', async () => {
    const middleman = createFakeMiddleman('0.7.5');
    const machines = machineInMemory();
    machines.breaks('the store is unwritable');
    await render(<App middleman={middleman.at} machines={machines} />);

    await fireEvent.changeText(
      await screen.findByPlaceholderText(THE_NAME_FIELD),
      'desk.tail1234.ts.net',
    );
    await fireEvent.press(screen.getByText('Reach the machine'));

    expect(await screen.findByText('The fleet')).toBeOnTheScreen();
  });

  test('will not reach a machine name it cannot use', async () => {
    const middleman = createFakeMiddleman();

    await render(<App middleman={middleman.at} machines={machineInMemory()} />);
    await fireEvent.changeText(
      await screen.findByPlaceholderText(THE_NAME_FIELD),
      'desk one.ts.net',
    );
    await fireEvent.press(screen.getByText('Reach the machine'));

    expect(screen.getByPlaceholderText(THE_NAME_FIELD)).toBeOnTheScreen();
    expect(middleman.greetedFrom()).toEqual([]);
  });

  test('can be changed after it has been set', async () => {
    const middleman = createFakeMiddleman();
    await render(<App middleman={middleman.at} machines={machineInMemory(THE_MACHINE)} />);
    expect(await screen.findByText('The fleet')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Change the machine'));
    await fireEvent.changeText(screen.getByPlaceholderText(THE_NAME_FIELD), 'other.ts.net');
    await fireEvent.press(screen.getByText('Reach the machine'));

    expect(await screen.findByText('other.ts.net:8787 · herdr 0.7.5')).toBeOnTheScreen();
  });

  test('leaves the machine alone when the change is thought better of', async () => {
    const middleman = createFakeMiddleman();
    await render(<App middleman={middleman.at} machines={machineInMemory(THE_MACHINE)} />);
    expect(await screen.findByText('The fleet')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Change the machine'));
    await fireEvent.press(await screen.findByText('Keep the machine I had'));

    expect(await screen.findByText('desk.tail1234.ts.net:8787 · herdr 0.7.5')).toBeOnTheScreen();
    expect(middleman.greetedFrom()).toEqual([THE_MACHINE]);
  });
});
