import { recoversOnItsOwn, waitBefore } from './recovering';

describe('what recovers on its own', () => {
  test('a machine that answered nothing, because the network is the thing that can return', () => {
    expect(recoversOnItsOwn({ kind: 'unreachable', why: 'no route to the machine' })).toBe(true);
  });

  test('not a trouble the middleman named, since it was reached to name it', () => {
    expect(
      recoversOnItsOwn({
        kind: 'trouble',
        trouble: { kind: 'herdr-unreachable', message: 'herdr is not running' },
      }),
    ).toBe(false);
  });

  test('not something else answering, since a wrong address stays wrong', () => {
    expect(recoversOnItsOwn({ kind: 'not-the-middleman', why: 'it answered 404' })).toBe(false);
  });
});

describe('how long it waits between tries', () => {
  test('starts short, so a blink of a tunnel costs nothing', () => {
    expect(waitBefore(0)).toBeLessThanOrEqual(1000);
  });

  test('grows, so a machine that is off is not asked at that rate all day', () => {
    expect(waitBefore(1)).toBeGreaterThan(waitBefore(0));
    expect(waitBefore(4)).toBeGreaterThan(waitBefore(1));
  });

  test('settles rather than growing without end', () => {
    expect(waitBefore(500)).toBe(waitBefore(50));
    expect(waitBefore(500)).toBeLessThanOrEqual(60000);
  });
});
