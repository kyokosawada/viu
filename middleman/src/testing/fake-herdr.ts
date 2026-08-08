import type { HerdrConnection, HerdrPane } from '../herdr/connection.js';

export interface FakeHerdr extends HerdrConnection {
  showPanes(panes: readonly HerdrPane[]): void;
  showScreen(paneId: string, screen: string): void;
}

export function createFakeHerdr(panes: readonly HerdrPane[] = []): FakeHerdr {
  let known = [...panes];
  const screens = new Map<string, string>();

  const find = (params: Record<string, unknown>): HerdrPane => {
    const wanted = known.find((pane) => pane.pane_id === params.pane_id);
    if (wanted === undefined) throw new Error(`fake herdr has no pane ${String(params.pane_id)}`);
    return wanted;
  };

  return {
    showPanes(next) {
      known = [...next];
    },

    showScreen(paneId, screen) {
      screens.set(paneId, screen);
    },

    request(method, params) {
      try {
        switch (method) {
          case 'pane.list':
            return Promise.resolve({
              type: 'pane_list',
              panes: known.map((pane) => ({ ...pane })),
            });
          case 'pane.get':
            return Promise.resolve({ type: 'pane_info', pane: { ...find(params) } });
          case 'pane.read':
            return Promise.resolve({
              type: 'pane_read',
              read: {
                pane_id: find(params).pane_id,
                source: params.source,
                format: params.format,
                text: screens.get(String(params.pane_id)) ?? '',
                truncated: false,
              },
            });
          default:
            return Promise.reject(new Error(`fake herdr does not answer ${method}`));
        }
      } catch (refusal) {
        return Promise.reject(refusal instanceof Error ? refusal : new Error(String(refusal)));
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
