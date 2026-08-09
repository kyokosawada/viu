import { KEYS, type Key } from '@viu/protocol';
import { describe, expect, test } from 'vitest';

import { PaneGone, UnsupportedKey } from './errors.js';
import { createMiddleman } from './middleman.js';
import {
  createFakeHerdr,
  herdrAgentSession,
  herdrAnswering,
  herdrPane,
} from './testing/fake-herdr.js';

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
    const middleman = createMiddleman(
      herdrAnswering(() => Promise.reject(new Error('herdr socket is unreachable'))),
    );

    await expect(middleman.send('w1:pA', 'hello')).rejects.toThrow('herdr socket is unreachable');
    await expect(middleman.send('w1:pA', 'hello')).rejects.not.toThrow(PaneGone);
  });

  test('delivers nothing anywhere when the pane is gone', async () => {
    const herdr = createFakeHerdr([agentPane]);

    await expect(createMiddleman(herdr).send('w9:p9', 'hello')).rejects.toThrow(PaneGone);

    expect(herdr.delivered()).toEqual([]);
  });
});

describe('pressing named keys into a pane', () => {
  test('sends escape, ctrl-c, enter and tab as the sequences a terminal reads them from', async () => {
    const herdr = createFakeHerdr([shellPane]);
    const middleman = createMiddleman(herdr);

    await middleman.press('w1:pA', ['escape']);
    await middleman.press('w1:pA', ['ctrl-c']);
    await middleman.press('w1:pA', ['enter']);
    await middleman.press('w1:pA', ['tab']);

    expect(herdr.arrived('w1:pA')).toBe('\u001b\u0003\r\t');
  });

  test('sends the four arrow keys a picker moves on', async () => {
    const herdr = createFakeHerdr([shellPane]);

    await createMiddleman(herdr).press('w1:pA', ['up', 'down', 'left', 'right']);

    expect(herdr.arrived('w1:pA')).toBe('\u001b[A\u001b[B\u001b[D\u001b[C');
  });

  test('has a sequence for every key it offers, so no button on the row is dead', async () => {
    const herdr = createFakeHerdr([shellPane]);

    await createMiddleman(herdr).press('w1:pA', [...KEYS]);

    expect(herdr.arrived('w1:pA')).toBe('\u001b\r\t\u001b[A\u001b[B\u001b[D\u001b[C\u007f \u0003');
  });

  test('reaches a pane holding an agent the same way, a picker being answered by keys either way', async () => {
    const herdr = createFakeHerdr([agentPane]);

    await createMiddleman(herdr).press('w2:p6J', ['down', 'enter']);

    expect(herdr.arrived('w2:p6J')).toBe('\u001b[B\r');
  });
});

describe('pressing several keys in one call', () => {
  test('lands them in the order they were asked for', async () => {
    const herdr = createFakeHerdr([shellPane]);

    await createMiddleman(herdr).press('w1:pA', ['down', 'down', 'enter']);

    expect(herdr.arrived('w1:pA')).toBe('\u001b[B\u001b[B\r');
  });

  test('travels as one operation, so nothing can interleave between them', async () => {
    const herdr = createFakeHerdr([shellPane]);

    await createMiddleman(herdr).press('w1:pA', ['down', 'down', 'enter']);

    expect(herdr.delivered()).toEqual([{ paneId: 'w1:pA', text: null, submits: true }]);
  });

  test('is allowed to be no keys at all, which reaches the pane as nothing', async () => {
    const herdr = createFakeHerdr([shellPane]);

    await createMiddleman(herdr).press('w1:pA', []);

    expect(herdr.arrived('w1:pA')).toBe('');
  });
});

describe('pressing a key Viu cannot send', () => {
  test('is refused here rather than passed on to fail somewhere further away', async () => {
    const herdr = createFakeHerdr([shellPane]);

    await expect(createMiddleman(herdr).press('w1:pA', ['page-up' as Key])).rejects.toThrow(
      UnsupportedKey,
    );

    expect(herdr.delivered()).toEqual([]);
  });

  test('names the key it refused and the keys there are, so a client can correct itself', async () => {
    const middleman = createMiddleman(createFakeHerdr([shellPane]));

    await expect(middleman.press('w1:pA', ['page-up' as Key])).rejects.toThrow(
      'there is no key named page-up',
    );
    await expect(middleman.press('w1:pA', ['page-up' as Key])).rejects.toThrow(
      'escape, enter, tab, up, down, left, right, backspace, space, ctrl-c',
    );
  });

  test('refuses home, end, page up, page down and delete, none of which can be sent', async () => {
    const middleman = createMiddleman(createFakeHerdr([shellPane]));

    for (const missing of ['home', 'end', 'page-up', 'page-down', 'delete']) {
      await expect(middleman.press('w1:pA', [missing as Key])).rejects.toMatchObject({
        key: missing,
      });
    }
  });

  test('refuses the whole call, so a run of keys never half-lands', async () => {
    const herdr = createFakeHerdr([shellPane]);

    await expect(
      createMiddleman(herdr).press('w1:pA', ['down', 'page-up' as Key, 'enter']),
    ).rejects.toThrow(UnsupportedKey);

    expect(herdr.arrived('w1:pA')).toBe('');
  });

  test('keeps herdr out of the reason it gives', async () => {
    const middleman = createMiddleman(createFakeHerdr([shellPane]));

    const refused = await middleman
      .press('w1:pA', ['page-up' as Key])
      .then(() => '')
      .catch((error: unknown) => (error instanceof Error ? error.message : ''));

    expect(refused).not.toContain('c-c');
    expect(refused).not.toContain('esc,');
    expect(refused).not.toContain('invalid_key');
  });
});

describe('pressing keys somewhere that is not there', () => {
  test('says the pane is gone rather than reporting a press that never happened', async () => {
    const middleman = createMiddleman(createFakeHerdr([agentPane]));

    await expect(middleman.press('w9:p9', ['enter'])).rejects.toThrow(PaneGone);
    await expect(middleman.press('w9:p9', ['enter'])).rejects.toMatchObject({ paneId: 'w9:p9' });
  });

  test('tells a pane that is gone apart from a herdr that cannot be reached', async () => {
    const middleman = createMiddleman(
      herdrAnswering(() => Promise.reject(new Error('herdr socket is unreachable'))),
    );

    await expect(middleman.press('w1:pA', ['enter'])).rejects.toThrow('herdr socket is unreachable');
    await expect(middleman.press('w1:pA', ['enter'])).rejects.not.toThrow(PaneGone);
  });
});
