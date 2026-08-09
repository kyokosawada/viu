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
const paneId = process.argv[2];
const keys = process.argv.slice(3) as Key[];

const asked: Asked =
  paneId === undefined
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

function printed(answer: unknown): string {
  return JSON.stringify(answer, null, 2);
}
