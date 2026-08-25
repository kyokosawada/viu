import { mkdtemp, readFile, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import type { Image } from '@viu/protocol';
import { afterEach, describe, expect, test } from 'vitest';

import { attachmentsDirectory, attachmentsIn, promptFor } from './attachments.js';
import { AttachmentNotStored } from './errors.js';

const A_DAY = 24 * 60 * 60 * 1000;

const NOON = Date.parse('2026-08-10T12:00:00.000Z');

const swept: string[] = [];

afterEach(async () => {
  for (const directory of swept.splice(0)) await rm(directory, { recursive: true, force: true });
});

async function somewhere(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'viu-attachments-'));
  swept.push(directory);
  return directory;
}

function anImage(overrides: Partial<Image> = {}): Image {
  return {
    format: 'jpeg',
    base64: Buffer.from('a photo').toString('base64'),
    ...overrides,
  };
}

async function aged(path: string, at: number): Promise<void> {
  await utimes(path, new Date(at), new Date(at));
}

describe('keeping an image as an attachment', () => {
  test('writes it into the attachments directory and answers with its absolute path', async () => {
    const directory = await somewhere();

    const path = await attachmentsIn({ directory, now: () => NOON }).keep(anImage());

    expect(path.startsWith(directory)).toBe(true);
    expect(dirname(path)).toBe(directory);
    await expect(readFile(path, 'utf8')).resolves.toBe('a photo');
  });

  test('makes the directory when it is not there yet', async () => {
    const directory = join(await somewhere(), '.viu', 'attachments');

    const path = await attachmentsIn({ directory }).keep(anImage());

    await expect(stat(path)).resolves.toMatchObject({ size: 7 });
  });

  test('names each attachment after the moment and something of its own, so two never collide', async () => {
    const directory = await somewhere();
    const attachments = attachmentsIn({ directory, now: () => NOON });

    const one = await attachments.keep(anImage());
    const other = await attachments.keep(anImage());

    expect(one).not.toBe(other);
    await expect(readdir(directory)).resolves.toHaveLength(2);
  });

  test('carries the extension the format calls for and nothing the phone chose', async () => {
    const directory = await somewhere();
    const attachments = attachmentsIn({ directory });

    const jpeg = await attachments.keep(anImage());
    const png = await attachments.keep(anImage({ format: 'png' }));

    expect(jpeg.endsWith('.jpg')).toBe(true);
    expect(png.endsWith('.png')).toBe(true);
  });

  test('keeps the image to the owner, since the machine may have other users on it', async () => {
    const directory = join(await somewhere(), '.viu', 'attachments');

    const path = await attachmentsIn({ directory }).keep(anImage());

    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect((await stat(directory)).mode & 0o777).toBe(0o700);
  });

  test('says the attachment was not stored rather than blaming herdr or the pane', async () => {
    const directory = join(await somewhere(), 'taken');
    await writeFile(directory, 'not a directory');

    const kept = attachmentsIn({ directory }).keep(anImage());

    await expect(kept).rejects.toThrow(AttachmentNotStored);
  });

  test('lands under the owner home rather than inside any project', () => {
    expect(attachmentsDirectory().endsWith('/.viu/attachments')).toBe(true);
  });
});

describe('sweeping attachments older than seven days', () => {
  test('deletes what has aged past the boundary and leaves what has not', async () => {
    const directory = await somewhere();
    const attachments = attachmentsIn({ directory, now: () => NOON });
    const old = await attachments.keep(anImage());
    const recent = await attachments.keep(anImage());
    await aged(old, NOON - 8 * A_DAY);
    await aged(recent, NOON - 6 * A_DAY);

    await attachments.sweep();

    await expect(stat(old)).rejects.toThrow();
    await expect(stat(recent)).resolves.toMatchObject({ size: 7 });
  });

  test('sweeps as each image lands, so the folder is tidied without a timer', async () => {
    const directory = await somewhere();
    const attachments = attachmentsIn({ directory, now: () => NOON });
    const old = await attachments.keep(anImage());
    await aged(old, NOON - 30 * A_DAY);

    await attachments.keep(anImage());

    await expect(stat(old)).rejects.toThrow();
    await expect(readdir(directory)).resolves.toHaveLength(1);
  });

  test('touches nothing it did not write, whatever age it is', async () => {
    const directory = await somewhere();
    const mine = join(directory, 'notes.txt');
    await writeFile(mine, 'not an attachment');
    await aged(mine, NOON - 400 * A_DAY);

    await attachmentsIn({ directory, now: () => NOON }).sweep();

    await expect(readFile(mine, 'utf8')).resolves.toBe('not an attachment');
  });

  test('is quiet about a directory that is not there at all', async () => {
    const directory = join(await somewhere(), 'never-used');

    await expect(attachmentsIn({ directory }).sweep()).resolves.toBeUndefined();
  });
});

describe('what the agent is handed', () => {
  test('is the words with the path standing where the image was placed', () => {
    expect(
      promptFor([
        { text: 'look at this ' },
        { path: '/home/o/.viu/attachments/a.jpg' },
        { text: ' here' },
      ]),
    ).toBe('look at this /home/o/.viu/attachments/a.jpg here');
  });

  test('is the path alone when nothing was said with it', () => {
    expect(promptFor([{ path: '/home/o/.viu/attachments/a.jpg' }])).toBe(
      '/home/o/.viu/attachments/a.jpg',
    );
  });

  test('names the paths in the order the images were placed', () => {
    expect(
      promptFor([
        { text: 'this screen ' },
        { path: '/home/o/.viu/attachments/a.jpg' },
        { text: ' should look like ' },
        { path: '/home/o/.viu/attachments/b.png' },
      ]),
    ).toBe(
      'this screen /home/o/.viu/attachments/a.jpg should look like /home/o/.viu/attachments/b.png',
    );
  });

  test('puts a single space between two images placed side by side', () => {
    expect(
      promptFor([
        { path: '/home/o/.viu/attachments/a.jpg' },
        { path: '/home/o/.viu/attachments/b.png' },
      ]),
    ).toBe('/home/o/.viu/attachments/a.jpg /home/o/.viu/attachments/b.png');
  });

  test('leaves the words exactly as they were typed when no image was placed', () => {
    expect(promptFor([{ text: '  git status  ' }])).toBe('  git status  ');
  });

  test('says nothing at all for a message with nothing in it', () => {
    expect(promptFor([])).toBe('');
  });
});
