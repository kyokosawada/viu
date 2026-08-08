import type { Fleet } from '@viu/protocol';
import { describe, expect, test } from 'vitest';

import { createMiddleman } from './middleman.js';
import type { HerdrPane } from './testing/fake-herdr.js';
import { createFakeHerdr, herdrAgentSession, herdrPane } from './testing/fake-herdr.js';

function fleetOf(panes: readonly HerdrPane[]): Promise<Fleet> {
  return createMiddleman(createFakeHerdr(panes)).fleet();
}

describe('asking the middleman for the fleet', () => {
  test('returns every pane the herdr server knows about, as one flat list', async () => {
    const fleet = await fleetOf([
      herdrPane({ pane_id: 'w1:p1', workspace_id: 'w1', tab_id: 'w1:t1' }),
      herdrPane({ pane_id: 'w2:p1', workspace_id: 'w2', tab_id: 'w2:t1' }),
      herdrPane({ pane_id: 'w2:p6J', workspace_id: 'w2', tab_id: 'w2:t54' }),
    ]);

    expect(fleet.panes.map((pane) => pane.id)).toEqual(['w1:p1', 'w2:p1', 'w2:p6J']);
  });

  test('puts the panes that need you ahead of everything else', async () => {
    const fleet = await fleetOf([
      herdrPane({ pane_id: 'w1:p1', agent: 'claude', agent_status: 'working' }),
      herdrPane({ pane_id: 'w1:p2' }),
      herdrPane({ pane_id: 'w1:p3', agent: 'claude', agent_status: 'blocked' }),
      herdrPane({ pane_id: 'w1:p4', agent: 'codex', agent_status: 'idle' }),
      herdrPane({ pane_id: 'w1:p5', agent: 'codex', agent_status: 'blocked' }),
    ]);

    expect(fleet.panes.map((pane) => pane.id)).toEqual([
      'w1:p3',
      'w1:p5',
      'w1:p1',
      'w1:p2',
      'w1:p4',
    ]);
  });

  test('carries the project each pane is working in and what its agent is doing', async () => {
    const fleet = await fleetOf([
      herdrPane({
        pane_id: 'w2:p6J',
        cwd: '/home/gcpaps/firstmate/projects/viu',
        foreground_cwd: '/home/gcpaps/.treehouse/viu-43920d/6/viu',
        agent: 'claude',
        display_agent: 'Claude',
        agent_status: 'working',
        terminal_title: '⠐ Build the fleet listing',
        terminal_title_stripped: 'Build the fleet listing',
      }),
    ]);

    expect(fleet.panes).toEqual([
      {
        id: 'w2:p6J',
        project: 'viu',
        agent: 'Claude',
        activity: 'Build the fleet listing',
        state: 'thinking',
      },
    ]);
  });

  test('falls back to the pane directory, and reports no project when herdr knows none', async () => {
    const fleet = await fleetOf([
      herdrPane({ pane_id: 'w1:p1', cwd: '/home/gcpaps/dev/automation/one' }),
      herdrPane({ pane_id: 'w1:p2' }),
    ]);

    expect(fleet.panes.map((pane) => pane.project)).toEqual(['one', null]);
  });

  test('surfaces a herdr that cannot answer rather than reporting an empty fleet', async () => {
    const middleman = createMiddleman({
      request: () => Promise.reject(new Error('herdr socket is unreachable')),
    });

    await expect(middleman.fleet()).rejects.toThrow('herdr socket is unreachable');
  });

  test('leaves out a pane herdr lists without the durable handle Viu addresses it by', async () => {
    const fleet = await fleetOf([{ terminal_id: 'term_6587eab55fb311' }, herdrPane({})]);

    expect(fleet.panes.map((pane) => pane.id)).toEqual(['w1:p1']);
  });
});

describe('the state a pane arrives in', () => {
  async function stateOf(overrides: HerdrPane): Promise<string> {
    const fleet = await fleetOf([herdrPane(overrides)]);
    return fleet.panes[0]?.state ?? 'no pane';
  }

  test('is needs you when herdr says the agent is blocked', async () => {
    await expect(stateOf({ agent: 'claude', agent_status: 'blocked' })).resolves.toBe('needs-you');
  });

  test('is thinking when herdr says the agent is working', async () => {
    await expect(stateOf({ agent: 'claude', agent_status: 'working' })).resolves.toBe('thinking');
  });

  test('is idle when the agent is idle or done', async () => {
    await expect(stateOf({ agent: 'claude', agent_status: 'idle' })).resolves.toBe('idle');
    await expect(stateOf({ agent: 'claude', agent_status: 'done' })).resolves.toBe('idle');
  });

  test('is unknown when herdr recognises an agent but cannot say what it is doing', async () => {
    await expect(stateOf({ agent: 'claude', agent_status: 'unknown' })).resolves.toBe('unknown');
  });

  test('is dormant when a past agent conversation has no agent herdr can see', async () => {
    const fleet = await fleetOf([
      herdrPane({ agent_status: 'unknown', agent_session: herdrAgentSession() }),
    ]);

    expect(fleet.panes[0]).toMatchObject({ state: 'dormant', agent: null });
  });

  test('tells a dormant pane apart from one that never held an agent', async () => {
    const fleet = await fleetOf([
      herdrPane({ pane_id: 'w1:p1', agent_session: herdrAgentSession() }),
      herdrPane({ pane_id: 'w1:p2' }),
    ]);

    expect(fleet.panes.map((pane) => pane.state)).toEqual(['dormant', 'idle']);
  });
});

describe('what herdr says but the phone never sees', () => {
  test('drops focused, terminal_id and revision from every pane', async () => {
    const fleet = await fleetOf([
      herdrPane({
        pane_id: 'w2:pV',
        terminal_id: 'term_6587eab55fb311',
        focused: true,
        revision: 7,
        agent: 'claude',
        agent_status: 'blocked',
        agent_session: herdrAgentSession(),
        state_labels: { working: 'thinking', blocked: 'needs you' },
        tokens: { in: '12000', out: '800' },
      }),
    ]);

    const answer = JSON.stringify(fleet);
    expect(answer).not.toContain('focused');
    expect(answer).not.toContain('terminal_id');
    expect(answer).not.toContain('term_');
    expect(answer).not.toContain('revision');
    expect(answer).not.toContain('blocked');
  });

  test('keeps the pane handle steady across a herdr restart that renews the terminal', async () => {
    const herdr = createFakeHerdr([
      herdrPane({
        pane_id: 'w2:p6J',
        terminal_id: 'term_6587ec430f6723',
        agent: 'claude',
        agent_status: 'blocked',
        agent_session: herdrAgentSession(),
      }),
    ]);
    const middleman = createMiddleman(herdr);

    const before = await middleman.fleet();
    herdr.showPanes([
      herdrPane({
        pane_id: 'w2:p6J',
        terminal_id: 'term_65813998386561',
        agent_status: 'unknown',
        agent_session: herdrAgentSession(),
      }),
    ]);
    const after = await middleman.fleet();

    expect(before.panes[0]?.id).toBe('w2:p6J');
    expect(after.panes[0]?.id).toBe(before.panes[0]?.id);
    expect(after.panes[0]?.state).toBe('dormant');
  });
});
