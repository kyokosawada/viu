import { brokeAt } from './missed';

describe('where a reach that missed broke the chain', () => {
  test('is the machine when nothing answered at all', () => {
    expect(brokeAt({ kind: 'unreachable', why: 'connect ECONNREFUSED' })).toBe('machine');
  });

  test('is the middleman when something answered and it was not the middleman', () => {
    expect(brokeAt({ kind: 'not-the-middleman', why: 'it answered 404' })).toBe('middleman');
  });

  test('is the middleman when the two disagree about the protocol', () => {
    expect(
      brokeAt({
        kind: 'trouble',
        trouble: { kind: 'protocol-mismatch', message: 'the middleman speaks v5' },
      }),
    ).toBe('middleman');
  });

  test('is herdr when the middleman answered to say herdr is the one that is down', () => {
    expect(
      brokeAt({
        kind: 'trouble',
        trouble: { kind: 'herdr-unreachable', message: 'nothing is listening' },
      }),
    ).toBe('herdr');
    expect(
      brokeAt({
        kind: 'trouble',
        trouble: { kind: 'herdr-refused', message: 'herdr said no' },
      }),
    ).toBe('herdr');
  });
});
