import { join } from 'node:path';

import type { Conversation } from '@viu/protocol';
import { describe, expect, test } from 'vitest';

import { attachmentsDirectory, attachmentsIn } from './attachments.js';

import type { HerdrPane } from './herdr/connection.js';
import { createMiddleman } from './middleman.js';
import {
  createFakeHerdr,
  herdrAgentSession,
  herdrAnswering,
  herdrPane,
} from './testing/fake-herdr.js';

const WIDTH = 60;
const ATTACHED_IN = '/home/someone/.viu/attachments';
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

const PI_WIDTH = 100;
const PI_USER_BG = `${ESCAPE}[48;2;52;53;65m`;
const PI_TOOL_BG = `${ESCAPE}[48;2;60;40;40m`;
const PI_BOLD_ON_TOOL_BG = `${ESCAPE}[1;48;2;60;40;40m`;
const PI_BLUE = `${ESCAPE}[38;2;129;162;190m`;
const PI_ITALIC_GREY = `${ESCAPE}[3;38;2;128;128;128m`;
const PI_RULE = `${RESET}${PI_BLUE}${'\u2500'.repeat(PI_WIDTH)}${RESET}`;
const PI_FOOTER = [
  `${RESET}${GREY}~/work (main)${RESET}`,
  `${RESET}${GREY}\u21912.4k \u2193600 0.8%/200k (auto)                    fake-1 \u00b7 medium${RESET}`,
];

function piRow(background: string, text: string): string {
  return `${RESET}${background}${text.padEnd(PI_WIDTH)}${RESET}`;
}

function piPersonBlock(lines: readonly string[]): readonly string[] {
  return ['', ...lines.map((line) => ` ${line}`), ''].map((line) => piRow(PI_USER_BG, line));
}

function piSays(text: string): string {
  return `${RESET} ${text}`;
}

function piThinks(text: string): string {
  return `${RESET} ${RESET}${PI_ITALIC_GREY}${text}${RESET}`;
}

function piToolBlock(
  header: string,
  output: readonly string[] = [],
  glyph = '',
): readonly string[] {
  const opening = `${RESET}${PI_TOOL_BG} ${glyph}${RESET}`;
  const head = `${opening}${PI_BOLD_ON_TOOL_BG}${header.padEnd(PI_WIDTH - 1)}${RESET}`;
  const body = output.length === 0 ? [] : ['', ...output.map((line) => ` ${line}`)];
  return [
    piRow(PI_TOOL_BG, ''),
    head,
    ...body.map((line) => piRow(PI_TOOL_BG, line)),
    piRow(PI_TOOL_BG, ''),
  ];
}

function piSpinner(message = 'Working...'): string {
  return `${RESET} ${RESET}${PI_BLUE}\u28f9${RESET} ${GREY}${message}${RESET}`;
}

function piInputBox(draft = ''): readonly string[] {
  return [PI_RULE, `${RESET}${draft}${RESET}${ESCAPE}[7m ${RESET}`, PI_RULE];
}

function piAsks(lines: readonly string[]): readonly string[] {
  return [PI_RULE, ...lines.map((line) => `${RESET} ${line}`), PI_RULE];
}

function piPane(overrides: HerdrPane = {}): HerdrPane {
  return herdrPane({ agent: 'pi', display_agent: 'pi', ...overrides });
}

function conversationOf(
  pane: HerdrPane,
  rows: readonly string[],
  attachments = attachmentsIn({ directory: ATTACHED_IN }),
): Promise<Conversation> {
  const id = String(pane.pane_id);
  const herdr = createFakeHerdr([pane]);
  herdr.showScreen(id, rows.join('\r\n'));
  return createMiddleman(herdr, attachments).conversation(id);
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
    const middleman = createMiddleman(herdrAnswering(() => Promise.resolve({ type: 'pane_info' })));

    await expect(middleman.conversation('w1:p1')).rejects.toThrow('without a pane');
  });

  test('refuses an answer to pane.read that carries no screenful', async () => {
    const middleman = createMiddleman(
      herdrAnswering((method) =>
        Promise.resolve(
          method === 'pane.get'
            ? { type: 'pane_info', pane: { pane_id: 'w1:p1' } }
            : { type: 'pane_read' },
        ),
      ),
    );

    await expect(middleman.conversation('w1:p1')).rejects.toThrow('without a screenful');
  });
});

describe('a turn that carried an image', () => {
  const attached = (name: string): string => join(ATTACHED_IN, name);
  const one = attached('2026-08-10T12-00-00-000Z-3f9a2c1d.jpg');
  const other = attached('2026-08-10T12-00-00-001Z-91b4ee07.png');

  test('reads as an [image] marker standing where the path stood, not as the path', async () => {
    const conversation = await conversationOf(claudePane(), [
      '',
      ...personBlock([`look at this ${one} here`]),
      '',
      ...promptBox(),
    ]);

    expect(conversation.turns[0]).toEqual({
      role: 'person',
      text: 'look at this [image] here',
      cut: false,
    });
  });

  test('marks every image the turn carried, each where it stood', async () => {
    const conversation = await conversationOf(claudePane(), [
      ...personBlock([`this screen ${one} should look like ${other}`]),
      '',
      ...promptBox(),
    ]);

    expect(conversation.turns[0]?.text).toBe('this screen [image] should look like [image]');
  });

  test('marks a path the owner sent with nothing said around it', async () => {
    const conversation = await conversationOf(claudePane(), [
      ...personBlock([one]),
      '',
      ...promptBox(),
    ]);

    expect(conversation.turns[0]?.text).toBe('[image]');
  });

  test('leaves a turn that carried no attachment exactly as it read', async () => {
    const conversation = await conversationOf(claudePane(), [
      ...personBlock(['Push it when the tests are green.']),
      '',
      ...promptBox(),
    ]);

    expect(conversation.turns[0]?.text).toBe('Push it when the tests are green.');
  });

  test('leaves a path that is not a Viu attachment alone', async () => {
    const elsewhere = '/home/gcpaps/dev/viu/docs/adr/0024.png';
    const named = attached('whiteboard.jpg');
    const conversation = await conversationOf(claudePane(), [
      ...personBlock([`open ${elsewhere} and ${named}`]),
      '',
      ...promptBox(),
    ]);

    expect(conversation.turns[0]?.text).toBe(`open ${elsewhere} and ${named}`);
  });

  test('recognises the attachments directory a middleman given none of its own writes into', async () => {
    const kept = join(attachmentsDirectory(), '2026-08-10T12-00-00-000Z-3f9a2c1d.jpg');
    const herdr = createFakeHerdr([herdrPane({ pane_id: 'w2:pA' })]);
    herdr.showScreen('w2:pA', `cat ${kept}`);

    const conversation = await createMiddleman(herdr).conversation('w2:pA');

    expect(conversation.turns[0]?.text).toBe('cat [image]');
  });

  test('marks a pane with no recognised agent the same way, the marker being no agent grammar', async () => {
    const conversation = await conversationOf(herdrPane({ pane_id: 'w2:pA' }), [
      `❯ cat ${one}`,
    ]);

    expect(conversation.turns).toEqual([{ role: 'pane', text: '❯ cat [image]', cut: false }]);
  });
});

describe('opening a pane that holds pi', () => {
  test('answers a multi-turn conversation as ordered person and agent turns', async () => {
    const conversation = await conversationOf(piPane({ pane_id: 'w3:pI' }), [
      ...piPersonBlock(['Push the branch when the tests are green.']),
      '',
      piSays('Checking the tests first.'),
      '',
      ...piPersonBlock(['Thanks - now open the pull request.']),
      '',
      piSays('Opening it now.'),
      '',
      ...piInputBox(),
      ...PI_FOOTER,
    ]);

    expect(conversation).toEqual({
      paneId: 'w3:pI',
      turns: [
        { role: 'person', text: 'Push the branch when the tests are green.', cut: false },
        { role: 'agent', text: 'Checking the tests first.', cut: false },
        { role: 'person', text: 'Thanks - now open the pull request.', cut: false },
        { role: 'agent', text: 'Opening it now.', cut: false },
      ],
    });
  });

  test("keeps pi's input area, status line and spinner out of the conversation", async () => {
    const conversation = await conversationOf(piPane(), [
      ...piPersonBlock(['Push the branch.']),
      '',
      piSays('Pushed.'),
      '',
      piSpinner(),
      '',
      ...piInputBox('half a question I have not sent'),
      ...PI_FOOTER,
    ]);

    expect(conversation.turns).toEqual([
      { role: 'person', text: 'Push the branch.', cut: false },
      { role: 'agent', text: 'Pushed.', cut: false },
    ]);
  });

  test("keeps pi's reasoning and tool activity inside the turn that produced them", async () => {
    const conversation = await conversationOf(piPane(), [
      ...piPersonBlock(['Push the branch when the tests are green.']),
      '',
      piThinks('The tests come first, then the push.'),
      '',
      piSays('Checking the tests first.'),
      '',
      ...piToolBlock('$ npm test', ['195 passed', 'Took 4.3s']),
      '',
      piSays('The tests pass. Pushing now.'),
      '',
      ...piInputBox(),
      ...PI_FOOTER,
    ]);

    expect(conversation.turns.map((turn) => turn.role)).toEqual(['person', 'agent']);
    expect(conversation.turns[1]).toEqual({
      role: 'agent',
      text: [
        'The tests come first, then the push.',
        '',
        'Checking the tests first.',
        '',
        '$ npm test',
        '',
        '195 passed',
        'Took 4.3s',
        '',
        'The tests pass. Pushing now.',
      ].join('\n'),
      cut: false,
    });
  });

  test('keeps a question pi raises in the middle of its work', async () => {
    const conversation = await conversationOf(piPane({ agent_status: 'blocked' }), [
      ...piPersonBlock(['Push the branch.']),
      '',
      piThinks('Two branches could be meant here.'),
      '',
      piSpinner(),
      '',
      ...piAsks([
        'Which branch should I push?',
        '',
        '→ fm/pi-grammar',
        '  main',
        '',
        '↑↓ navigate  enter select  escape/ctrl+c cancel',
      ]),
      ...PI_FOOTER,
    ]);

    const said = conversation.turns[1]?.text ?? '';
    expect(conversation.turns.map((turn) => turn.role)).toEqual(['person', 'agent']);
    expect(said).toContain('Two branches could be meant here.');
    expect(said).toContain('Which branch should I push?');
    expect(said).toContain('fm/pi-grammar');
    expect(said).not.toContain('Working...');
  });

  test('reads a pane that is still thinking as the conversation so far', async () => {
    const conversation = await conversationOf(piPane({ agent_status: 'working' }), [
      ...piPersonBlock(['Push the branch.']),
      '',
      piThinks('Checking what is on the branch first.'),
      '',
      piSpinner(),
      '',
      ...piInputBox(),
      ...PI_FOOTER,
    ]);

    expect(conversation.turns).toEqual([
      { role: 'person', text: 'Push the branch.', cut: false },
      { role: 'agent', text: 'Checking what is on the branch first.', cut: false },
    ]);
  });

  test('marks a person turn the top of the screenful cut through', async () => {
    const conversation = await conversationOf(piPane(), [
      ...piPersonBlock(['file and stop.', 'Do NOT run the pipeline.']).slice(1),
      '',
      piSays('Understood.'),
      '',
      ...piInputBox(),
      ...PI_FOOTER,
    ]);

    expect(conversation.turns).toEqual([
      { role: 'person', text: 'file and stop.\nDo NOT run the pipeline.', cut: true },
      { role: 'agent', text: 'Understood.', cut: false },
    ]);
  });

  test('gives a cut turn to pi when the screenful opens mid-answer', async () => {
    const conversation = await conversationOf(piPane(), [
      piSays('} catch (refusal) {'),
      piSays('}'),
      '',
      ...piPersonBlock(['Thanks.']),
      '',
      ...piInputBox(),
      ...PI_FOOTER,
    ]);

    expect(conversation.turns[0]).toEqual({
      role: 'agent',
      text: '} catch (refusal) {\n}',
      cut: true,
    });
  });

  test('marks the first turn cut when herdr has rows above the viewport', async () => {
    const conversation = await conversationOf(
      piPane({
        scroll: { offset_from_bottom: 0, max_offset_from_bottom: 120, viewport_rows: 40 },
      }),
      [
        ...piPersonBlock(['Push the branch.']),
        '',
        piSays('Pushed.'),
        '',
        ...piInputBox(),
        ...PI_FOOTER,
      ],
    );

    expect(conversation.turns.map((turn) => turn.cut)).toEqual([true, false]);
  });

  test('marks an attachment pi echoes back where the path stood in its turn', async () => {
    const attached = join(ATTACHED_IN, '2026-08-10T12-00-00-000Z-3f9a2c1d.jpg');
    const conversation = await conversationOf(piPane(), [
      ...piPersonBlock([`what is in ${attached} then`]),
      '',
      piSays(`The picture at ${attached} is a red square.`),
      '',
      ...piInputBox(),
      ...PI_FOOTER,
    ]);

    expect(conversation.turns).toEqual([
      { role: 'person', text: 'what is in [image] then', cut: false },
      { role: 'agent', text: 'The picture at [image] is a red square.', cut: false },
    ]);
  });

  test('leaves a path that is no attachment of ours standing at full length', async () => {
    const conversation = await conversationOf(piPane(), [
      ...piPersonBlock(['What was in the picture?']),
      '',
      piSays('The one at /home/someone/pictures/red.png is a red square.'),
      '',
      ...piInputBox(),
      ...PI_FOOTER,
    ]);

    expect(conversation.turns[1]?.text).toBe(
      'The one at /home/someone/pictures/red.png is a red square.',
    );
  });

  test('reads the signed and the unsigned pi through the one reader', async () => {
    const screen = [
      ...piPersonBlock(['Push the branch.']),
      '',
      piSays('Pushed.'),
      '',
      ...piInputBox(),
      ...PI_FOOTER,
    ];

    const unsigned = await conversationOf(piPane({ pane_id: 'w3:p1' }), screen);
    const signed = await conversationOf(
      piPane({ pane_id: 'w3:p2', agent: 'Pi', display_agent: 'Pi' }),
      screen,
    );

    expect(unsigned.turns.map((turn) => turn.role)).toEqual(['person', 'agent']);
    expect(signed.turns).toEqual(unsigned.turns);
  });

  test('keeps a rule pi draws inside its own output from swallowing the rest', async () => {
    const conversation = await conversationOf(piPane(), [
      ...piPersonBlock(['Show me the table.']),
      '',
      ...piToolBlock('$ npm run report', ['─'.repeat(PI_WIDTH)]),
      '',
      piSays('| branch | state |'),
      piSays('| fm/pi  | green |'),
    ]);

    expect(conversation.turns.map((turn) => turn.role)).toEqual(['person', 'agent']);
    expect(conversation.turns[1]?.text).toContain('| fm/pi  | green |');
  });

  test("drops pi's status line even when the screenful draws no input area", async () => {
    const conversation = await conversationOf(piPane(), [
      ...piPersonBlock(['Ship it.']),
      '',
      piSays('Shipping.'),
      '',
      ...PI_FOOTER,
    ]);

    expect(conversation.turns).toEqual([
      { role: 'person', text: 'Ship it.', cut: false },
      { role: 'agent', text: 'Shipping.', cut: false },
    ]);
  });

  test('reads a bold tool header pi draws behind a prompt glyph as its own work', async () => {
    const conversation = await conversationOf(piPane(), [
      ...piPersonBlock(['Read it.']),
      '',
      ...piToolBlock('read src/app.ts', ['export const answer = 42;'], PROMPT_ICON),
      '',
      ...piInputBox(),
      ...PI_FOOTER,
    ]);

    expect(conversation.turns.map((turn) => turn.role)).toEqual(['person', 'agent']);
    expect(conversation.turns[1]?.text).toContain('read src/app.ts');
  });

  test('still reads a pi screenful it does not recognise rather than dumping the pane', async () => {
    const conversation = await conversationOf(piPane(), [
      ...piPersonBlock(['Ship it.']),
      '',
      piSays('Shipping.'),
      '',
      `${RESET}${GREY}some layout a later pi draws${RESET}`,
    ]);

    expect(conversation.turns.map((turn) => turn.role)).toEqual(['person', 'agent']);
    expect(conversation.turns[0]?.text).toBe('Ship it.');
    expect(conversation.turns[1]?.text).toContain('Shipping.');
  });
});
