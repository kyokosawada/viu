import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { Pane, PaneState, Turn } from '@viu/protocol';

import { App } from './App';
import type { Machine } from './machine';
import { createFakeDictation, type FakeDictation } from './testing/fake-dictation';
import { createFakeMiddleman, type FakeMiddleman } from './testing/fake-middleman';
import { machineInMemory } from './testing/machine-in-memory';

const THE_MACHINE: Machine = { host: 'desk.tail1234.ts.net', port: 8787 };

const THE_PANE = 'w2:p6J';

const THE_BAR = 'Hold to talk, tap to type';

const AN_AGENT = pane(THE_PANE, 'viu', 'needs-you', 'claude');

const A_SHELL = pane('w1:p1', 'a shell', 'idle', null);

const A_DORMANT_PANE = pane('w3:p2', 'notes', 'dormant', null);

const A_LONG_LINE = 'That line is long, and a shell may have cut it.';

function pane(id: string, project: string, state: PaneState, agent: string | null): Pane {
  return { id, project, agent, activity: null, state };
}

function turn(text: string): Turn {
  return { role: 'agent', text, cut: false };
}

interface Opened {
  readonly middleman: FakeMiddleman;
  readonly speech: FakeDictation;
}

async function opening(
  holding = AN_AGENT,
  turns: readonly Turn[] = [turn('Which one shall I take?')],
): Promise<Opened> {
  const middleman = createFakeMiddleman();
  const speech = createFakeDictation();
  middleman.shows([holding]);
  middleman.showsThePane(holding.id, turns);
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

async function holdingIt(): Promise<void> {
  await fireEvent(screen.getByLabelText('The Slab'), 'longPress');
}

async function lettingGo(): Promise<void> {
  await fireEvent(screen.getByLabelText('The Slab'), 'pressOut');
}

async function hearing(speech: FakeDictation, words: string): Promise<void> {
  await act(() => {
    speech.hears(words);
  });
  await screen.findByText(words);
}

async function breakingOff(speech: FakeDictation, why: string): Promise<void> {
  await act(() => {
    speech.breaksOff(why);
  });
  await screen.findByText('Cut short');
}

async function dictating(speech: FakeDictation, words: string): Promise<void> {
  await holdingIt();
  await hearing(speech, words);
  await lettingGo();
  await screen.findByDisplayValue(words);
}

async function pressing(what: string): Promise<void> {
  await fireEvent.press(screen.getByText(what));
}

describe('the Slab', () => {
  test('is a hold bar on a pane holding an agent', async () => {
    await opening();

    expect(screen.getByText(THE_BAR)).toBeOnTheScreen();
  });

  test('is there on a plain shell too', async () => {
    await opening(A_SHELL, [{ role: 'pane', text: '$ ', cut: false }]);

    expect(screen.getByText(THE_BAR)).toBeOnTheScreen();
  });

  test('is there on a dormant pane too', async () => {
    await opening(A_DORMANT_PANE, [
      { role: 'pane', text: 'the conversation that finished here', cut: false },
    ]);

    expect(screen.getByText(THE_BAR)).toBeOnTheScreen();
  });

  test('settles on the words while it is still held, without sending them', async () => {
    const { middleman, speech } = await opening();

    await holdingIt();
    await hearing(speech, 'take the second');
    speech.settlesOn('Take the second one.');
    await act(() => {
      speech.settles();
    });

    expect(await screen.findByDisplayValue('Take the second one.')).toBeOnTheScreen();
    expect(middleman.whatWasSent()).toEqual([]);
  });

  test('dictates while it is held, showing the words as they are heard', async () => {
    const { speech } = await opening();

    await holdingIt();
    await hearing(speech, 'take the second');

    expect(speech.beingHeld()).toBe(true);
    expect(await screen.findByText('Listening')).toBeOnTheScreen();
    expect(screen.getByText('take the second')).toBeOnTheScreen();
  });

  test('leaves the turns above uncovered while it dictates', async () => {
    const { speech } = await opening();

    await holdingIt();
    await hearing(speech, 'take the second');

    expect(screen.getByText('Which one shall I take?')).toBeOnTheScreen();
  });

  test('ends capture without sending when it is let go', async () => {
    const { middleman, speech } = await opening();

    await dictating(speech, 'take the second one');

    expect(speech.beingHeld()).toBe(false);
    expect(middleman.whatWasSent()).toEqual([]);
    expect(screen.getByText('Send')).toBeOnTheScreen();
    expect(screen.getByText('Discard')).toBeOnTheScreen();
  });

  test('says nothing was heard rather than drafting an empty answer', async () => {
    await opening();

    await holdingIt();
    await lettingGo();

    expect(await screen.findByText('Nothing was heard.')).toBeOnTheScreen();
    expect(screen.getByText(THE_BAR)).toBeOnTheScreen();
  });

  test('sends the dictated words as they were edited', async () => {
    const { middleman, speech } = await opening();
    await dictating(speech, 'take the second one');

    await fireEvent.changeText(screen.getByLabelText('What to send'), 'take the third one');
    await pressing('Send');
    await screen.findByText('Queued');

    expect(middleman.whatWasSent()).toEqual([
      { paneId: THE_PANE, text: 'take the third one', images: [] },
    ]);
  });

  test('sends the words the engine settled on rather than the last partial', async () => {
    const { middleman, speech } = await opening();

    await holdingIt();
    await hearing(speech, 'take the sec');
    speech.settlesOn('Take the second one.');
    await lettingGo();
    await screen.findByDisplayValue('Take the second one.');
    await pressing('Send');
    await screen.findByText('Queued');

    expect(middleman.whatWasSent()).toEqual([
      { paneId: THE_PANE, text: 'Take the second one.', images: [] },
    ]);
  });

  test('throws the transcript away on a discard, and sends nothing', async () => {
    const { middleman, speech } = await opening();
    await dictating(speech, 'take the second one');

    await pressing('Discard');

    expect(await screen.findByText(THE_BAR)).toBeOnTheScreen();
    expect(screen.queryByDisplayValue('take the second one')).not.toBeOnTheScreen();
    expect(middleman.whatWasSent()).toEqual([]);
  });
});

describe('what the Slab guarantees about a send', () => {
  async function sending(
    holding: Pane,
    settle: (middleman: FakeMiddleman) => void,
  ): Promise<FakeMiddleman> {
    const { middleman, speech } = await opening(holding);
    settle(middleman);
    await dictating(speech, 'take the second one');
    await pressing('Send');
    return middleman;
  }

  test('confirms with the state the agent is in now when it picked the text up', async () => {
    await sending(AN_AGENT, (middleman) => {
      middleman.picksUpWhatIsSent('thinking');
    });

    expect(await screen.findByText('Confirmed')).toBeOnTheScreen();
    expect(screen.getByText('The agent picked it up. Now it is thinking.')).toBeOnTheScreen();
  });

  test('claims only that it was sent when the pane holds no agent', async () => {
    await sending(A_SHELL, (middleman) => {
      middleman.onlyQueuesWhatIsSent();
    });

    expect(await screen.findByText('Sent')).toBeOnTheScreen();
    expect(screen.getByText('There is no agent here to confirm it.')).toBeOnTheScreen();
    expect(screen.queryByText('Confirmed')).not.toBeOnTheScreen();
    expect(screen.queryByText(A_LONG_LINE)).not.toBeOnTheScreen();
  });

  test('warns that a long line may have been cut', async () => {
    await sending(A_SHELL, (middleman) => {
      middleman.onlyQueuesWhatIsSent(true);
    });

    expect(await screen.findByText(A_LONG_LINE)).toBeOnTheScreen();
  });

  test('says queued rather than delivered when the agent is mid-turn', async () => {
    await sending(pane(THE_PANE, 'viu', 'thinking', 'claude'), (middleman) => {
      middleman.onlyQueuesWhatIsSent();
    });

    expect(await screen.findByText('Queued')).toBeOnTheScreen();
    expect(
      screen.getByText('The agent is mid-turn. It has not been seen to take it.'),
    ).toBeOnTheScreen();
  });

  test('says the machine could not be reached, and keeps the words', async () => {
    await sending(AN_AGENT, (middleman) => {
      middleman.cannotBeReachedForASend('no route to the machine');
    });

    expect(await screen.findByText('Cannot reach the machine')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('take the second one')).toBeOnTheScreen();
  });

  test('says the machine never answered at all, and keeps the words', async () => {
    await sending(AN_AGENT, (middleman) => {
      middleman.failsToAnswerAtAll('Network request failed');
    });

    expect(await screen.findByText('Cannot reach the machine')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('take the second one')).toBeOnTheScreen();
  });

  test('names a trouble the send hit, and keeps the words', async () => {
    await sending(AN_AGENT, (middleman) => {
      middleman.troublesTheSend({
        kind: 'pane-not-accepting-input',
        paneId: THE_PANE,
        message: 'the agent in it stalled on the prompt',
      });
    });

    expect(await screen.findByText('That pane is not taking input')).toBeOnTheScreen();
    expect(screen.getByText('the agent in it stalled on the prompt')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('take the second one')).toBeOnTheScreen();
  });
});

describe('dictation cut short', () => {
  async function cutShort(): Promise<Opened> {
    const opened = await opening();
    await holdingIt();
    await hearing(opened.speech, 'take the sec');
    await breakingOff(opened.speech, 'the recogniser stopped');
    return opened;
  }

  test('keeps the partial words and marks them cut short', async () => {
    await cutShort();

    expect(screen.getByText('the recogniser stopped')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('take the sec')).toBeOnTheScreen();
  });

  test('lets the partial words be edited and sent', async () => {
    const { middleman } = await cutShort();

    await fireEvent.changeText(screen.getByLabelText('What to send'), 'take the second');
    await pressing('Send');
    await screen.findByText('Queued');

    expect(middleman.whatWasSent()).toEqual([
      { paneId: THE_PANE, text: 'take the second', images: [] },
    ]);
  });

  test('keeps the cut-short mark when the send could not be made', async () => {
    const { middleman } = await cutShort();
    middleman.troublesTheSend({
      kind: 'pane-gone',
      paneId: THE_PANE,
      message: 'herdr knows no pane w2:p6J',
    });

    await pressing('Send');

    expect(await screen.findByText('That pane is gone')).toBeOnTheScreen();
    expect(screen.getByText('Cut short')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('take the sec')).toBeOnTheScreen();
  });

  test('lets the partial words be discarded', async () => {
    const { middleman } = await cutShort();

    await pressing('Discard');

    expect(await screen.findByText(THE_BAR)).toBeOnTheScreen();
    expect(middleman.whatWasSent()).toEqual([]);
  });
});
