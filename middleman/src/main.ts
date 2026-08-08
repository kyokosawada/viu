#!/usr/bin/env node
import { connectToHerdr, herdrSocketPath } from './herdr/socket.js';
import { createMiddleman } from './middleman.js';
import { startupLine } from './startup.js';

const socketPath = herdrSocketPath();
const middleman = createMiddleman(connectToHerdr(socketPath));

process.stdout.write(`${startupLine()}\n`);

try {
  const fleet = await middleman.fleet();
  process.stdout.write(`${JSON.stringify(fleet, null, 2)}\n`);
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  process.stderr.write(`cannot see the fleet through ${socketPath}: ${reason}\n`);
  process.exitCode = 1;
}
