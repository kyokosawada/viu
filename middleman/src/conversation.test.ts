import type { Conversation } from '@viu/protocol';
import { describe, expect, test } from 'vitest';

import type { HerdrPane } from './herdr/connection.js';
import { createMiddleman } from './middleman.js';
import { createFakeHerdr, herdrAgentSession, herdrPane } from './testing/fake-herdr.js';

const WIDTH = 60;
const ESCAPE = '\u001b';
const HARD_SPACE = '\u00a0';
const PROMPT_ICON = '\ue0a0';
const BELL = '\u0007';
const RESET = `${ESCAPE}[0m`;
const WHITE = `${ESCAPE}[38;2;255;255;255m`;
const GREY = `${ESCAPE}[38;2;153;153;153m`;
const BLOCK = `${ESCAPE}[48;2;55;55;55m`;
const RULE = `${RESET}${GREY}${'─'.repeat(WIDTH)}${RESET}`;
const FOOTER = [
  `  ${RESET}${GREY}Opus 5 (1M context) | 16.4k (2.0%) | $0.18${RESET}`,
  `  ${RESET}${GREY}⏵⏵ auto mode on (shift+tab to cycle)${RESET}`,
];

function agentOpens(text: string): string {
  return `${RESET}${WHITE}● ${RESET}${text}`;
}

function agentGoesOn(text: string): string {
  return `  ${RESET}${GREY}${text}${RESET}`;
}

function personBlock(lines: readonly string[]): readonly string[] {
  return lines.map(
    (line) => `${RESET}${BLOCK}  ${RESET}${WHITE}${BLOCK}${line.padEnd(WIDTH)}${RESET}`,
  );
}

function promptBox(draft = ''): readonly string[] {
  return [RULE, `${RESET}${GREY}❯${HARD_SPACE}${draft}${RESET}`, RULE];
}

function statusLine(text: string): string {
  return `${RESET}${GREY}${text}${RESET}`;
}

function claudePane(overrides: HerdrPane = {}): HerdrPane {
  return herdrPane({ agent: 'claude', display_agent: 'Claude', ...overrides });
}

function conversationOf(pane: HerdrPane, rows: readonly string[]): Promise<Conversation> {
  const id = String(pane.pane_id);
  const herdr = createFakeHerdr([pane]);
  herdr.showScreen(id, rows.join('\r\n'));
  return createMiddleman(herdr).conversation(id);
}

describe('opening a pane that holds an agent', () => {
  test('answers with conversation turns rather than the terminal screen', async () => {
    const conversation = await conversationOf(claudePane({ pane_id: 'w2:pV' }), [
      '',
      agentOpens('The tests pass. Shall I push the branch?'),
      '',
      agentGoesOn('Ran 2 shell commands'),
      '',
      statusLine('✻ Crunched for 1m 34s'),
      '',
      ...promptBox(),
      ...FOOTER,
    ]);

    expect(conversation).toEqual({
      paneId: 'w2:pV',
      turns: [
        {
          role: 'agent',
          text: 'The tests pass. Shall I push the branch?\n\nRan 2 shell commands',
          cut: false,
        },
      ],
    });
  });

  test('says of every turn whether the agent or the person produced it', async () => {
    const conversation = await conversationOf(claudePane(), [
      agentOpens('The tests are green.'),
      '',
      ...personBlock(['Push it, then open the pull request.']),
      '',
      agentOpens('Pushing now.'),
      '',
      ...promptBox(),
    ]);

    expect(conversation.turns).toEqual([
      { role: 'agent', text: 'The tests are green.', cut: false },
      { role: 'person', text: 'Push it, then open the pull request.', cut: false },
      { role: 'agent', text: 'Pushing now.', cut: false },
    ]);
  });

  test('leaves a person turn whole when the screenful shows where it began', async () => {
    const conversation = await conversationOf(claudePane(), [
      '',
      ...personBlock(['Push it when the tests are green.']),
      '',
      agentOpens('Pushing now.'),
      '',
      ...promptBox(),
    ]);

    expect(conversation.turns[0]).toEqual({
      role: 'person',
      text: 'Push it when the tests are green.',
      cut: false,
    });
  });

  test('marks the first turn cut when herdr has rows above the viewport', async () => {
    const conversation = await conversationOf(
      claudePane({
        scroll: { offset_from_bottom: 0, max_offset_from_bottom: 120, viewport_rows: 40 },
      }),
      [agentOpens('The tests pass.'), '', agentOpens('Pushing now.'), '', ...promptBox()],
    );

    expect(conversation.turns.map((turn) => turn.cut)).toEqual([true, false]);
  });

  test('marks a turn the top of the screenful cut through', async () => {
    const conversation = await conversationOf(claudePane(), [
      ...personBlock(['file and stop.', 'Do NOT run the pipeline. The merge authority decides.']),
      '',
      agentOpens('Understood - raising the pull request myself.'),
      '',
      ...promptBox(),
    ]);

    expect(conversation.turns).toEqual([
      {
        role: 'person',
        text: 'file and stop.\nDo NOT run the pipeline. The merge authority decides.',
        cut: true,
      },
      { role: 'agent', text: 'Understood - raising the pull request myself.', cut: false },
    ]);
  });

  test('gives a cut turn to the agent when it is not the person speaking', async () => {
    const conversation = await conversationOf(claudePane(), [
      agentGoesOn('51 +   } catch (refusal) {'),
      agentGoesOn('52     }'),
      '',
      agentOpens('That is the last of the edits.'),
      '',
      ...promptBox(),
    ]);

    expect(conversation.turns[0]).toEqual({
      role: 'agent',
      text: '51 +   } catch (refusal) {\n52     }',
      cut: true,
    });
  });

  test('does not mistake a painted diff in tool output for the person speaking', async () => {
    const conversation = await conversationOf(claudePane(), [
      agentOpens('Update(middleman/src/chat.ts)'),
      agentGoesOn('\u23bf  Added 2 lines, removed 1 line'),
      ...personBlock(['13 + const OPENING = /a marker/u;', '14 + const RULE = /a rule/u;']),
      agentGoesOn('15    const PROMPT = /a prompt/u;'),
      '',
      ...promptBox(),
    ]);

    expect(conversation.turns.map((turn) => turn.role)).toEqual(['agent']);
    expect(conversation.turns[0]?.text).toContain('13 + const OPENING');
  });

  test('keeps the input box, the status line and the footer out of the conversation', async () => {
    const conversation = await conversationOf(claudePane(), [
      agentOpens('Done.'),
      '',
      statusLine('✽ Symbioting… (3m 7s · ↓ 10.8k tokens)'),
      '',
      ...promptBox('half a question I have not sent'),
      ...FOOTER,
    ]);

    expect(conversation.turns).toEqual([{ role: 'agent', text: 'Done.', cut: false }]);
  });

  test('keeps the question when the agent is waiting on you', async () => {
    const conversation = await conversationOf(claudePane({ agent_status: 'blocked' }), [
      agentOpens('Tabs or spaces?'),
      '',
      RULE,
      `${RESET}${GREY}❯ 1. Spaces${RESET}`,
      `  ${RESET}${GREY}2. Tabs${RESET}`,
      RULE,
      `  ${RESET}${GREY}Enter to select · ↑/↓ to navigate · Esc to cancel${RESET}`,
    ]);

    expect(conversation.turns[0]?.text).toContain('1. Spaces');
    expect(conversation.turns[0]?.text).toContain('Enter to select');
  });

  test('lets no terminal formatting through as stray characters', async () => {
    const conversation = await conversationOf(claudePane(), [
      agentOpens(
        `Branch ${ESCAPE}]0;fm/read-a-pane${BELL}ready on ${PROMPT_ICON} main${HARD_SPACE}now.`,
      ),
      '',
      ...promptBox(),
    ]);

    const text = conversation.turns[0]?.text ?? '';
    expect(text).toBe('Branch ready on  main now.');
    expect(text).not.toContain(ESCAPE);
    expect(text).not.toContain(PROMPT_ICON);
    expect(text).not.toContain(HARD_SPACE);
  });
});

describe('opening a pane with no recognised agent', () => {
  test('answers with one raw-text turn rather than an error', async () => {
    const conversation = await conversationOf(herdrPane({ pane_id: 'w2:pA' }), [
      `one on ${PROMPT_ICON} main`,
      '❯ npm test',
      '',
    ]);

    expect(conversation).toEqual({
      paneId: 'w2:pA',
      turns: [{ role: 'pane', text: 'one on  main\n❯ npm test', cut: false }],
    });
  });

  test('marks the raw turn cut when herdr has more above than the screenful shows', async () => {
    const conversation = await conversationOf(
      herdrPane({
        scroll: { offset_from_bottom: 0, max_offset_from_bottom: 3981, viewport_rows: 40 },
      }),
      ['deep-3999', 'deep-4000'],
    );

    expect(conversation.turns).toEqual([{ role: 'pane', text: 'deep-3999\ndeep-4000', cut: true }]);
  });

  test('answers a dormant pane with its screenful rather than an empty conversation', async () => {
    const conversation = await conversationOf(herdrPane({ agent_session: herdrAgentSession() }), [
      agentOpens('The work is done.'),
      '',
      ...promptBox(),
    ]);

    expect(conversation.turns.map((turn) => turn.role)).toEqual(['pane']);
    expect(conversation.turns[0]?.text).toContain('The work is done.');
  });

  test('answers an agent Viu has no grammar for with raw text rather than a guess', async () => {
    const conversation = await conversationOf(herdrPane({ agent: 'gemini' }), ['thinking...']);

    expect(conversation.turns).toEqual([{ role: 'pane', text: 'thinking...', cut: false }]);
  });
});

describe('opening a pane herdr cannot show', () => {
  test('carries a refusal from herdr out rather than answering with an empty conversation', async () => {
    const middleman = createMiddleman(createFakeHerdr([herdrPane({ pane_id: 'w1:p1' })]));

    await expect(middleman.conversation('w9:pZ')).rejects.toThrow();
  });

  test('refuses an answer to pane.get that carries no pane', async () => {
    const middleman = createMiddleman({ request: () => Promise.resolve({ type: 'pane_info' }) });

    await expect(middleman.conversation('w1:p1')).rejects.toThrow('without a pane');
  });

  test('refuses an answer to pane.read that carries no screenful', async () => {
    const middleman = createMiddleman({
      request: (method) =>
        Promise.resolve(
          method === 'pane.get'
            ? { type: 'pane_info', pane: { pane_id: 'w1:p1' } }
            : { type: 'pane_read' },
        ),
    });

    await expect(middleman.conversation('w1:p1')).rejects.toThrow('without a screenful');
  });
});
