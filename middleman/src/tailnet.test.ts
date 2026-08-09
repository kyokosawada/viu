import { describe, expect, test } from 'vitest';

import { NoTailnet } from './errors.js';
import { tailnetAddresses, type NetworkInterfaces } from './tailnet.js';

const thisMachine: NetworkInterfaces = {
  lo: [
    { address: '127.0.0.1', internal: true },
    { address: '::1', internal: true },
    { address: '10.255.255.254', internal: true },
  ],
  eth0: [{ address: '172.30.32.63', internal: false }],
  tailscale0: [
    { address: '100.99.77.100', internal: false },
    { address: 'fd7a:115c:a1e0::3e01:4db8', internal: false },
    { address: 'fe80::1234:5678:9abc:def0', internal: false },
  ],
  docker0: [{ address: '172.17.0.1', internal: false }],
  'br-f1cbaf25e064': [{ address: '172.21.0.1', internal: false }],
};

describe('finding the tailnet to bind to', () => {
  test('takes the tailnet addresses and nothing else on the machine', () => {
    expect(tailnetAddresses(thisMachine)).toEqual([
      '100.99.77.100',
      'fd7a:115c:a1e0::3e01:4db8',
    ]);
  });

  test('leaves out the link-local address the tailnet interface also carries', () => {
    expect(tailnetAddresses(thisMachine)).not.toContain('fe80::1234:5678:9abc:def0');
  });

  test('refuses an address in the tailnet range that is not on the tailnet interface', () => {
    const carrierNat: NetworkInterfaces = {
      eth0: [{ address: '100.71.4.9', internal: false }],
      tailscale0: [{ address: '100.99.77.100', internal: false }],
    };

    expect(tailnetAddresses(carrierNat)).toEqual(['100.99.77.100']);
  });

  test('refuses an address on the tailnet interface that is outside the tailnet ranges', () => {
    const misconfigured: NetworkInterfaces = {
      tailscale0: [
        { address: '192.168.1.20', internal: false },
        { address: '100.99.77.100', internal: false },
      ],
    };

    expect(tailnetAddresses(misconfigured)).toEqual(['100.99.77.100']);
  });

  test('never offers the wildcard, the loopback, or anything a machine reaches by default', () => {
    const addresses = tailnetAddresses(thisMachine);

    expect(addresses).not.toContain('0.0.0.0');
    expect(addresses).not.toContain('::');
    expect(addresses).not.toContain('127.0.0.1');
    expect(addresses).not.toContain('::1');
    expect(addresses).not.toContain('172.30.32.63');
  });

  test('refuses to answer at all when Tailscale is not up, saying what it looked for', () => {
    const noTailscale: NetworkInterfaces = {
      lo: [{ address: '127.0.0.1', internal: true }],
      eth0: [{ address: '172.30.32.63', internal: false }],
    };

    expect(() => tailnetAddresses(noTailscale)).toThrow(NoTailnet);
    expect(() => tailnetAddresses(noTailscale)).toThrow(/tailscale/i);
  });

  test('refuses when the tailnet interface is up but carries no tailnet address yet', () => {
    const loggedOut: NetworkInterfaces = {
      tailscale0: [{ address: 'fe80::1234:5678:9abc:def0', internal: false }],
    };

    expect(() => tailnetAddresses(loggedOut)).toThrow(NoTailnet);
  });
});
