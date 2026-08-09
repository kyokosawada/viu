import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { HerdrNotRunning } from '../errors.js';
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
