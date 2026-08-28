import { linkFor } from './missed';

describe('the link of the chain a reach that missed is about', () => {
  test('is the machine when nothing answered at all', () => {
    expect(linkFor({ kind: 'unreachable', why: 'connect ECONNREFUSED' })).toBe('machine');
  });

  test('is the middleman when something answered and it was not the middleman', () => {
    expect(linkFor({ kind: 'not-the-middleman', why: 'it answered 404' })).toBe('middleman');
  });

  test('is the middleman when the two disagree about the protocol', () => {
    expect(
      linkFor({
        kind: 'trouble',
        trouble: { kind: 'protocol-mismatch', message: 'the middleman speaks v5' },
      }),
    ).toBe('middleman');
  });

  test('is herdr when the middleman answered to say herdr is the one that is down', () => {
    expect(
      linkFor({
        kind: 'trouble',
        trouble: { kind: 'herdr-unreachable', message: 'nothing is listening' },
      }),
    ).toBe('herdr');
    expect(
      linkFor({
        kind: 'trouble',
        trouble: { kind: 'herdr-refused', message: 'herdr said no' },
      }),
    ).toBe('herdr');
  });
});
