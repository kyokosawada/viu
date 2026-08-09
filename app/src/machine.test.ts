import { DEFAULT_PORT, addressOf, machineFrom, urlOf } from './machine';

describe('naming the machine', () => {
  test('takes the middleman port when none is named', () => {
    expect(machineFrom('desk.tail1234.ts.net', '')).toEqual({
      host: 'desk.tail1234.ts.net',
      port: DEFAULT_PORT,
    });
  });

  test('takes a port that was named', () => {
    expect(machineFrom('desk.tail1234.ts.net', '9000')).toEqual({
      host: 'desk.tail1234.ts.net',
      port: 9000,
    });
  });

  test('refuses a name that is missing or is not one word', () => {
    expect(machineFrom('   ', '')).toBeNull();
    expect(machineFrom('desk one', '')).toBeNull();
  });

  test('refuses a port that is not a port', () => {
    expect(machineFrom('desk.tail1234.ts.net', '0')).toBeNull();
    expect(machineFrom('desk.tail1234.ts.net', '70000')).toBeNull();
    expect(machineFrom('desk.tail1234.ts.net', 'eight')).toBeNull();
  });

  test('wraps a tailnet IPv6 address in brackets', () => {
    const machine = { host: 'fd7a:115c:a1e0::1', port: 8787 };

    expect(addressOf(machine)).toBe('[fd7a:115c:a1e0::1]:8787');
    expect(urlOf(machine)).toBe('http://[fd7a:115c:a1e0::1]:8787');
  });
});
