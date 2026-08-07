import { PROTOCOL_VERSION } from '@viu/protocol';
import { expect, test } from 'vitest';

import { startupLine } from './startup.js';

test('the startup line names the protocol version it was built against', () => {
  expect(startupLine()).toContain(`protocol v${PROTOCOL_VERSION}`);
});
