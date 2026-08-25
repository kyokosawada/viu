import {
  PANE_STATES,
  PROTOCOL_VERSION,
  TURN_ROLES,
  UPDATES_PATH,
  type Conversation,
  type Fleet,
  type Greeting,
  type Key,
  type Pane,
  type PaneId,
  type PaneState,
  type Send,
  type Sent,
  type Turn,
  type TurnRole,
  type Watching,
} from '@viu/protocol';

import { addressOf, urlOf, type Machine } from '../machine';

import type { Change, Connection, MiddlemanClient, Reach, Receive } from './client';
import { nothingAnswered, protocolMismatch, troubleIn } from './trouble';

export type Fetching = (
  url: string,
  options: {
    readonly signal: AbortSignal;
    readonly method?: string;
    readonly headers?: Record<string, string>;
    readonly body?: string;
  },
) => Promise<Response>;

export interface Heard {
  opened(): void;
  received(text: string): void;
  closed(why: string): void;
}

export interface Sending {
  send(text: string): void;
  close(): void;
}

export type Socketing = (url: string, heard: Heard) => Sending;

const PATIENCE = 5000;

const PATIENCE_SENDING = 20000;

const PATIENCE_UPLOADING = 60000;

interface Answered {
  readonly ok: boolean;
  readonly status: number;
  readonly body: unknown;
}

export function httpMiddleman(
  machine: Machine,
  fetching: Fetching,
  socketing: Socketing,
): MiddlemanClient {
  async function ask<Got>(
    path: string,
    readingIt: (body: unknown) => Got | null,
    telling?: unknown,
    patience: number = PATIENCE,
  ): Promise<Reach<Got>> {
    let answer: Answered;
    try {
      answer = await within(patience, async (signal) => {
        const answering = await fetching(`${urlOf(machine)}${path}`, {
          signal,
          ...(telling === undefined
            ? {}
            : {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(telling),
              }),
        });
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

    connect(receive: Receive): Connection {
      return held(`ws://${addressOf(machine)}${UPDATES_PATH}`, socketing, receive);
    },

    send(paneId: PaneId, sending: Send): Promise<Reach<Sent>> {
      return ask(
        `/panes/${encodeURIComponent(paneId)}/send`,
        sentIn,
        sending,
        sending.parts.some((part) => 'image' in part) ? PATIENCE_UPLOADING : PATIENCE_SENDING,
      );
    },

    press(paneId: PaneId, keys: readonly Key[]): Promise<Reach<void>> {
      return ask(`/panes/${encodeURIComponent(paneId)}/keys`, nothingBack, { keys });
    },
  };
}

function held(url: string, socketing: Socketing, receive: Receive): Connection {
  let delivering = true;
  let disposed = false;
  let open = false;
  let watching: PaneId | null = null;
  const waiting: string[] = [];
  let sending: Sending | null = null;

  let patience: ReturnType<typeof setTimeout> | null = setTimeout(() => {
    gone('it did not answer in time');
  }, PATIENCE);

  function settled(): void {
    if (patience === null) return;
    clearTimeout(patience);
    patience = null;
  }

  function gone(why: string): void {
    if (!delivering) return;
    delivering = false;
    settled();
    receive({ kind: 'unreachable', why });
  }

  const flush = (): void => {
    if (sending === null || !open) return;
    for (const said of waiting.splice(0)) sending.send(said);
  };

  const say = (asked: Watching): void => {
    waiting.push(JSON.stringify(asked));
    flush();
  };

  sending = socketing(url, {
    opened: () => {
      open = true;
      flush();
    },

    received: (text: string) => {
      if (!delivering) return;
      settled();
      receive(changeIn(text));
    },

    closed: (why: string) => {
      gone(why);
    },
  });
  flush();

  return {
    watch(paneId: PaneId): void {
      if (!delivering || watching === paneId) return;
      watching = paneId;
      say({ kind: 'watch', paneId });
    },

    stopWatching(): void {
      if (!delivering || watching === null) return;
      watching = null;
      say({ kind: 'stop-watching' });
    },

    close(): void {
      if (disposed) return;
      disposed = true;
      delivering = false;
      settled();
      sending.close();
    },
  };
}

function changeIn(text: string): Reach<Change> {
  let said: unknown;
  try {
    said = JSON.parse(text);
  } catch {
    return { kind: 'not-the-middleman', why: 'it said something that is not the protocol' };
  }
  if (!isRecord(said)) {
    return { kind: 'not-the-middleman', why: 'it said something that is not the protocol' };
  }

  if (said.kind === 'fleet') {
    const fleet = fleetIn(said.fleet);
    return fleet === null
      ? somethingElse('a fleet')
      : { kind: 'reached', got: { kind: 'fleet', fleet } };
  }
  if (said.kind === 'conversation') {
    const conversation = conversationIn(said.conversation);
    return conversation === null
      ? somethingElse('a conversation')
      : { kind: 'reached', got: { kind: 'conversation', conversation } };
  }
  if (said.kind === 'trouble') {
    const trouble = troubleIn(said.trouble);
    return trouble === null ? somethingElse('a trouble') : { kind: 'trouble', trouble };
  }
  return { kind: 'not-the-middleman', why: 'it said something Viu has no word for' };
}

function somethingElse(claimed: string): Reach<never> {
  return { kind: 'not-the-middleman', why: `it sent ${claimed} Viu cannot read` };
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

function nothingBack(body: unknown): undefined | null {
  return body === null ? undefined : null;
}

function sentIn(body: unknown): Sent | null {
  if (!isRecord(body) || typeof body.paneId !== 'string' || body.paneId === '') return null;
  if (body.confidence === 'confirmed') {
    return isState(body.state)
      ? { paneId: body.paneId, confidence: 'confirmed', state: body.state }
      : null;
  }
  if (body.confidence === 'queued') {
    return typeof body.mayBeCut === 'boolean'
      ? { paneId: body.paneId, confidence: 'queued', mayBeCut: body.mayBeCut }
      : null;
  }
  return null;
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
