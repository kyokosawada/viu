import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { Image, Pane, PaneState } from '@viu/protocol';

import { App } from './App';
import type { Machine } from './machine';
import { createFakeDictation, type FakeDictation } from './testing/fake-dictation';
import { createFakeMiddleman, type FakeMiddleman } from './testing/fake-middleman';
import { createFakePicking, type FakePicking } from './testing/fake-picking';
import { machineInMemory } from './testing/machine-in-memory';

const THE_MACHINE: Machine = { host: 'desk.tail1234.ts.net', port: 8787 };

const THE_PANE = 'w2:p6J';

const THE_BAR = 'Hold to talk, tap to type';

const THE_BUTTON = 'Attach an image';

const AN_AGENT = pane(THE_PANE, 'viu', 'needs-you', 'claude');

const A_SHELL = pane('w1:p1', 'a shell', 'idle', null);

const A_DORMANT_PANE = pane('w3:p2', 'notes', 'dormant', null);

const A_PICTURE: Image = { format: 'jpeg', base64: 'AAAABBBB' };

const ANOTHER_PICTURE: Image = { format: 'png', base64: 'CCCCDDDD' };

function pane(id: string, project: string, state: PaneState, agent: string | null): Pane {
  return { id, project, agent, activity: null, state };
}

interface Opened {
  readonly middleman: FakeMiddleman;
  readonly picker: FakePicking;
  readonly speech: FakeDictation;
}

async function opening(holding = AN_AGENT): Promise<Opened> {
  const middleman = createFakeMiddleman();
  const picker = createFakePicking();
  const speech = createFakeDictation();
  middleman.shows([holding]);
  middleman.showsThePane(holding.id, [
    { role: 'agent', text: 'Which one shall I take?', cut: false },
  ]);
  await render(
    <App
      middleman={middleman.at}
      machines={machineInMemory(THE_MACHINE)}
      picking={picker.picker}
      dictation={speech.engine}
    />,
  );
  await fireEvent.press(await screen.findByText(holding.project ?? holding.id));
  await screen.findByLabelText('The Slab');
  return { middleman, picker, speech };
}

async function pressing(what: string): Promise<void> {
  await fireEvent.press(screen.getByText(what));
}

async function attaching(
  picker: FakePicking,
  picture: Image = A_PICTURE,
  from = 'Photo library',
): Promise<void> {
  picker.picks(picture);
  await pressing(THE_BUTTON);
  await pressing(from);
  await screen.findByLabelText('What is attached');
}

async function typing(said: string): Promise<void> {
  if (screen.queryByLabelText('What to send') === null) {
    await fireEvent.press(screen.getByLabelText('The Slab'));
  }
  await fireEvent.changeText(screen.getByLabelText('What to send'), said);
}

async function caretAfter(said: string): Promise<void> {
  const field = screen.getByLabelText('What to send');
  const at = String(field.props.value).indexOf(said) + said.length;
  await fireEvent(field, 'selectionChange', {
    nativeEvent: { selection: { start: at, end: at } },
  });
}

async function dictating(
  speech: FakeDictation,
  said: string,
  shows = said,
): Promise<void> {
  await fireEvent(screen.getByLabelText('The Slab'), 'longPress');
  await act(() => {
    speech.hears(said);
  });
  await fireEvent(screen.getByLabelText('The Slab'), 'pressOut');
  await screen.findByDisplayValue(shows);
}

describe('attaching an image to what is being composed', () => {
  test('offers the attach control on a pane holding an agent', async () => {
    await opening();

    expect(screen.getByText(THE_BUTTON)).toBeOnTheScreen();
  });

  test('hides it on a bare shell, where a path means nothing', async () => {
    await opening(A_SHELL);

    expect(screen.queryByText(THE_BUTTON)).not.toBeOnTheScreen();
    expect(screen.getByText(THE_BAR)).toBeOnTheScreen();
  });

  test('hides it on a dormant pane holding no agent', async () => {
    await opening(A_DORMANT_PANE);

    expect(screen.queryByText(THE_BUTTON)).not.toBeOnTheScreen();
  });

  test('offers it while typed words are waiting to be sent', async () => {
    await opening();

    await typing('this button is wrong');

    expect(screen.getByText(THE_BUTTON)).toBeOnTheScreen();
  });

  test('offers it while dictated words are waiting to be sent', async () => {
    const { speech } = await opening();

    await dictating(speech, 'take the second one');

    expect(screen.getByText(THE_BUTTON)).toBeOnTheScreen();
  });

  test('hides it on a bare shell even while words are waiting', async () => {
    await opening(A_SHELL);

    await typing('git status');

    expect(screen.queryByText(THE_BUTTON)).not.toBeOnTheScreen();
  });

  test('offers both the photo library and the camera', async () => {
    await opening();

    await pressing(THE_BUTTON);

    expect(screen.getByLabelText('Where to take the image from')).toBeOnTheScreen();
    expect(screen.getByText('Photo library')).toBeOnTheScreen();
    expect(screen.getByText('Camera')).toBeOnTheScreen();
  });

  test('shows each attached image as a tag, numbered in the order it was attached', async () => {
    const { picker } = await opening();

    await attaching(picker);
    await attaching(picker, ANOTHER_PICTURE);

    expect(screen.getByText('[Image #1]')).toBeOnTheScreen();
    expect(screen.getByText('[Image #2]')).toBeOnTheScreen();
  });

  test('takes the image from the library when that is what was asked for', async () => {
    const { picker } = await opening();

    await attaching(picker, A_PICTURE, 'Photo library');

    expect(picker.whatWasPickedFrom()).toEqual(['library']);
  });

  test('takes the image from the camera when that is what was asked for', async () => {
    const { picker } = await opening();

    await attaching(picker, A_PICTURE, 'Camera');

    expect(picker.whatWasPickedFrom()).toEqual(['camera']);
  });

  test('picks nothing when the chooser is waved away, and keeps what was composed', async () => {
    const { picker } = await opening();
    await typing('this button is wrong');

    await pressing(THE_BUTTON);
    await pressing('Never mind');

    expect(picker.whatWasPickedFrom()).toEqual([]);
    expect(await screen.findByDisplayValue('this button is wrong')).toBeOnTheScreen();
  });

  test('drops an attached image on a tap of its tag, before anything is sent', async () => {
    const { middleman, picker } = await opening();
    await attaching(picker);
    await attaching(picker, ANOTHER_PICTURE);

    await fireEvent.press(screen.getByLabelText('Remove image 1'));

    expect(screen.queryByText('[Image #2]')).not.toBeOnTheScreen();
    await pressing('Send');
    await screen.findByText('Queued');
    expect(middleman.whatWasSent()).toEqual([
      { paneId: THE_PANE, parts: [{ image: ANOTHER_PICTURE }] },
    ]);
  });

  test('says the phone has nothing to pick with rather than opening nothing', async () => {
    const middleman = createFakeMiddleman();
    middleman.shows([AN_AGENT]);
    middleman.showsThePane(THE_PANE, []);
    await render(<App middleman={middleman.at} machines={machineInMemory(THE_MACHINE)} />);
    await fireEvent.press(await screen.findByText('viu'));

    await pressing(THE_BUTTON);
    await pressing('Photo library');

    expect(
      await screen.findByText('this phone has nothing to pick an image with'),
    ).toBeOnTheScreen();
  });

  test('says no image was picked when the picker came back empty-handed', async () => {
    const { middleman, picker } = await opening();
    picker.picksNothing();

    await pressing(THE_BUTTON);
    await pressing('Photo library');

    expect(await screen.findByText('No image was picked.')).toBeOnTheScreen();
    expect(middleman.whatWasSent()).toEqual([]);
  });

  test('says what stopped the picker rather than waiting on an image forever', async () => {
    const { picker } = await opening();
    picker.breaksOff('Viu was not allowed to use the camera');

    await pressing(THE_BUTTON);
    await pressing('Camera');

    expect(await screen.findByText('Viu was not allowed to use the camera')).toBeOnTheScreen();
    expect(screen.getByText(THE_BUTTON)).toBeOnTheScreen();
  });

  test('says so when the picker never answers at all', async () => {
    const { picker } = await opening();
    picker.failsToAnswerAtAll('the picker fell over');

    await pressing(THE_BUTTON);
    await pressing('Photo library');

    expect(await screen.findByText('the picker stopped without saying why')).toBeOnTheScreen();
  });
});

describe('one send carrying words and images together', () => {
  test('sends the image standing where the owner placed it in the words', async () => {
    const { middleman, picker } = await opening();
    await typing('look at this here');
    await caretAfter('look at this');
    await attaching(picker);

    await pressing('Send');
    await screen.findByText('Queued');

    expect(middleman.whatWasSent()).toEqual([
      {
        paneId: THE_PANE,
        parts: [{ text: 'look at this ' }, { image: A_PICTURE }, { text: ' here' }],
      },
    ]);
  });

  test('sends the typed words and the image as one send into the pane it was opened on', async () => {
    const { middleman, picker } = await opening();
    await typing('this button is wrong');
    await attaching(picker);

    await pressing('Send');
    await screen.findByText('Queued');

    expect(middleman.whatWasSent()).toEqual([
      {
        paneId: THE_PANE,
        parts: [{ text: 'this button is wrong ' }, { image: A_PICTURE }],
      },
    ]);
  });

  test('sends dictated words and an image as one send', async () => {
    const { middleman, picker, speech } = await opening();
    await dictating(speech, 'take the second one');
    await attaching(picker);

    await pressing('Send');
    await screen.findByText('Queued');

    expect(middleman.whatWasSent()).toEqual([
      {
        paneId: THE_PANE,
        parts: [{ text: 'take the second one ' }, { image: A_PICTURE }],
      },
    ]);
  });

  test('sends several images each where it was placed, in the order they were attached', async () => {
    const { middleman, picker } = await opening();
    await attaching(picker);
    await attaching(picker, ANOTHER_PICTURE);

    await pressing('Send');
    await screen.findByText('Queued');

    expect(middleman.whatWasSent()).toEqual([
      {
        paneId: THE_PANE,
        parts: [{ image: A_PICTURE }, { text: ' ' }, { image: ANOTHER_PICTURE }],
      },
    ]);
  });

  test('sends an image on its own when nothing was said about it', async () => {
    const { middleman, picker } = await opening();
    await attaching(picker);

    await pressing('Send');
    await screen.findByText('Queued');

    expect(middleman.whatWasSent()).toEqual([
      { paneId: THE_PANE, parts: [{ image: A_PICTURE }] },
    ]);
  });

  test('drops the image with the token when the owner rubs it out of the words', async () => {
    const { middleman, picker } = await opening();
    await typing('this button is wrong');
    await attaching(picker);

    await typing('this button is wrong');
    await pressing('Send');
    await screen.findByText('Queued');

    expect(screen.queryByText('[Image #1]')).not.toBeOnTheScreen();
    expect(middleman.whatWasSent()).toEqual([
      { paneId: THE_PANE, parts: [{ text: 'this button is wrong' }] },
    ]);
  });

  test('empties the Slab once the send has been answered', async () => {
    const { middleman, picker } = await opening();
    await typing('this button is wrong');
    await attaching(picker);

    await pressing('Send');
    await screen.findByText('Queued');

    expect(await screen.findByText(THE_BAR)).toBeOnTheScreen();
    expect(screen.queryByText('[Image #1]')).not.toBeOnTheScreen();
    expect(middleman.whatWasSent()).toHaveLength(1);
  });

  test('keeps the words and the images when the pane says something new', async () => {
    const { middleman, picker } = await opening();
    await typing('this button is wrong');
    await attaching(picker);

    await act(() => {
      middleman.showsThePane(THE_PANE, [
        { role: 'agent', text: 'I have moved on to the next one.', cut: false },
      ]);
    });

    expect(await screen.findByText('I have moved on to the next one.')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('this button is wrong [Image #1]')).toBeOnTheScreen();
    expect(screen.getByText('[Image #1]')).toBeOnTheScreen();
  });

  test('throws the words and the images away on a discard, and sends nothing', async () => {
    const { middleman, picker } = await opening();
    await typing('this button is wrong');
    await attaching(picker);

    await pressing('Discard');

    expect(await screen.findByText(THE_BAR)).toBeOnTheScreen();
    expect(screen.queryByText('[Image #1]')).not.toBeOnTheScreen();
    expect(middleman.whatWasSent()).toEqual([]);
  });
});

describe('what the Slab says about a send carrying an image', () => {
  test('confirms it when the agent was seen picking it up', async () => {
    const { middleman, picker } = await opening();
    middleman.picksUpWhatIsSent('thinking');
    await attaching(picker);

    await pressing('Send');

    expect(await screen.findByText('Confirmed')).toBeOnTheScreen();
    expect(screen.getByText('The agent picked it up. Now it is thinking.')).toBeOnTheScreen();
  });

  test('queues it when the agent was not seen to take it', async () => {
    const { middleman, picker } = await opening();
    middleman.onlyQueuesWhatIsSent();
    await attaching(picker);

    await pressing('Send');

    expect(await screen.findByText('Queued')).toBeOnTheScreen();
    expect(screen.getByText('The agent was not seen to take it.')).toBeOnTheScreen();
  });

  test('warns that a long line may have been cut', async () => {
    const { middleman, picker } = await opening();
    middleman.onlyQueuesWhatIsSent(true);
    await attaching(picker);

    await pressing('Send');

    expect(await screen.findByText('Queued')).toBeOnTheScreen();
    expect(screen.getByText('That line is long, and a shell may have cut it.')).toBeOnTheScreen();
  });

  test('says only that it was sent when the agent left the pane before the send', async () => {
    const { middleman, picker } = await opening();
    await attaching(picker);
    await act(() => {
      middleman.shows([pane(THE_PANE, 'viu', 'idle', null)]);
    });

    await pressing('Send');

    expect(await screen.findByText('Sent')).toBeOnTheScreen();
    expect(screen.getByText('There is no agent here to confirm it.')).toBeOnTheScreen();
  });

  test('names the trouble the machine hit and keeps the whole composition', async () => {
    const { picker, middleman } = await opening();
    middleman.troublesTheSend({
      kind: 'attachment-not-stored',
      message: 'the image could not be written into /home/o/.viu/attachments',
    });
    await typing('this button is wrong');
    await attaching(picker);

    await pressing('Send');

    expect(
      await screen.findByText('the image could not be written into /home/o/.viu/attachments'),
    ).toBeOnTheScreen();
    expect(screen.getByDisplayValue('this button is wrong [Image #1]')).toBeOnTheScreen();
    expect(screen.getByText('[Image #1]')).toBeOnTheScreen();
  });

  test('keeps the composition when the machine could not be reached at all', async () => {
    const { picker, middleman } = await opening();
    middleman.cannotBeReachedForASend('no route to the machine');
    await attaching(picker);

    await pressing('Send');

    expect(await screen.findByText('no route to the machine')).toBeOnTheScreen();
    expect(screen.getByText('[Image #1]')).toBeOnTheScreen();
  });
});

describe('dictating into a composition that is already standing', () => {
  test('offers the hold bar while words and an image are waiting', async () => {
    const { picker } = await opening();
    await typing('look at this');
    await attaching(picker);

    expect(screen.getByLabelText('The Slab')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('look at this [Image #1]')).toBeOnTheScreen();
  });

  test('sends what was dictated, attached and dictated again in the order it was composed', async () => {
    const { middleman, picker, speech } = await opening();

    await dictating(speech, 'look at this');
    await attaching(picker);
    await dictating(
      speech,
      'and tell me what is wrong',
      'look at this [Image #1] and tell me what is wrong',
    );

    await pressing('Send');
    await screen.findByText('Queued');

    expect(middleman.whatWasSent()).toEqual([
      {
        paneId: THE_PANE,
        parts: [
          { text: 'look at this ' },
          { image: A_PICTURE },
          { text: ' and tell me what is wrong' },
        ],
      },
    ]);
  });

  test('lands the dictated words at the point the owner is composing at', async () => {
    const { middleman, picker, speech } = await opening();
    await typing('look at this here');
    await attaching(picker);
    await caretAfter('look at this');

    await dictating(speech, 'and this', 'look at this and this here [Image #1]');

    await pressing('Send');
    await screen.findByText('Queued');

    expect(middleman.whatWasSent()).toEqual([
      {
        paneId: THE_PANE,
        parts: [{ text: 'look at this and this here ' }, { image: A_PICTURE }],
      },
    ]);
  });

  test('keeps the standing composition in sight while it is listening', async () => {
    const { picker, speech } = await opening();
    await typing('look at this');
    await attaching(picker);

    await fireEvent(screen.getByLabelText('The Slab'), 'longPress');
    await act(() => {
      speech.hears('and tell me');
    });

    expect(screen.getByDisplayValue('look at this [Image #1]')).toBeOnTheScreen();
    expect(screen.getByText('and tell me')).toBeOnTheScreen();
  });

  test('offers nothing to act on the composition with until the hold is let go', async () => {
    const { middleman, picker, speech } = await opening();
    await typing('look at this');
    await attaching(picker);

    await fireEvent(screen.getByLabelText('The Slab'), 'longPress');
    await act(() => {
      speech.hears('and tell me');
    });

    expect(screen.queryByText('Send')).not.toBeOnTheScreen();
    expect(screen.queryByText('Discard')).not.toBeOnTheScreen();
    expect(screen.queryByLabelText('The quick-key bar')).not.toBeOnTheScreen();

    await fireEvent(screen.getByLabelText('The Slab'), 'pressOut');
    await screen.findByDisplayValue('look at this [Image #1] and tell me');
    await pressing('Send');
    await screen.findByText('Queued');

    expect(middleman.whatWasSent()).toHaveLength(1);
  });

  test('leaves the standing words alone when a hold was cut short having heard nothing', async () => {
    const { middleman, picker, speech } = await opening();
    await typing('look at this here');
    await attaching(picker);
    await caretAfter('look at this');

    await fireEvent(screen.getByLabelText('The Slab'), 'longPress');
    await act(() => {
      speech.breaksOff('the engine stopped listening');
    });

    expect(await screen.findByText('the engine stopped listening')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('look at this here [Image #1]')).toBeOnTheScreen();

    await pressing('Send');
    await screen.findByText('Queued');

    expect(middleman.whatWasSent()).toEqual([
      {
        paneId: THE_PANE,
        parts: [{ text: 'look at this here ' }, { image: A_PICTURE }],
      },
    ]);
  });
});
