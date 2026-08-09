#!/usr/bin/env node
import type { Key } from '@viu/protocol';

import { connectToHerdr, herdrSocketPath } from './herdr/socket.js';
import { createMiddleman } from './middleman.js';
import { startupLine } from './startup.js';

const socketPath = herdrSocketPath();
const middleman = createMiddleman(connectToHerdr(socketPath));
const paneId = process.argv[2];
const keys = process.argv.slice(3) as Key[];

process.stdout.write(`${startupLine()}\n`);

try {
  if (paneId === undefined) {
    process.stdout.write(`${JSON.stringify(await middleman.fleet(), null, 2)}\n`);
  } else if (keys.length === 0) {
    process.stdout.write(`${JSON.stringify(await middleman.conversation(paneId), null, 2)}\n`);
  } else {
    await middleman.press(paneId, keys);
    process.stdout.write(`pressed ${keys.join(', ')} into ${paneId}\n`);
  }
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  process.stderr.write(`cannot ${asked()} through ${socketPath}: ${reason}\n`);
  process.exitCode = 1;
}

function asked(): string {
  if (paneId === undefined) return 'see the fleet';
  if (keys.length === 0) return `read pane ${paneId}`;
  return `press keys into pane ${paneId}`;
}
