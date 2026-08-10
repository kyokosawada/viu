import type { Image } from '@viu/protocol';

import type { Machine } from '../machine';
import { createFakeMiddleman } from '../testing/fake-middleman';

const THE_MACHINE: Machine = { host: 'desk.tail1234.ts.net', port: 8787 };

const A_PHOTO: Image = { format: 'jpeg', base64: 'AAAA', caption: 'this button is wrong' };

describe('sending an image down the one door to the machine', () => {
  test('hands the image and its caption to the pane it names', async () => {
    const middleman = createFakeMiddleman();

    await middleman.at(THE_MACHINE).sendImage('w2:p6J', A_PHOTO);

    expect(middleman.whatImagesWereSent()).toEqual([{ paneId: 'w2:p6J', image: A_PHOTO }]);
    expect(middleman.whatWasSent()).toEqual([]);
  });

  test('answers with the same guarantee a send of words does', async () => {
    const middleman = createFakeMiddleman();
    middleman.picksUpWhatIsSent('thinking');

    const reach = await middleman.at(THE_MACHINE).sendImage('w2:p6J', A_PHOTO);

    expect(reach).toEqual({
      kind: 'reached',
      got: { paneId: 'w2:p6J', confidence: 'confirmed', state: 'thinking' },
    });
  });

  test('answers queued where nothing was seen to take it', async () => {
    const middleman = createFakeMiddleman();
    middleman.onlyQueuesWhatIsSent();

    const reach = await middleman.at(THE_MACHINE).sendImage('w1:pA', A_PHOTO);

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

    const reach = await middleman.at(THE_MACHINE).sendImage('w2:p6J', A_PHOTO);

    expect(reach).toMatchObject({ kind: 'trouble', trouble: { kind: 'attachment-not-stored' } });
  });

  test('says the machine could not be reached, which is not a trouble', async () => {
    const middleman = createFakeMiddleman();
    middleman.goesAway();

    const reach = await middleman.at(THE_MACHINE).sendImage('w2:p6J', A_PHOTO);

    expect(reach).toEqual({ kind: 'unreachable', why: 'no route to the machine' });
  });
});
