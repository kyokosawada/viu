import type { HerdrConnection } from '../herdr/connection.js';

export type HerdrPane = Record<string, unknown>;

export interface FakeHerdr extends HerdrConnection {
  showPanes(panes: readonly HerdrPane[]): void;
}

export function createFakeHerdr(panes: readonly HerdrPane[] = []): FakeHerdr {
  let known = [...panes];

  return {
    showPanes(next) {
      known = [...next];
    },

    request(method) {
      if (method !== 'pane.list') {
        return Promise.reject(new Error(`fake herdr does not answer ${method}`));
      }
      return Promise.resolve({ type: 'pane_list', panes: known.map((pane) => ({ ...pane })) });
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
