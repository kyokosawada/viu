import { mkdtemp, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { HerdrConnectionLost, HerdrNotRunning } from '../errors.js';
import { watchPanes } from '../fleet.js';
import { greetHerdr } from '../startup.js';

import { connectToHerdr, herdrSocketPath } from './socket.js';

async function scratchPath(name: string): Promise<string> {
  return join(await mkdtemp(join(tmpdir(), 'viu-socket-')), name);
}

async function refusalAt(socketPath: string): Promise<unknown> {
  return greetHerdr(connectToHerdr(socketPath)).then(
    () => null,
    (error: unknown) => error,
  );
}

describe('when herdr is not running at all', () => {
  test('says herdr is not running, and where it looked, rather than naming a syscall', async () => {
    const missing = await scratchPath('herdr.sock');

    const refusal = await refusalAt(missing);

    expect(refusal).toBeInstanceOf(HerdrNotRunning);
    expect(String(refusal)).toContain('herdr does not appear to be running');
    expect(String(refusal)).toContain(missing);
    expect(String(refusal)).not.toContain('ENOENT');
  });

  test('says the same when the socket is left behind but nothing is listening on it', async () => {
    const stale = await scratchPath('herdr.sock');
    await writeFile(stale, '');

    const refusal = await refusalAt(stale);

    expect(refusal).toBeInstanceOf(HerdrNotRunning);
    expect(String(refusal)).toContain('nothing is listening');
  });

  test('looks in the place herdr keeps its socket', () => {
    expect(herdrSocketPath()).toMatch(/[/\\]\.config[/\\]herdr[/\\]herdr\.sock$/);
  });
});

describe('when a subscription cannot be held open', () => {
  test('says a subscription it cannot hold was lost, rather than waiting silently', async () => {
    const missing = await scratchPath('herdr.sock');

    const lost = await new Promise<Error>((reported) => {
      watchPanes(connectToHerdr(missing), () => undefined, reported);
    });

    expect(lost).toBeInstanceOf(HerdrNotRunning);
    expect(String(lost)).toContain(missing);
  });

  test('says the connection went, not that herdr is gone, when herdr closes it', async () => {
    const path = await scratchPath('herdr.sock');
    const herdr = createServer((connection) => {
      connection.destroy();
    });
    await new Promise<void>((listening) => herdr.listen(path, listening));

    const lost = await new Promise<Error>((reported) => {
      watchPanes(connectToHerdr(path), () => undefined, reported);
    });
    await new Promise<void>((closed) => {
      herdr.close(() => {
        closed();
      });
    });

    expect(lost).toBeInstanceOf(HerdrConnectionLost);
    expect(String(lost)).not.toContain('does not appear to be running');
  });
});
