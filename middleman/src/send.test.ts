import { describe, expect, test } from 'vitest';

import { PaneGone } from './errors.js';
import { createMiddleman } from './middleman.js';
import { createFakeHerdr, herdrAgentSession, herdrPane } from './testing/fake-herdr.js';

const agentPane = herdrPane({
  pane_id: 'w2:p6J',
  agent: 'claude',
  display_agent: 'Claude',
  agent_status: 'blocked',
  agent_session: herdrAgentSession(),
  cwd: '/home/gcpaps/dev/viu',
});

const shellPane = herdrPane({ pane_id: 'w1:pA', cwd: '/home/gcpaps/dev/automation' });

describe('answering a recognised agent', () => {
  test('delivers the text and reports submission as confirmed', async () => {
    const middleman = createMiddleman(createFakeHerdr([agentPane]));

    const sent = await middleman.send('w2:p6J', 'use the second one');

    expect(sent).toEqual({ paneId: 'w2:p6J', confidence: 'confirmed', state: 'thinking' });
  });

  test('reports the state the agent is in after the answer, not the one it was waiting in', async () => {
    const herdr = createFakeHerdr([agentPane]);
    const middleman = createMiddleman(herdr);

    expect((await middleman.fleet()).panes[0]?.state).toBe('needs-you');
    const sent = await middleman.send('w2:p6J', 'use the second one');

    expect(sent.confidence === 'confirmed' && sent.state).toBe('thinking');
  });

  test('drops to queued when herdr never sees the agent pick the answer up', async () => {
    const herdr = createFakeHerdr([agentPane]);
    herdr.promptLeavesTheAgentWhereItWas();

    const sent = await createMiddleman(herdr).send('w2:p6J', 'use the second one');

    expect(sent).toEqual({ paneId: 'w2:p6J', confidence: 'queued', mayBeCut: false });
    expect(herdr.delivered()).toEqual([
      { paneId: 'w2:p6J', text: 'use the second one', submits: true },
    ]);
  });

  test('claims confirmed only for an agent that was seen to start working', async () => {
    const stalled = createFakeHerdr([agentPane]);
    stalled.promptLeavesTheAgentWhereItWas();

    const seen = await createMiddleman(createFakeHerdr([agentPane])).send('w2:p6J', 'yes');
    const unseen = await createMiddleman(stalled).send('w2:p6J', 'yes');

    expect(seen.confidence).toBe('confirmed');
    expect(unseen.confidence).toBe('queued');
  });
});

describe('typing into a pane with no recognised agent', () => {
  test('delivers the text and reports queuing only', async () => {
    const middleman = createMiddleman(createFakeHerdr([shellPane]));

    const sent = await middleman.send('w1:pA', 'git status');

    expect(sent).toEqual({ paneId: 'w1:pA', confidence: 'queued', mayBeCut: false });
  });

  test('reports queuing only for a dormant pane, which herdr no longer sees an agent in', async () => {
    const dormant = herdrPane({ pane_id: 'w1:pD', agent_session: herdrAgentSession() });

    const sent = await createMiddleman(createFakeHerdr([dormant])).send('w1:pD', 'are you there');

    expect(sent.confidence).toBe('queued');
  });

  test('warns that a dictated paragraph longer than one canonical line may be cut', async () => {
    const middleman = createMiddleman(createFakeHerdr([shellPane]));

    const short = await middleman.send('w1:pA', 'a'.repeat(4095));
    const long = await middleman.send('w1:pA', 'a'.repeat(4096));
    const broken = await middleman.send('w1:pA', `${'a'.repeat(4096)}\nshort`);

    expect(short).toMatchObject({ mayBeCut: false });
    expect(long).toMatchObject({ mayBeCut: true });
    expect(broken).toMatchObject({ mayBeCut: true });
  });

  test('measures that line against the bytes sent, not the characters typed', async () => {
    const middleman = createMiddleman(createFakeHerdr([shellPane]));

    const sent = await middleman.send('w1:pA', 'é'.repeat(2048));

    expect(sent).toMatchObject({ mayBeCut: true });
  });
});

describe('the two guarantees the phone is given', () => {
  test('are named in the response, so the phone never has to probe for which it has', async () => {
    const middleman = createMiddleman(createFakeHerdr([agentPane, shellPane]));

    const toAgent = await middleman.send('w2:p6J', 'yes');
    const toShell = await middleman.send('w1:pA', 'yes');

    expect(toAgent.confidence).toBe('confirmed');
    expect(toShell.confidence).toBe('queued');
  });

  test('never let a queued send carry a state, which is the thing only the agent path knows', async () => {
    const middleman = createMiddleman(createFakeHerdr([agentPane, shellPane]));

    const toAgent = await middleman.send('w2:p6J', 'yes');
    const toShell = await middleman.send('w1:pA', 'yes');

    expect(Object.keys(toAgent).sort()).toEqual(['confidence', 'paneId', 'state']);
    expect(Object.keys(toShell).sort()).toEqual(['confidence', 'mayBeCut', 'paneId']);
  });

  test('keep herdr out of the answer', async () => {
    const middleman = createMiddleman(createFakeHerdr([agentPane]));

    const answer = JSON.stringify(await middleman.send('w2:p6J', 'yes'));

    expect(answer).not.toContain('blocked');
    expect(answer).not.toContain('working');
    expect(answer).not.toContain('terminal_id');
    expect(answer).not.toContain('term_');
    expect(answer).not.toContain('revision');
    expect(answer).not.toContain('focused');
  });
});

describe('the text and the keypress that submits it', () => {
  test('reach an agent as one operation', async () => {
    const herdr = createFakeHerdr([agentPane]);

    await createMiddleman(herdr).send('w2:p6J', 'the second one, please');

    expect(herdr.delivered()).toEqual([
      { paneId: 'w2:p6J', text: 'the second one, please', submits: true },
    ]);
  });

  test('reach a shell as one operation', async () => {
    const herdr = createFakeHerdr([shellPane]);

    await createMiddleman(herdr).send('w1:pA', 'git status');

    expect(herdr.delivered()).toEqual([{ paneId: 'w1:pA', text: 'git status', submits: true }]);
  });

  test('are never two operations with a gap between them', async () => {
    const herdr = createFakeHerdr([agentPane, shellPane]);
    const middleman = createMiddleman(herdr);

    await middleman.send('w2:p6J', 'yes');
    await middleman.send('w1:pA', 'yes');

    expect(herdr.delivered()).toHaveLength(2);
    expect(herdr.delivered().every((delivery) => delivery.text !== null && delivery.submits)).toBe(
      true,
    );
  });
});

describe('sending somewhere that is not there', () => {
  test('says the pane is gone rather than reporting a send that never happened', async () => {
    const middleman = createMiddleman(createFakeHerdr([agentPane]));

    await expect(middleman.send('w9:p9', 'anyone home')).rejects.toThrow(PaneGone);
    await expect(middleman.send('w9:p9', 'anyone home')).rejects.toThrow(
      'pane w9:p9 is no longer in the fleet',
    );
  });

  test('names the pane that is gone, so the phone knows which conversation ended', async () => {
    const middleman = createMiddleman(createFakeHerdr([]));

    await expect(middleman.send('w1:pA', 'hello')).rejects.toMatchObject({ paneId: 'w1:pA' });
  });

  test('tells a pane that is gone apart from a herdr that cannot be reached', async () => {
    const middleman = createMiddleman({
      request: () => Promise.reject(new Error('herdr socket is unreachable')),
    });

    await expect(middleman.send('w1:pA', 'hello')).rejects.toThrow('herdr socket is unreachable');
    await expect(middleman.send('w1:pA', 'hello')).rejects.not.toThrow(PaneGone);
  });

  test('delivers nothing anywhere when the pane is gone', async () => {
    const herdr = createFakeHerdr([agentPane]);

    await expect(createMiddleman(herdr).send('w9:p9', 'hello')).rejects.toThrow(PaneGone);

    expect(herdr.delivered()).toEqual([]);
  });
});
