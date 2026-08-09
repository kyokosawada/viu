import { PROTOCOL_VERSION } from '@viu/protocol';
import { describe, expect, test } from 'vitest';

import { HerdrProtocolMismatch } from './errors.js';
import { UNDERSTOOD_PROTOCOL, exitCodeFor, greetHerdr, startupLine } from './startup.js';
import { createFakeHerdr } from './testing/fake-herdr.js';

async function refusalOf(protocol: number | null, herdrVersion = '0.9.0'): Promise<unknown> {
  const herdr = createFakeHerdr();
  herdr.speaksProtocol(protocol, herdrVersion);
  return greetHerdr(herdr).then(
    () => null,
    (error: unknown) => error,
  );
}

test('the startup line names the protocol version it was built against', () => {
  expect(startupLine()).toContain(`protocol v${PROTOCOL_VERSION}`);
});

describe('checking herdr before serving anything', () => {
  test('greets a herdr speaking the protocol this middleman was written against', async () => {
    expect(await greetHerdr(createFakeHerdr())).toBe('0.7.5');
  });

  test('refuses a newer protocol, naming both sides so the reason is actionable', async () => {
    const refusal = await refusalOf(19, '0.9.0');

    expect(refusal).toBeInstanceOf(HerdrProtocolMismatch);
    expect(String(refusal)).toContain('19');
    expect(String(refusal)).toContain('0.9.0');
    expect(String(refusal)).toContain(String(UNDERSTOOD_PROTOCOL));
  });

  test('refuses an older protocol as well, rather than hoping it is close enough', async () => {
    expect(await refusalOf(16)).toBeInstanceOf(HerdrProtocolMismatch);
  });

  test('refuses a herdr that answers without a protocol version at all', async () => {
    expect(await refusalOf(null)).toBeInstanceOf(HerdrProtocolMismatch);
  });

  test('a refusal is deliberate, so it asks not to be restarted into a loop', async () => {
    expect(exitCodeFor(await refusalOf(19))).toBe(78);
  });

  test('anything else is worth starting again for, because herdr may yet come up', () => {
    expect(exitCodeFor(new Error('herdr does not appear to be running'))).toBe(1);
  });
});
