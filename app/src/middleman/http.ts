import { PROTOCOL_VERSION, type Greeting } from '@viu/protocol';

import { urlOf, type Machine } from '../machine';

import type { MiddlemanClient, Reach } from './client';
import { troubleIn } from './trouble';

export type Fetching = (url: string, options: { readonly signal: AbortSignal }) => Promise<Response>;

const PATIENCE = 5000;

export function httpMiddleman(
  machine: Machine,
  fetching: Fetching = (url, options) => fetch(url, options),
): MiddlemanClient {
  return {
    async greet(): Promise<Reach> {
      let answer: Response;
      try {
        answer = await within(PATIENCE, (signal) => fetching(`${urlOf(machine)}/`, { signal }));
      } catch (error: unknown) {
        return { kind: 'unreachable', why: whyOf(error) };
      }

      const body: unknown = await parsed(answer);
      if (!answer.ok) {
        const trouble = troubleIn(body);
        return trouble === null
          ? { kind: 'not-the-middleman', why: `it answered ${answer.status}` }
          : { kind: 'trouble', trouble };
      }

      const greeting = greetingIn(body);
      if (greeting === null) {
        return { kind: 'not-the-middleman', why: 'it answered as something else' };
      }
      if (greeting.protocol !== PROTOCOL_VERSION) {
        return {
          kind: 'trouble',
          trouble: {
            kind: 'protocol-mismatch',
            message: `the middleman speaks protocol v${greeting.protocol}, this Viu speaks v${PROTOCOL_VERSION}`,
          },
        };
      }
      return { kind: 'reached', greeting };
    },
  };
}

async function within(
  patience: number,
  ask: (signal: AbortSignal) => Promise<Response>,
): Promise<Response> {
  const giveUp = new AbortController();
  const timer = setTimeout(() => {
    giveUp.abort();
  }, patience);
  try {
    return await ask(giveUp.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function parsed(answer: Response): Promise<unknown> {
  try {
    return await answer.json();
  } catch {
    return null;
  }
}

function greetingIn(body: unknown): Greeting | null {
  if (!isRecord(body) || body.viu !== 'middleman') return null;
  if (typeof body.protocol !== 'number' || typeof body.herdr !== 'string') return null;
  return { viu: 'middleman', protocol: body.protocol, herdr: body.herdr };
}

function whyOf(error: unknown): string {
  if (error instanceof Error && error.name === 'AbortError') return 'it did not answer in time';
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
