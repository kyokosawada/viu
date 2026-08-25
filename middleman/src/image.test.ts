import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Image } from '@viu/protocol';
import { afterEach, describe, expect, test } from 'vitest';

import { attachmentsIn, type Attachments } from './attachments.js';
import { AttachmentNotStored, PaneGone } from './errors.js';
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

function anImage(said = 'a screenshot', format: Image['format'] = 'jpeg'): Image {
  return { format, base64: Buffer.from(said).toString('base64') };
}

async function withAttachments(
  herdr: ReturnType<typeof createFakeHerdr>,
): Promise<{ middleman: ReturnType<typeof createMiddleman>; directory: string }> {
  const directory = await somewhere();
  return { middleman: createMiddleman(herdr, attachmentsIn({ directory })), directory };
}

async function theOneKeptIn(directory: string): Promise<string> {
  const named = await readdir(directory);
  expect(named).toHaveLength(1);
  return join(directory, named[0] ?? '');
}

function refusingAfterTheFirst(attachments: Attachments): Attachments {
  let kept = 0;
  return {
    keep: (image) =>
      kept++ === 0
        ? attachments.keep(image)
        : Promise.reject(new AttachmentNotStored('/nowhere', 'no room left on the device')),
    sweep: () => attachments.sweep(),
  };
}

function pathsIn(prompt: string, directory: string): string[] {
  return [...prompt.matchAll(new RegExp(`${directory}/[^\\s]+`, 'g'))].map(([path]) => path);
}

describe('handing an agent an image', () => {
  test('sends one prompt with the path standing where the image was placed', async () => {
    const herdr = createFakeHerdr([agentPane]);
    const { middleman, directory } = await withAttachments(herdr);

    await middleman.send('w2:p6J', {
      parts: [{ text: 'look at this ' }, { image: anImage() }, { text: ' here' }],
    });

    const [delivery] = herdr.delivered();
    expect(herdr.delivered()).toHaveLength(1);
    expect(delivery?.submits).toBe(true);
    const kept = await theOneKeptIn(directory);
    expect(delivery?.text).toBe(`look at this ${kept} here`);
  });

  test('sends the path alone when the owner said nothing with it', async () => {
    const herdr = createFakeHerdr([agentPane]);
    const { middleman, directory } = await withAttachments(herdr);

    await middleman.send('w2:p6J', { parts: [{ image: anImage() }] });

    const kept = await theOneKeptIn(directory);
    expect(herdr.delivered()[0]?.text).toBe(kept);
  });

  test('carries several images as one prompt, each where it was placed', async () => {
    const herdr = createFakeHerdr([agentPane]);
    const { middleman, directory } = await withAttachments(herdr);

    await middleman.send('w2:p6J', {
      parts: [
        { text: 'this screen ' },
        { image: anImage('the first') },
        { text: ' should look like ' },
        { image: anImage('the second', 'png') },
      ],
    });

    expect(herdr.delivered()).toHaveLength(1);
    const prompt = herdr.delivered()[0]?.text ?? '';
    const [first, second] = pathsIn(prompt, directory);
    expect(prompt).toBe(`this screen ${first} should look like ${second}`);
    await expect(readdir(directory)).resolves.toHaveLength(2);
    await expect(readFile(first ?? '', 'utf8')).resolves.toBe('the first');
    await expect(readFile(second ?? '', 'utf8')).resolves.toBe('the second');
    expect(second?.endsWith('.png')).toBe(true);
  });

  test('leaves the image on the machine for the agent to read off disk', async () => {
    const herdr = createFakeHerdr([agentPane]);
    const { middleman, directory } = await withAttachments(herdr);

    await middleman.send('w2:p6J', { parts: [{ image: anImage() }] });

    const kept = await theOneKeptIn(directory);
    await expect(readFile(kept, 'utf8')).resolves.toBe('a screenshot');
  });

  test('writes nothing at all for a send that carries no image', async () => {
    const herdr = createFakeHerdr([agentPane]);
    const { middleman, directory } = await withAttachments(herdr);

    await middleman.send('w2:p6J', { parts: [{ text: 'use the second one' }] });

    expect(herdr.delivered()[0]?.text).toBe('use the second one');
    await expect(readdir(directory)).resolves.toEqual([]);
  });

  test('answers with the same guarantee a send of words gets', async () => {
    const herdr = createFakeHerdr([agentPane]);
    const { middleman } = await withAttachments(herdr);

    const sent = await middleman.send('w2:p6J', { parts: [{ image: anImage() }] });

    expect(sent).toEqual({ paneId: 'w2:p6J', confidence: 'confirmed', state: 'thinking' });
  });

  test('drops to queued when the agent was not seen to pick the prompt up', async () => {
    const herdr = createFakeHerdr([agentPane]);
    herdr.promptLeavesTheAgentWhereItWas();
    const { middleman } = await withAttachments(herdr);

    const sent = await middleman.send('w2:p6J', { parts: [{ image: anImage() }] });

    expect(sent).toEqual({ paneId: 'w2:p6J', confidence: 'queued', mayBeCut: false });
  });

  test('falls back to the pane where there is no agent, exactly as words do', async () => {
    const herdr = createFakeHerdr([shellPane]);
    const { middleman, directory } = await withAttachments(herdr);

    const sent = await middleman.send('w1:pA', { parts: [{ image: anImage() }] });

    expect(sent).toEqual({ paneId: 'w1:pA', confidence: 'queued', mayBeCut: false });
    const kept = await theOneKeptIn(directory);
    expect(herdr.arrived('w1:pA')).toBe(`${kept}\r`);
  });

  test('fails the whole send when an attachment cannot be stored, and delivers nothing', async () => {
    const herdr = createFakeHerdr([agentPane]);
    const taken = join(await somewhere(), 'taken');
    await writeFile(taken, 'not a directory');
    const middleman = createMiddleman(herdr, attachmentsIn({ directory: taken }));

    const sending = middleman.send('w2:p6J', {
      parts: [{ text: 'this button is wrong ' }, { image: anImage() }],
    });

    await expect(sending).rejects.toThrow(AttachmentNotStored);
    expect(herdr.delivered()).toEqual([]);
  });

  test('leaves an earlier image on disk when a later one fails, and still sends nothing', async () => {
    const herdr = createFakeHerdr([agentPane]);
    const directory = await somewhere();
    const middleman = createMiddleman(herdr, refusingAfterTheFirst(attachmentsIn({ directory })));

    const sending = middleman.send('w2:p6J', {
      parts: [
        { text: 'both of these ' },
        { image: anImage('the first') },
        { image: anImage('the second') },
      ],
    });

    await expect(sending).rejects.toThrow(AttachmentNotStored);
    expect(herdr.delivered()).toEqual([]);
    await expect(readdir(directory)).resolves.toHaveLength(1);
  });

  test('says the pane is gone rather than reporting an image that reached nobody', async () => {
    const { middleman } = await withAttachments(createFakeHerdr([agentPane]));

    const sending = middleman.send('w9:p9', { parts: [{ image: anImage() }] });

    await expect(sending).rejects.toThrow(PaneGone);
  });
});
