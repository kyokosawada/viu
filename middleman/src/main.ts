#!/usr/bin/env node
import type { Key } from '@viu/protocol';

import { connectToHerdr, herdrSocketPath } from './herdr/socket.js';
import { createMiddleman } from './middleman.js';
import { startupLine } from './startup.js';

interface Asked {
  readonly name: string;
  run(): Promise<string>;
}

const socketPath = herdrSocketPath();
const middleman = createMiddleman(connectToHerdr(socketPath));
const live = process.argv.includes('--watch');
const words = process.argv.slice(2).filter((argument) => !argument.startsWith('--'));
const paneId = words[0];
const keys = words.slice(1) as Key[];

const asked: Asked = live
  ? { name: paneId === undefined ? 'watch the fleet' : `watch pane ${paneId}`, run: hold }
  : paneId === undefined
    ? { name: 'see the fleet', run: async () => printed(await middleman.fleet()) }
    : keys.length === 0
      ? {
          name: `read pane ${paneId}`,
          run: async () => printed(await middleman.conversation(paneId)),
        }
      : {
          name: `press keys into pane ${paneId}`,
          run: async () => {
            await middleman.press(paneId, keys);
            return `pressed ${keys.join(', ')} into ${paneId}`;
          },
        };

process.stdout.write(`${startupLine()}\n`);

try {
  process.stdout.write(`${await asked.run()}\n`);
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  process.stderr.write(`cannot ${asked.name} through ${socketPath}: ${reason}\n`);
  process.exitCode = 1;
}

async function hold(): Promise<string> {
  await middleman.fleet();

  const connection = middleman.connect((update) => {
    process.stdout.write(`${printed(update)}\n`);
  });
  if (paneId !== undefined) connection.watch(paneId);

  process.once('SIGINT', () => {
    connection.close();
  });

  return paneId === undefined ? 'holding a connection open' : `holding one open on ${paneId}`;
}

function printed(answer: unknown): string {
  return JSON.stringify(answer, null, 2);
}
