import {
  PANE_STATES,
  PROTOCOL_VERSION,
  TURN_ROLES,
  type Conversation,
  type Fleet,
  type Greeting,
  type Pane,
  type PaneId,
  type PaneState,
  type Turn,
  type TurnRole,
} from '@viu/protocol';

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
  async function ask<Got>(
    path: string,
    readingIt: (body: unknown) => Got | null,
  ): Promise<Reach<Got>> {
    let answer: Answered;
    try {
      answer = await within(PATIENCE, async (signal) => {
        const answering = await fetching(`${urlOf(machine)}${path}`, { signal });
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

    const got = readingIt(answer.body);
    return got === null
      ? { kind: 'not-the-middleman', why: 'it answered as something else' }
      : { kind: 'reached', got };
  }

  return {
    async greet(): Promise<Reach<Greeting>> {
      const reach = await ask('/', greetingIn);
      if (reach.kind === 'reached' && reach.got.protocol !== PROTOCOL_VERSION) {
        return { kind: 'trouble', trouble: protocolMismatch(reach.got.protocol) };
      }
      return reach;
    },

    fleet(): Promise<Reach<Fleet>> {
      return ask('/fleet', fleetIn);
    },

    conversation(paneId: PaneId): Promise<Reach<Conversation>> {
      return ask(`/panes/${encodeURIComponent(paneId)}/conversation`, conversationIn);
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

function fleetIn(body: unknown): Fleet | null {
  if (!isRecord(body) || !Array.isArray(body.panes)) return null;
  const listed: unknown[] = body.panes;

  const panes: Pane[] = [];
  const handles = new Set<string>();
  for (const each of listed) {
    const pane = paneIn(each);
    if (pane === null || handles.has(pane.id)) return null;
    handles.add(pane.id);
    panes.push(pane);
  }
  return { panes };
}

function paneIn(value: unknown): Pane | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id === '') return null;
  if (!isState(value.state)) return null;

  const project = textOrNull(value.project);
  const agent = textOrNull(value.agent);
  const activity = textOrNull(value.activity);
  if (project === undefined || agent === undefined || activity === undefined) return null;

  return { id: value.id, project, agent, activity, state: value.state };
}

function conversationIn(body: unknown): Conversation | null {
  if (!isRecord(body) || typeof body.paneId !== 'string' || body.paneId === '') return null;
  if (!Array.isArray(body.turns)) return null;
  const listed: unknown[] = body.turns;

  const turns: Turn[] = [];
  for (const each of listed) {
    const turn = turnIn(each);
    if (turn === null) return null;
    turns.push(turn);
  }
  return { paneId: body.paneId, turns };
}

function turnIn(value: unknown): Turn | null {
  if (!isRecord(value) || !isRole(value.role)) return null;
  if (typeof value.text !== 'string' || typeof value.cut !== 'boolean') return null;
  return { role: value.role, text: value.text, cut: value.cut };
}

function isRole(value: unknown): value is TurnRole {
  return TURN_ROLES.some((role) => role === value);
}

function isState(value: unknown): value is PaneState {
  return PANE_STATES.some((state) => state === value);
}

function textOrNull(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === 'string' ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
