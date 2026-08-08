#!/usr/bin/env node
import { connectToHerdr, herdrSocketPath } from './herdr/socket.js';
import { createMiddleman } from './middleman.js';
import { startupLine } from './startup.js';

const socketPath = herdrSocketPath();
const middleman = createMiddleman(connectToHerdr(socketPath));
const paneId = process.argv[2];

process.stdout.write(`${startupLine()}\n`);

try {
  const answer =
    paneId === undefined ? await middleman.fleet() : await middleman.conversation(paneId);
  process.stdout.write(`${JSON.stringify(answer, null, 2)}\n`);
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  const asked = paneId === undefined ? 'see the fleet' : `read pane ${paneId}`;
  process.stderr.write(`cannot ${asked} through ${socketPath}: ${reason}\n`);
  process.exitCode = 1;
}
