import { PROTOCOL_VERSION, type Greeting } from '@viu/protocol';

import { urlOf, type Machine } from '../machine';

import type { MiddlemanClient, Reach } from './client';
import { nothingAnswered, protocolMismatch, troubleIn } from './trouble';

export type Fetching = (url: string, options: { readonly signal: AbortSignal }) => Promise<Response>;

const PATIENCE = 5000;

interface Answered {
  readonly ok: boolean;
  readonly status: number;
  readonly body: unknown;
}

export function httpMiddleman(machine: Machine, fetching: Fetching): MiddlemanClient {
  return {
    async greet(): Promise<Reach> {
      let answer: Answered;
      try {
        answer = await within(PATIENCE, async (signal) => {
          const answering = await fetching(`${urlOf(machine)}/`, { signal });
          return {
            ok: answering.ok,
            status: answering.status,
            body: await parsed(answering, signal),
          };
        });
      } catch (error: unknown) {
        return nothingAnswered(error);
      }

      if (!answer.ok) {
        const trouble = troubleIn(answer.body);
        return trouble === null
          ? { kind: 'not-the-middleman', why: `it answered ${answer.status}` }
          : { kind: 'trouble', trouble };
      }

      const greeting = greetingIn(answer.body);
      if (greeting === null) {
        return { kind: 'not-the-middleman', why: 'it answered as something else' };
      }
      if (greeting.protocol !== PROTOCOL_VERSION) {
        return { kind: 'trouble', trouble: protocolMismatch(greeting.protocol) };
      }
      return { kind: 'reached', greeting };
    },
  };
}

async function within<T>(patience: number, ask: (signal: AbortSignal) => Promise<T>): Promise<T> {
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

async function parsed(answer: Response, signal: AbortSignal): Promise<unknown> {
  try {
    return await answer.json();
  } catch (error: unknown) {
    if (signal.aborted) throw error;
    return null;
  }
}

function greetingIn(body: unknown): Greeting | null {
  if (!isRecord(body) || body.viu !== 'middleman') return null;
  if (typeof body.protocol !== 'number' || typeof body.herdr !== 'string') return null;
  return { viu: 'middleman', protocol: body.protocol, herdr: body.herdr };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
