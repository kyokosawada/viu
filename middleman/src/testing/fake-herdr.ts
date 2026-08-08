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
  delivered(): readonly Delivery[];
}

const SUBMITTING_KEYS = new Set(['enter', 'return']);

export function createFakeHerdr(panes: readonly HerdrPane[] = []): FakeHerdr {
  let known = [...panes];
  let agentsPickUpWork = true;
  const screens = new Map<string, string>();
  const deliveries: Delivery[] = [];

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

  const record = (paneId: unknown, text: unknown, keys: unknown, submits?: boolean): void => {
    const pressed = Array.isArray(keys) ? keys.map(String) : [];
    deliveries.push({
      paneId: String(paneId),
      text: typeof text === 'string' ? text : null,
      submits: submits ?? pressed.some((key) => SUBMITTING_KEYS.has(key)),
    });
  };

  const answer = (method: string, params: Record<string, unknown>): unknown => {
    switch (method) {
      case 'pane.list':
        return { type: 'pane_list', panes: known.map((pane) => ({ ...pane })) };

      case 'pane.get':
        return { type: 'pane_info', pane: { ...paneAddressed(params.pane_id) } };

      case 'pane.read':
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
        known = known.map((each) => (each === pane ? { ...each, agent_status: 'working' } : each));
        return { type: 'agent_prompted', agent: { ...pane, agent_status: 'working' } };
      }

      default:
        throw new Error(`fake herdr does not answer ${method}`);
    }
  };

  return {
    showPanes(next) {
      known = [...next];
    },

    showScreen(paneId, screen) {
      screens.set(paneId, screen);
    },

    promptLeavesTheAgentWhereItWas() {
      agentsPickUpWork = false;
    },

    delivered() {
      return [...deliveries];
    },

    request(method, params) {
      try {
        return Promise.resolve(answer(method, params));
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
    },
  };
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
