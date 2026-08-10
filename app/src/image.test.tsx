import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { Pane, PaneState } from '@viu/protocol';

import { App } from './App';
import type { Machine } from './machine';
import type { Picture } from './picking/picking';
import { createFakeDictation, type FakeDictation } from './testing/fake-dictation';
import { createFakeMiddleman, type FakeMiddleman } from './testing/fake-middleman';
import { createFakePicking, type FakePicking } from './testing/fake-picking';
import { machineInMemory } from './testing/machine-in-memory';

const THE_MACHINE: Machine = { host: 'desk.tail1234.ts.net', port: 8787 };

const THE_PANE = 'w2:p6J';

const THE_BAR = 'Hold to talk, tap to type';

const THE_BUTTON = 'Send an image';

const AN_AGENT = pane(THE_PANE, 'viu', 'needs-you', 'claude');

const A_SHELL = pane('w1:p1', 'a shell', 'idle', null);

const A_DORMANT_PANE = pane('w3:p2', 'notes', 'dormant', null);

const A_PICTURE: Picture = { format: 'jpeg', base64: 'AAAABBBB' };

function pane(id: string, project: string, state: PaneState, agent: string | null): Pane {
  return { id, project, agent, activity: null, state };
}

interface Opened {
  readonly middleman: FakeMiddleman;
  readonly picker: FakePicking;
}

async function opening(
  holding = AN_AGENT,
  speech: FakeDictation = createFakeDictation(),
): Promise<Opened> {
  const middleman = createFakeMiddleman();
  const picker = createFakePicking();
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
  return { middleman, picker };
}

async function pressing(what: string): Promise<void> {
  await fireEvent.press(screen.getByText(what));
}

async function picking(picker: FakePicking, from = 'Photo library'): Promise<void> {
  picker.picks(A_PICTURE);
  await pressing(THE_BUTTON);
  await pressing(from);
  await screen.findByLabelText('The image to send');
}

async function captioning(said: string): Promise<void> {
  await fireEvent.changeText(screen.getByLabelText('What to say about the image'), said);
}

describe('sending an image from an open pane', () => {
  test('offers the image button on a pane holding an agent', async () => {
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

  test('offers both the photo library and the camera', async () => {
    await opening();

    await pressing(THE_BUTTON);

    expect(screen.getByLabelText('Where to take the image from')).toBeOnTheScreen();
    expect(screen.getByText('Photo library')).toBeOnTheScreen();
    expect(screen.getByText('Camera')).toBeOnTheScreen();
  });

  test('is not offered while there are dictated words waiting to be sent', async () => {
    const speech = createFakeDictation();
    await opening(AN_AGENT, speech);
    await fireEvent(screen.getByLabelText('The Slab'), 'longPress');
    await act(() => {
      speech.hears('take the second one');
    });

    expect(screen.queryByText(THE_BUTTON)).not.toBeOnTheScreen();

    await fireEvent(screen.getByLabelText('The Slab'), 'pressOut');
    await screen.findByDisplayValue('take the second one');

    expect(screen.queryByText(THE_BUTTON)).not.toBeOnTheScreen();
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

  test('takes the image from the library when that is what was asked for', async () => {
    const { picker } = await opening();

    await picking(picker, 'Photo library');

    expect(picker.whatWasPickedFrom()).toEqual(['library']);
  });

  test('takes the image from the camera when that is what was asked for', async () => {
    const { picker } = await opening();

    await picking(picker, 'Camera');

    expect(picker.whatWasPickedFrom()).toEqual(['camera']);
  });

  test('picks nothing when the chooser is waved away', async () => {
    const { picker } = await opening();

    await pressing(THE_BUTTON);
    await pressing('Never mind');

    expect(picker.whatWasPickedFrom()).toEqual([]);
    expect(screen.getByText(THE_BUTTON)).toBeOnTheScreen();
  });

  test('sends the image and its caption as one send into the pane it was opened on', async () => {
    const { middleman, picker } = await opening();
    await picking(picker);

    await captioning('this button is wrong');
    await pressing('Send the image');
    await screen.findByText('Queued');

    expect(middleman.whatImagesWereSent()).toEqual([
      {
        paneId: THE_PANE,
        image: {
          format: 'jpeg',
          base64: 'AAAABBBB',
          caption: 'this button is wrong',
        },
      },
    ]);
    expect(middleman.whatWasSent()).toEqual([]);
  });

  test('sends an image on its own when nothing was said about it', async () => {
    const { middleman, picker } = await opening();
    await picking(picker);

    await pressing('Send the image');
    await screen.findByText('Queued');

    expect(middleman.whatImagesWereSent()).toEqual([
      {
        paneId: THE_PANE,
        image: { format: 'jpeg', base64: 'AAAABBBB', caption: null },
      },
    ]);
  });

  test('sends one image at a time, with no way to add a second to the same send', async () => {
    const { middleman, picker } = await opening();
    await picking(picker);

    expect(screen.queryByText(THE_BUTTON)).not.toBeOnTheScreen();

    await pressing('Send the image');
    await screen.findByText('Queued');
    await picking(picker);
    await pressing('Send the image');
    await screen.findByText('Queued');

    expect(middleman.whatImagesWereSent()).toHaveLength(2);
  });

  test('keeps the picture and its caption when the pane says something new', async () => {
    const { middleman, picker } = await opening();
    await picking(picker);
    await captioning('this button is wrong');

    await act(() => {
      middleman.showsThePane(THE_PANE, [
        { role: 'agent', text: 'I have moved on to the next one.', cut: false },
      ]);
    });

    expect(await screen.findByText('I have moved on to the next one.')).toBeOnTheScreen();
    expect(screen.getByLabelText('The image to send')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('this button is wrong')).toBeOnTheScreen();
  });

  test('throws the image away on a discard, and sends nothing', async () => {
    const { middleman, picker } = await opening();
    await picking(picker);

    await pressing('Discard');

    expect(await screen.findByText(THE_BAR)).toBeOnTheScreen();
    expect(middleman.whatImagesWereSent()).toEqual([]);
  });

  test('says no image was picked when the picker came back empty-handed', async () => {
    const { middleman, picker } = await opening();
    picker.picksNothing();

    await pressing(THE_BUTTON);
    await pressing('Photo library');

    expect(await screen.findByText('No image was picked.')).toBeOnTheScreen();
    expect(middleman.whatImagesWereSent()).toEqual([]);
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

describe('what the Slab says about an image it sent', () => {
  test('confirms it when the agent was seen picking it up', async () => {
    const { middleman, picker } = await opening();
    middleman.picksUpWhatIsSent('thinking');
    await picking(picker);

    await pressing('Send the image');

    expect(await screen.findByText('Confirmed')).toBeOnTheScreen();
    expect(screen.getByText('The agent picked it up. Now it is thinking.')).toBeOnTheScreen();
  });

  test('queues it when the agent was not seen to take it', async () => {
    const { middleman, picker } = await opening();
    middleman.onlyQueuesWhatIsSent();
    await picking(picker);

    await pressing('Send the image');

    expect(await screen.findByText('Queued')).toBeOnTheScreen();
    expect(screen.getByText('The agent was not seen to take it.')).toBeOnTheScreen();
  });

  test('warns that a long line may have been cut', async () => {
    const { middleman, picker } = await opening();
    middleman.onlyQueuesWhatIsSent(true);
    await picking(picker);

    await pressing('Send the image');

    expect(await screen.findByText('Queued')).toBeOnTheScreen();
    expect(screen.getByText('That line is long, and a shell may have cut it.')).toBeOnTheScreen();
  });

  test('says only that it was sent when the agent left the pane before the send', async () => {
    const { middleman, picker } = await opening();
    await picking(picker);
    await act(() => {
      middleman.shows([pane(THE_PANE, 'viu', 'idle', null)]);
    });

    await pressing('Send the image');

    expect(await screen.findByText('Sent')).toBeOnTheScreen();
    expect(screen.getByText('There is no agent here to confirm it.')).toBeOnTheScreen();
  });

  test('names the trouble the machine hit and keeps the image to send again', async () => {
    const { picker, middleman } = await opening();
    middleman.troublesTheSend({
      kind: 'attachment-not-stored',
      message: 'the image could not be written into /home/o/.viu/attachments',
    });
    await picking(picker);
    await captioning('this button is wrong');

    await pressing('Send the image');

    expect(
      await screen.findByText('the image could not be written into /home/o/.viu/attachments'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('The image to send')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('this button is wrong')).toBeOnTheScreen();
  });

  test('keeps the image when the machine could not be reached at all', async () => {
    const { picker, middleman } = await opening();
    middleman.cannotBeReachedForASend('no route to the machine');
    await picking(picker);

    await pressing('Send the image');

    expect(await screen.findByText('no route to the machine')).toBeOnTheScreen();
    expect(screen.getByLabelText('The image to send')).toBeOnTheScreen();
  });
});
