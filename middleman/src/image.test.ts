import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Image } from '@viu/protocol';
import { afterEach, describe, expect, test } from 'vitest';

import { attachmentsIn } from './attachments.js';
import { PaneGone } from './errors.js';
import { createMiddleman } from './middleman.js';
import { createFakeHerdr, herdrAgentSession, herdrPane } from './testing/fake-herdr.js';

const agentPane = herdrPane({
  pane_id: 'w2:p6J',
  agent: 'claude',
  display_agent: 'Claude',
  agent_status: 'blocked',
  agent_session: herdrAgentSession(),
  cwd: '/home/gcpaps/dev/viu',
});

const shellPane = herdrPane({ pane_id: 'w1:pA', cwd: '/home/gcpaps/dev/automation' });

const swept: string[] = [];

afterEach(async () => {
  for (const directory of swept.splice(0)) await rm(directory, { recursive: true, force: true });
});

async function somewhere(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'viu-image-'));
  swept.push(directory);
  return directory;
}

function anImage(overrides: Partial<Image> = {}): Image {
  return {
    format: 'jpeg',
    base64: Buffer.from('a screenshot').toString('base64'),
    caption: null,
    ...overrides,
  };
}

async function withAttachments(
  herdr: ReturnType<typeof createFakeHerdr>,
): Promise<{ middleman: ReturnType<typeof createMiddleman>; directory: string }> {
  const directory = await somewhere();
  return { middleman: createMiddleman(herdr, attachmentsIn({ directory })), directory };
}

describe('handing an agent an image', () => {
  test('sends one prompt carrying the caption and then the attachment path', async () => {
    const herdr = createFakeHerdr([agentPane]);
    const { middleman, directory } = await withAttachments(herdr);

    await middleman.sendImage('w2:p6J', anImage({ caption: 'this button is wrong' }));

    const [delivery] = herdr.delivered();
    expect(herdr.delivered()).toHaveLength(1);
    expect(delivery?.submits).toBe(true);
    const [kept] = await readdir(directory);
    expect(delivery?.text).toBe(`this button is wrong\n\nImage: ${join(directory, kept ?? '')}`);
  });

  test('sends the path alone when the owner said nothing with it', async () => {
    const herdr = createFakeHerdr([agentPane]);
    const { middleman, directory } = await withAttachments(herdr);

    await middleman.sendImage('w2:p6J', anImage());

    const [kept] = await readdir(directory);
    expect(herdr.delivered()[0]?.text).toBe(`Image: ${join(directory, kept ?? '')}`);
  });

  test('leaves the image on the machine for the agent to read off disk', async () => {
    const herdr = createFakeHerdr([agentPane]);
    const { middleman, directory } = await withAttachments(herdr);

    await middleman.sendImage('w2:p6J', anImage());

    const [kept] = await readdir(directory);
    await expect(readFile(join(directory, kept ?? ''), 'utf8')).resolves.toBe('a screenshot');
  });

  test('answers with the same guarantee a send of words gets', async () => {
    const herdr = createFakeHerdr([agentPane]);
    const { middleman } = await withAttachments(herdr);

    const sent = await middleman.sendImage('w2:p6J', anImage());

    expect(sent).toEqual({ paneId: 'w2:p6J', confidence: 'confirmed', state: 'thinking' });
  });

  test('drops to queued when the agent was not seen to pick the prompt up', async () => {
    const herdr = createFakeHerdr([agentPane]);
    herdr.promptLeavesTheAgentWhereItWas();
    const { middleman } = await withAttachments(herdr);

    const sent = await middleman.sendImage('w2:p6J', anImage());

    expect(sent).toEqual({ paneId: 'w2:p6J', confidence: 'queued', mayBeCut: false });
  });

  test('falls back to the pane where there is no agent, exactly as words do', async () => {
    const herdr = createFakeHerdr([shellPane]);
    const { middleman, directory } = await withAttachments(herdr);

    const sent = await middleman.sendImage('w1:pA', anImage());

    expect(sent).toEqual({ paneId: 'w1:pA', confidence: 'queued', mayBeCut: false });
    const [kept] = await readdir(directory);
    expect(herdr.arrived('w1:pA')).toBe(`Image: ${join(directory, kept ?? '')}\r`);
  });

  test('says the pane is gone rather than reporting an image that reached nobody', async () => {
    const { middleman } = await withAttachments(createFakeHerdr([agentPane]));

    await expect(middleman.sendImage('w9:p9', anImage())).rejects.toThrow(PaneGone);
  });
});
