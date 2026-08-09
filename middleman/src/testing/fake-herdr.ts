import { HerdrRefusal, type HerdrConnection, type HerdrPane } from '../herdr/connection.js';

export interface Delivery {
  readonly paneId: string;
  readonly text: string | null;
  readonly submits: boolean;
}

export interface FakeHerdr extends HerdrConnection {
  showPanes(panes: readonly HerdrPane[]): void;
  showScreen(paneId: string, screen: string): void;
  promptLeavesTheAgentWhereItWas(): void;
  speaksProtocol(protocol: number | null, version?: string): void;
  delivered(): readonly Delivery[];
  arrived(paneId: string): string;
  reads(): readonly string[];
  subscriptions(): number;
}

interface Listener {
  readonly wanted: ReadonlySet<string>;
  readonly onEvent: () => void;
}

const SUBMITTING_KEYS = new Set(['enter', 'return']);

const KEY_SEQUENCES = new Map<string, string>([
  ['esc', '\u001b'],
  ['escape', '\u001b'],
  ['enter', '\r'],
  ['return', '\r'],
  ['tab', '\t'],
  ['up', '\u001b[A'],
  ['down', '\u001b[B'],
  ['right', '\u001b[C'],
  ['left', '\u001b[D'],
  ['backspace', '\u007f'],
  ['bs', '\u007f'],
  ['space', ' '],
  ['c-c', '\u0003'],
]);

export function createFakeHerdr(panes: readonly HerdrPane[] = []): FakeHerdr {
  let known = [...panes];
  let agentsPickUpWork = true;
  let spoken: { protocol: number | null; version: string } = { protocol: 17, version: '0.7.5' };
  const screens = new Map<string, string>();
  const deliveries: Delivery[] = [];
  const arrivals = new Map<string, string>();
  const screensRead: string[] = [];
  const listeners = new Set<Listener>();

  const paneNamed = (paneId: unknown): HerdrPane | undefined =>
    known.find((pane) => pane.pane_id === paneId);

  const agentNamed = (target: unknown): HerdrPane => {
    const pane = paneNamed(target);
    if (pane?.agent === undefined || pane.agent === null) {
      throw new HerdrRefusal('agent_not_found', `agent target ${String(target)} not found`);
    }
    return pane;
  };

  const paneAddressed = (paneId: unknown): HerdrPane => {
    const pane = paneNamed(paneId);
    if (pane === undefined) {
      throw new HerdrRefusal('pane_not_found', `pane ${String(paneId)} not found`);
    }
    return pane;
  };

  const sequenceOf = (key: string): string => {
    const sequence = KEY_SEQUENCES.get(key);
    if (sequence === undefined) {
      throw new HerdrRefusal('invalid_key', `unsupported key ${key}`);
    }
    return sequence;
  };

  const emit = (event: string): void => {
    for (const listener of listeners) if (listener.wanted.has(event)) listener.onEvent();
  };

  const nowShowing = (next: readonly HerdrPane[]): void => {
    const before = known;
    known = [...next];
    for (const pane of known) {
      const was = before.find((each) => each.pane_id === pane.pane_id);
      if (was === undefined) emit('pane_created');
      else if (asText(was) !== asText(pane)) emit('pane_updated');
    }
    for (const pane of before) {
      if (!known.some((each) => each.pane_id === pane.pane_id)) emit('pane_closed');
    }
  };

  const record = (paneId: unknown, text: unknown, keys: unknown, submits?: boolean): void => {
    const pressed = Array.isArray(keys) ? keys.map(String) : [];
    const typed = typeof text === 'string' ? text : null;
    const pane = String(paneId);
    const sequences = pressed.map(sequenceOf).join('');
    arrivals.set(pane, (arrivals.get(pane) ?? '') + (typed ?? '') + sequences);
    deliveries.push({
      paneId: pane,
      text: typed,
      submits: submits ?? pressed.some((key) => SUBMITTING_KEYS.has(key)),
    });
  };

  const answer = (method: string, params: Record<string, unknown>): unknown => {
    switch (method) {
      case 'ping':
        return {
          type: 'pong',
          version: spoken.version,
          ...(spoken.protocol === null ? {} : { protocol: spoken.protocol }),
        };

      case 'pane.list':
        return { type: 'pane_list', panes: known.map((pane) => ({ ...pane })) };

      case 'pane.get':
        return { type: 'pane_info', pane: { ...paneAddressed(params.pane_id) } };

      case 'pane.read':
        screensRead.push(String(params.pane_id));
        return {
          type: 'pane_read',
          read: {
            pane_id: paneAddressed(params.pane_id).pane_id,
            source: params.source,
            format: params.format,
            text: screens.get(String(params.pane_id)) ?? '',
            truncated: false,
          },
        };

      case 'pane.send_text':
        paneAddressed(params.pane_id);
        record(params.pane_id, params.text, []);
        return { type: 'ok' };

      case 'pane.send_keys':
        paneAddressed(params.pane_id);
        record(params.pane_id, null, params.keys);
        return { type: 'ok' };

      case 'pane.send_input':
        paneAddressed(params.pane_id);
        record(params.pane_id, params.text, params.keys);
        return { type: 'ok' };

      case 'agent.get':
        return { type: 'agent_info', agent: { ...agentNamed(params.target) } };

      case 'agent.prompt': {
        const pane = agentNamed(params.target);
        record(params.target, params.text, [], true);
        if (!agentsPickUpWork) {
          throw new HerdrRefusal('timeout', 'timed out waiting for agent status');
        }
        nowShowing(
          known.map((each) => (each === pane ? { ...each, agent_status: 'working' } : each)),
        );
        return { type: 'agent_prompted', agent: { ...pane, agent_status: 'working' } };
      }

      default:
        throw new Error(`fake herdr does not answer ${method}`);
    }
  };

  return {
    showPanes(next) {
      nowShowing(next);
    },

    showScreen(paneId, screen) {
      screens.set(paneId, screen);
    },

    promptLeavesTheAgentWhereItWas() {
      agentsPickUpWork = false;
    },

    speaksProtocol(protocol, version = spoken.version) {
      spoken = { protocol, version };
    },

    delivered() {
      return [...deliveries];
    },

    arrived(paneId) {
      return arrivals.get(paneId) ?? '';
    },

    reads() {
      return [...screensRead];
    },

    subscriptions() {
      return listeners.size;
    },

    request(method, params) {
      try {
        return Promise.resolve(answer(method, params));
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
    },

    subscribe(method, params, onEvent) {
      if (method !== 'events.subscribe') throw new Error(`fake herdr does not answer ${method}`);
      const listener: Listener = { wanted: eventsAskedFor(params.subscriptions), onEvent };
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function eventsAskedFor(subscriptions: unknown): ReadonlySet<string> {
  const asked: unknown[] = Array.isArray(subscriptions) ? subscriptions : [];
  return new Set(
    asked.map((each) => String((each as Record<string, unknown>).type).replace('.', '_')),
  );
}

function asText(pane: HerdrPane): string {
  return JSON.stringify(Object.entries(pane).sort(([one], [other]) => one.localeCompare(other)));
}

export function herdrAnswering(request: HerdrConnection['request']): HerdrConnection {
  return { request, subscribe: () => () => undefined };
}

export function herdrPane(overrides: HerdrPane = {}): HerdrPane {
  return {
    pane_id: 'w1:p1',
    terminal_id: 'term_6587eab55fb311',
    workspace_id: 'w1',
    tab_id: 'w1:t1',
    focused: false,
    agent_status: 'unknown',
    revision: 2,
    scroll: { offset_from_bottom: 0, max_offset_from_bottom: 0, viewport_rows: 40 },
    ...overrides,
  };
}

export interface HerdrAgentSession {
  source: string;
  agent: string;
  kind: string;
  value: string;
}

export function herdrAgentSession(
  value = 'd40a0114-79ec-447b-bbae-07e4e6cafb48',
): HerdrAgentSession {
  return { source: 'herdr:claude', agent: 'claude', kind: 'id', value };
}
