import { randomBytes } from 'node:crypto';
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { Image, ImageFormat } from '@viu/protocol';

import { AttachmentNotStored } from './errors.js';

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

const EXTENSIONS: Record<ImageFormat, string> = { jpeg: 'jpg', png: 'png' };

const A_NAME = String.raw`\d{4}-\d{2}-\d{2}T[\d-]+Z-[0-9a-f]{8}\.(?:jpg|png)`;

const AN_ATTACHMENT = new RegExp(`^${A_NAME}$`);

const AN_IMAGE = '[image]';

export type Piece = { readonly text: string } | { readonly path: string };

export interface Attachments {
  keep(image: Image): Promise<string>;
  sweep(): Promise<void>;
  marked(text: string): string;
}

export interface AttachmentsOptions {
  readonly directory: string;
  readonly now?: () => number;
  readonly keepFor?: number;
}

export function attachmentsDirectory(): string {
  return join(homedir(), '.viu', 'attachments');
}

export function attachmentsIn({
  directory,
  now = Date.now,
  keepFor = SEVEN_DAYS,
}: AttachmentsOptions): Attachments {
  const standing = new RegExp(`${literally(directory)}/${A_NAME}`, 'gu');

  const sweep = async (): Promise<void> => {
    let named: string[];
    try {
      named = await readdir(directory);
    } catch {
      return;
    }
    const older = now() - keepFor;
    await Promise.all(
      named.filter((name) => AN_ATTACHMENT.test(name)).map((name) => removeIfOlder(name, older)),
    );
  };

  const removeIfOlder = async (name: string, older: number): Promise<void> => {
    const path = join(directory, name);
    try {
      const { mtimeMs } = await stat(path);
      if (mtimeMs <= older) await rm(path, { force: true });
    } catch {
      return;
    }
  };

  return {
    async keep(image: Image): Promise<string> {
      const path = join(directory, nameFor(image.format, now()));
      try {
        await mkdir(directory, { recursive: true, mode: 0o700 });
        await writeFile(path, Buffer.from(image.base64, 'base64'), { flag: 'wx', mode: 0o600 });
      } catch (error) {
        throw new AttachmentNotStored(
          directory,
          error instanceof Error ? error.message : String(error),
        );
      }
      await sweep();
      return path;
    },

    sweep,

    marked(text: string): string {
      return text.replace(standing, AN_IMAGE);
    },
  };
}

export function promptFor(pieces: readonly Piece[]): string {
  let prompt = '';
  let afterAPath = false;
  for (const piece of pieces) {
    if ('path' in piece) {
      prompt += afterAPath ? ` ${piece.path}` : piece.path;
      afterAPath = true;
    } else if (piece.text !== '') {
      prompt += piece.text;
      afterAPath = false;
    }
  }
  return prompt;
}

function literally(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}

function nameFor(format: ImageFormat, at: number): string {
  const stamp = new Date(at).toISOString().replace(/[:.]/g, '-');
  return `${stamp}-${randomBytes(4).toString('hex')}.${EXTENSIONS[format]}`;
}
