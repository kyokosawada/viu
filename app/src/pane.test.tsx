import { fireEvent, render, screen, within } from '@testing-library/react-native';

import type { Pane, PaneState, Turn, TurnRole } from '@viu/protocol';

import { App } from './App';
import type { Machine } from './machine';
import { createFakeMiddleman } from './testing/fake-middleman';
import { machineInMemory } from './testing/machine-in-memory';

const THE_MACHINE: Machine = { host: 'desk.tail1234.ts.net', port: 8787 };

const THE_PANE = 'w2:p6J';

function pane(id: string, project: string | null, state: PaneState): Pane {
  return { id, project, agent: null, activity: null, state };
}

function turn(role: TurnRole, text: string, cut = false): Turn {
  return { role, text, cut };
}

async function opening(turns: readonly Turn[], holding = pane(THE_PANE, 'viu', 'needs-you')) {
  const middleman = createFakeMiddleman();
  middleman.shows([holding]);
  middleman.showsThePane(holding.id, turns);
  await render(<App middleman={middleman.at} machines={machineInMemory(THE_MACHINE)} />);
  await fireEvent.press(await screen.findByText(holding.project ?? holding.id));
  return middleman;
}

describe('opening a pane', () => {
  test('reads the conversation of the pane that was tapped', async () => {
    const middleman = await opening([turn('agent', 'Reading the fleet')]);

    expect(await screen.findByText('Reading the fleet')).toBeOnTheScreen();
    expect(middleman.askedForTheConversationOf()).toEqual([THE_PANE]);
  });

  test('reads no pane until one is tapped', async () => {
    const middleman = createFakeMiddleman();
    middleman.shows([pane(THE_PANE, 'viu', 'idle')]);

    await render(<App middleman={middleman.at} machines={machineInMemory(THE_MACHINE)} />);
    await screen.findByText('viu');

    expect(middleman.askedForTheConversationOf()).toEqual([]);
  });

  test('says which pane is open and what state it is in', async () => {
    await opening([turn('agent', 'Reading the fleet')]);

    expect(await screen.findByRole('header', { name: 'viu' })).toBeOnTheScreen();
    expect(screen.getByText(`Needs you · ${THE_PANE}`)).toBeOnTheScreen();
  });

  test('goes back to the fleet', async () => {
    await opening([turn('agent', 'Reading the fleet')]);
    expect(await screen.findByText('Reading the fleet')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Back to the fleet'));

    expect(await screen.findByText('The fleet')).toBeOnTheScreen();
    expect(screen.queryByText('Reading the fleet')).not.toBeOnTheScreen();
  });

  test('says so rather than showing an empty screen when the pane has said nothing', async () => {
    await opening([]);

    expect(await screen.findByText('This pane has said nothing yet.')).toBeOnTheScreen();
  });

  test('names a trouble the pane read hit rather than an empty conversation', async () => {
    const middleman = createFakeMiddleman();
    middleman.shows([pane(THE_PANE, 'viu', 'idle')]);
    middleman.troublesThePane({
      kind: 'pane-gone',
      paneId: THE_PANE,
      message: 'herdr knows no pane w2:p6J',
    });
    await render(<App middleman={middleman.at} machines={machineInMemory(THE_MACHINE)} />);

    await fireEvent.press(await screen.findByText('viu'));

    expect(await screen.findByText('That pane is gone')).toBeOnTheScreen();
    expect(screen.getByText('herdr knows no pane w2:p6J')).toBeOnTheScreen();
  });
});

describe('reading a pane as a conversation', () => {
  test('tells an agent turn and a person turn apart', async () => {
    await opening([
      turn('agent', 'Which one shall I take?'),
      turn('person', 'The second one'),
      turn('agent', 'Taking the second one'),
    ]);

    expect(await screen.findAllByLabelText('The agent')).toHaveLength(2);
    const person = screen.getByLabelText('You');
    expect(within(person).getByText('The second one')).toBeOnTheScreen();
    expect(within(person).queryByText('Which one shall I take?')).not.toBeOnTheScreen();
    expect(within(person).queryByText('Taking the second one')).not.toBeOnTheScreen();
  });

  test('shows a plain shell as one raw-text card', async () => {
    await opening([turn('pane', '$ npm test\nall good\n$ ')], pane('w1:p1', 'a shell', 'idle'));

    const raw = await screen.findByLabelText('The pane');
    expect(within(raw).getByText('$ npm test\nall good\n$ ')).toBeOnTheScreen();
    expect(screen.queryByLabelText('The agent')).not.toBeOnTheScreen();
  });

  test('shows a dormant pane as one raw-text card', async () => {
    await opening(
      [turn('pane', 'the conversation that finished here')],
      pane('w3:p2', 'notes', 'dormant'),
    );

    const raw = await screen.findByLabelText('The pane');
    expect(within(raw).getByText('the conversation that finished here')).toBeOnTheScreen();
  });

  test('marks a turn the screenful cut off', async () => {
    await opening([
      turn('agent', 'nd of what it was saying before the screen began', true),
      turn('person', 'carry on'),
    ]);

    const cut = await screen.findByLabelText('The agent');
    expect(within(cut).getByText('Cut off')).toBeOnTheScreen();
    expect(within(screen.getByLabelText('You')).queryByText('Cut off')).not.toBeOnTheScreen();
  });

  test('marks a cut raw-text card too', async () => {
    await opening([turn('pane', 'alf a line of output', true)], pane('w1:p1', 'a shell', 'idle'));

    expect(within(await screen.findByLabelText('The pane')).getByText('Cut off')).toBeOnTheScreen();
  });
});
