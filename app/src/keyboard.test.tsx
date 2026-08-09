import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Key, Pane, PaneState } from '@viu/protocol';

import { App } from './App';
import type { Machine } from './machine';
import { createFakeDictation, type FakeDictation } from './testing/fake-dictation';
import { createFakeMiddleman, type FakeMiddleman } from './testing/fake-middleman';
import { machineInMemory } from './testing/machine-in-memory';

const THE_MACHINE: Machine = { host: 'desk.tail1234.ts.net', port: 8787 };

const THE_PANE = 'w2:p6J';

const AN_AGENT = pane(THE_PANE, 'viu', 'needs-you', 'claude');

const A_SHELL = pane('w1:p1', 'a shell', 'idle', null);

const A_LONG_LINE = 'That line is long, and a shell may have cut it.';

function pane(id: string, project: string, state: PaneState, agent: string | null): Pane {
  return { id, project, agent, activity: null, state };
}

async function opening(holding = AN_AGENT): Promise<FakeMiddleman> {
  const { middleman } = await openingWith(holding);
  return middleman;
}

async function openingWith(
  holding = AN_AGENT,
): Promise<{ middleman: FakeMiddleman; speech: FakeDictation }> {
  const middleman = createFakeMiddleman();
  const speech = createFakeDictation();
  middleman.shows([holding]);
  middleman.showsThePane(holding.id, [
    { role: 'agent', text: 'Which one shall I take?', cut: false },
  ]);
  await render(
    <App
      middleman={middleman.at}
      machines={machineInMemory(THE_MACHINE)}
      dictation={speech.engine}
    />,
  );
  await fireEvent.press(await screen.findByText(holding.project ?? holding.id));
  await screen.findByLabelText('The Slab');
  return { middleman, speech };
}

async function tappingTheSlab(): Promise<void> {
  await fireEvent.press(screen.getByLabelText('The Slab'));
  await screen.findByLabelText('What to send');
}

async function typing(words: string): Promise<void> {
  await fireEvent.changeText(screen.getByLabelText('What to send'), words);
}

async function tapping(named: string): Promise<void> {
  await fireEvent.press(screen.getByLabelText(named));
}

const THE_FIVE: readonly (readonly [string, Key])[] = [
  ['Up', 'up'],
  ['Down', 'down'],
  ['Enter', 'enter'],
  ['Escape', 'escape'],
  ['Ctrl-C', 'ctrl-c'],
];

describe('one tap on the Slab', () => {
  test('reveals the keyboard and the quick-key bar together', async () => {
    await opening();

    await tappingTheSlab();

    expect(screen.getByLabelText('What to send')).toHaveProp('autoFocus', true);
    expect(screen.getByLabelText('The quick-key bar')).toBeOnTheScreen();
  });

  test('offers neither until the Slab is tapped', async () => {
    await opening();

    expect(screen.getByText('Hold to talk')).toBeOnTheScreen();
    expect(screen.queryByLabelText('What to send')).not.toBeOnTheScreen();
    expect(screen.queryByLabelText('The quick-key bar')).not.toBeOnTheScreen();
  });

  test('reaches for no microphone, because a tap is not a hold', async () => {
    const { speech } = await openingWith();

    await tappingTheSlab();

    expect(speech.beingHeld()).toBe(false);
  });

  test('is on a plain shell too', async () => {
    await opening(A_SHELL);

    await tappingTheSlab();

    expect(screen.getByLabelText('The quick-key bar')).toBeOnTheScreen();
  });

  test('puts the keyboard and the bar away again on a discard', async () => {
    const middleman = await opening();
    await tappingTheSlab();

    await fireEvent.press(screen.getByText('Discard'));

    expect(await screen.findByText('Hold to talk')).toBeOnTheScreen();
    expect(screen.queryByLabelText('The quick-key bar')).not.toBeOnTheScreen();
    expect(middleman.whatWasSent()).toEqual([]);
  });
});

describe('typing an answer', () => {
  test('sends what was typed', async () => {
    const middleman = await opening();
    await tappingTheSlab();

    await typing('the second one');
    await fireEvent.press(screen.getByText('Send'));
    await screen.findByText('Queued');

    expect(middleman.whatWasSent()).toEqual([{ paneId: THE_PANE, text: 'the second one' }]);
  });

  test('shows the same confirmation a dictated send shows', async () => {
    const middleman = await opening();
    middleman.picksUpWhatIsSent('thinking');
    await tappingTheSlab();

    await typing('the second one');
    await fireEvent.press(screen.getByText('Send'));

    expect(await screen.findByText('Confirmed')).toBeOnTheScreen();
    expect(screen.getByText('The agent picked it up. Now it is thinking.')).toBeOnTheScreen();
  });

  test('claims only that it was sent into a pane holding no agent, and warns about a long line', async () => {
    const middleman = await opening(A_SHELL);
    middleman.onlyQueuesWhatIsSent(true);
    await tappingTheSlab();

    await typing('a very long line');
    await fireEvent.press(screen.getByText('Send'));

    expect(await screen.findByText('Sent')).toBeOnTheScreen();
    expect(screen.getByText('There is no agent here to confirm it.')).toBeOnTheScreen();
    expect(screen.getByText(A_LONG_LINE)).toBeOnTheScreen();
  });

  test('names a trouble the send hit, and keeps what was typed', async () => {
    const middleman = await opening();
    middleman.troublesTheSend({
      kind: 'pane-gone',
      paneId: THE_PANE,
      message: 'herdr knows no pane w2:p6J',
    });
    await tappingTheSlab();

    await typing('the second one');
    await fireEvent.press(screen.getByText('Send'));

    expect(await screen.findByText('That pane is gone')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('the second one')).toBeOnTheScreen();
  });

  test('sends nothing on an empty field', async () => {
    const middleman = await opening();
    await tappingTheSlab();

    await fireEvent.press(screen.getByText('Send'));

    expect(middleman.whatWasSent()).toEqual([]);
  });
});

describe('the quick-key bar', () => {
  test.each(THE_FIVE)('presses %s into the pane', async (named, key) => {
    const middleman = await opening();
    await tappingTheSlab();

    await tapping(named);

    expect(middleman.whatWasPressed()).toEqual([{ paneId: THE_PANE, keys: [key] }]);
  });

  test('holds those five keys and no others', async () => {
    await opening();
    await tappingTheSlab();

    for (const [named] of THE_FIVE) {
      expect(screen.getByLabelText(named)).toBeOnTheScreen();
    }
    for (const missing of ['Tab', 'Left', 'Right', 'Backspace', 'Space', 'Delete']) {
      expect(screen.queryByLabelText(missing)).not.toBeOnTheScreen();
    }
  });

  test('answers a picker with a run of taps, in the order they were made', async () => {
    const middleman = await opening();
    await tappingTheSlab();

    await tapping('Down');
    await tapping('Down');
    await tapping('Enter');

    expect(middleman.whatWasPressed()).toEqual([
      { paneId: THE_PANE, keys: ['down'] },
      { paneId: THE_PANE, keys: ['down'] },
      { paneId: THE_PANE, keys: ['enter'] },
    ]);
  });

  test('stops a runaway on a single tap of ctrl-c, with nothing to confirm', async () => {
    const middleman = await opening();
    await tappingTheSlab();

    await tapping('Ctrl-C');

    expect(middleman.whatWasPressed()).toEqual([{ paneId: THE_PANE, keys: ['ctrl-c'] }]);
    expect(await screen.findByText('Ctrl-C went into the pane.')).toBeOnTheScreen();
  });

  test('keeps what was typed when a key is pressed', async () => {
    await opening();
    await tappingTheSlab();

    await typing('the second one');
    await tapping('Escape');

    expect(screen.getByDisplayValue('the second one')).toBeOnTheScreen();
  });

  test('names a trouble the press hit', async () => {
    const middleman = await opening();
    middleman.troublesThePress({
      kind: 'pane-not-accepting-input',
      paneId: THE_PANE,
      message: 'herdr could not write into it',
    });
    await tappingTheSlab();

    await tapping('Enter');

    expect(await screen.findByText('That pane is not taking input')).toBeOnTheScreen();
    expect(screen.getByText('herdr could not write into it')).toBeOnTheScreen();
  });

  test('says the machine never answered the press at all', async () => {
    const middleman = await opening();
    await tappingTheSlab();
    middleman.failsToAnswerAtAll('Network request failed');

    await tapping('Up');

    expect(await screen.findByText('Cannot reach the machine')).toBeOnTheScreen();
  });
});
