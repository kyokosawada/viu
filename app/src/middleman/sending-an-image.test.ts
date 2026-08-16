import type { Image, Send } from '@viu/protocol';

import type { Machine } from '../machine';
import { createFakeMiddleman } from '../testing/fake-middleman';

const THE_MACHINE: Machine = { host: 'desk.tail1234.ts.net', port: 8787 };

const A_PHOTO: Image = { format: 'jpeg', base64: 'AAAA' };

const A_SCREENSHOT: Image = { format: 'png', base64: 'BBBB' };

const WITH_A_PHOTO: Send = { text: 'this button is wrong', images: [A_PHOTO] };

describe('sending words and images down the one door to the machine', () => {
  test('hands the words and the image to the pane it names, as one send', async () => {
    const middleman = createFakeMiddleman();

    await middleman.at(THE_MACHINE).send('w2:p6J', WITH_A_PHOTO);

    expect(middleman.whatWasSent()).toEqual([
      { paneId: 'w2:p6J', text: 'this button is wrong', images: [A_PHOTO] },
    ]);
  });

  test('carries several images in the order they were attached', async () => {
    const middleman = createFakeMiddleman();

    await middleman
      .at(THE_MACHINE)
      .send('w2:p6J', { text: 'both of these', images: [A_PHOTO, A_SCREENSHOT] });

    expect(middleman.whatWasSent()).toEqual([
      { paneId: 'w2:p6J', text: 'both of these', images: [A_PHOTO, A_SCREENSHOT] },
    ]);
  });

  test('carries an image with no words at all', async () => {
    const middleman = createFakeMiddleman();

    await middleman.at(THE_MACHINE).send('w2:p6J', { text: '', images: [A_PHOTO] });

    expect(middleman.whatWasSent()).toEqual([
      { paneId: 'w2:p6J', text: '', images: [A_PHOTO] },
    ]);
  });

  test('answers with the same guarantee a send of words does', async () => {
    const middleman = createFakeMiddleman();
    middleman.picksUpWhatIsSent('thinking');

    const reach = await middleman.at(THE_MACHINE).send('w2:p6J', WITH_A_PHOTO);

    expect(reach).toEqual({
      kind: 'reached',
      got: { paneId: 'w2:p6J', confidence: 'confirmed', state: 'thinking' },
    });
  });

  test('answers queued where nothing was seen to take it', async () => {
    const middleman = createFakeMiddleman();
    middleman.onlyQueuesWhatIsSent();

    const reach = await middleman.at(THE_MACHINE).send('w1:pA', WITH_A_PHOTO);

    expect(reach).toEqual({
      kind: 'reached',
      got: { paneId: 'w1:pA', confidence: 'queued', mayBeCut: false },
    });
  });

  test('names a trouble the machine hit rather than a generic failure', async () => {
    const middleman = createFakeMiddleman();
    middleman.troublesTheSend({
      kind: 'attachment-not-stored',
      message: 'the image could not be written into /home/o/.viu/attachments',
    });

    const reach = await middleman.at(THE_MACHINE).send('w2:p6J', WITH_A_PHOTO);

    expect(reach).toMatchObject({ kind: 'trouble', trouble: { kind: 'attachment-not-stored' } });
  });

  test('says the machine could not be reached, which is not a trouble', async () => {
    const middleman = createFakeMiddleman();
    middleman.goesAway();

    const reach = await middleman.at(THE_MACHINE).send('w2:p6J', WITH_A_PHOTO);

    expect(reach).toEqual({ kind: 'unreachable', why: 'no route to the machine' });
  });
});
