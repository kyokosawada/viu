import { PROTOCOL_VERSION } from '@viu/protocol';

import type { Machine } from '../machine';

import type { Change, Connection, Reach } from './client';
import { httpMiddleman, type Fetching, type Socketing } from './http';

const THE_MACHINE: Machine = { host: 'desk.tail1234.ts.net', port: 8787 };

function answering(status: number, body: unknown): { fetching: Fetching; asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    fetching: (url) => {
      asked.push(url);
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
      );
    },
  };
}

function stalling<T>(signal: AbortSignal): Promise<T> {
  return new Promise((_never, giveUp) => {
    signal.addEventListener('abort', () => {
      const aborted = new Error('Aborted');
      aborted.name = 'AbortError';
      giveUp(aborted);
    });
  });
}

async function givingUp<T>(ask: () => Promise<T>): Promise<T> {
  jest.useFakeTimers();
  try {
    const answering = ask();
    await jest.advanceTimersByTimeAsync(PATIENCE_AND_MORE);
    return await answering;
  } finally {
    jest.useRealTimers();
  }
}

const PATIENCE_AND_MORE = 6000;

const A_LONG_WAIT = 21000;

interface Line {
  readonly changes: readonly Reach<Change>[];
  opens(): void;
  says(update: unknown): void;
  saysRaw(text: string): void;
  drops(why: string): void;
  watch(paneId: string): void;
  watchesNothing(): void;
  puts(): void;
  heardOnIt(): readonly unknown[];
  isClosed(): boolean;
  connectedTo(): string;
}

const nowhere: Socketing = () => ({
  send: () => undefined,
  close: () => undefined,
});

const nothingAsked: Fetching = () => Promise.reject(new Error('nothing was asked over HTTP'));

const stillHeld: Connection[] = [];

afterEach(() => {
  for (const connection of stillHeld.splice(0)) connection.close();
});

function line(): Line {
  const said: unknown[] = [];
  const changes: Reach<Change>[] = [];
  let url = '';
  let heard: Parameters<Socketing>[1] | null = null;
  let closed = false;

  const socketing: Socketing = (asked, told) => {
    url = asked;
    heard = told;
    return {
      send: (text) => {
        said.push(JSON.parse(text));
      },
      close: () => {
        closed = true;
      },
    };
  };

  const connection = httpMiddleman(THE_MACHINE, nothingAsked, socketing).connect((change) => {
    changes.push(change);
  });
  stillHeld.push(connection);

  return {
    changes,
    opens: () => heard?.opened(),
    says: (update) => heard?.received(JSON.stringify(update)),
    saysRaw: (text) => heard?.received(text),
    drops: (why) => heard?.closed(why),
    watch: (paneId) => {
      connection.watch(paneId);
    },
    watchesNothing: () => {
      connection.stopWatching();
    },
    puts: () => {
      connection.close();
    },
    heardOnIt: () => said,
    isClosed: () => closed,
    connectedTo: () => url,
  };
}

function open(): Line {
  const holding = line();
  holding.opens();
  return holding;
}

function told(update: unknown): Reach<Change> | undefined {
  const holding = open();
  holding.says(update);
  return holding.changes.at(-1);
}

describe('greeting the middleman over HTTP', () => {
  test('asks the machine it was given, at the root', async () => {
    const { fetching, asked } = answering(200, {
      viu: 'middleman',
      protocol: PROTOCOL_VERSION,
      herdr: '0.7.5',
    });

    await httpMiddleman(THE_MACHINE, fetching, nowhere).greet();

    expect(asked).toEqual(['http://desk.tail1234.ts.net:8787/']);
  });

  test('reads back the herdr the middleman greeted', async () => {
    const { fetching } = answering(200, {
      viu: 'middleman',
      protocol: PROTOCOL_VERSION,
      herdr: '0.7.5',
    });

    const reach = await httpMiddleman(THE_MACHINE, fetching, nowhere).greet();

    expect(reach).toEqual({
      kind: 'reached',
      got: { viu: 'middleman', protocol: PROTOCOL_VERSION, herdr: '0.7.5' },
    });
  });

  test('calls a middleman speaking another protocol a mismatch, not a connection', async () => {
    const { fetching } = answering(200, {
      viu: 'middleman',
      protocol: PROTOCOL_VERSION + 1,
      herdr: '0.7.5',
    });

    const reach = await httpMiddleman(THE_MACHINE, fetching, nowhere).greet();

    expect(reach.kind).toBe('trouble');
    expect(reach).toMatchObject({ trouble: { kind: 'protocol-mismatch' } });
  });

  test('passes back the trouble the middleman named', async () => {
    const { fetching } = answering(503, {
      kind: 'herdr-unreachable',
      message: 'herdr is not running',
    });

    const reach = await httpMiddleman(THE_MACHINE, fetching, nowhere).greet();

    expect(reach).toEqual({
      kind: 'trouble',
      trouble: { kind: 'herdr-unreachable', message: 'herdr is not running' },
    });
  });

  test('reports a machine that does not answer as unreachable', async () => {
    const fetching: Fetching = () => Promise.reject(new Error('Network request failed'));

    const reach = await httpMiddleman(THE_MACHINE, fetching, nowhere).greet();

    expect(reach).toEqual({ kind: 'unreachable', why: 'Network request failed' });
  });

  test('reports a machine that never answers as unreachable', async () => {
    const fetching: Fetching = (_url, { signal }) => stalling(signal);

    const reach = await givingUp(() => httpMiddleman(THE_MACHINE, fetching, nowhere).greet());

    expect(reach).toEqual({ kind: 'unreachable', why: 'it did not answer in time' });
  });

  test('gives up on a machine that answers and then stalls the body', async () => {
    const fetching: Fetching = (_url, { signal }) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => stalling(signal),
      } as unknown as Response);

    const reach = await givingUp(() => httpMiddleman(THE_MACHINE, fetching, nowhere).greet());

    expect(reach).toEqual({ kind: 'unreachable', why: 'it did not answer in time' });
  });

  test('refuses to take something else at that address for the middleman', async () => {
    const { fetching } = answering(200, { hello: 'i am a router' });

    const reach = await httpMiddleman(THE_MACHINE, fetching, nowhere).greet();

    expect(reach.kind).toBe('not-the-middleman');
  });

  test('refuses a failure Viu has no name for', async () => {
    const { fetching } = answering(500, { kind: 'kaboom', message: 'something went wrong' });

    const reach = await httpMiddleman(THE_MACHINE, fetching, nowhere).greet();

    expect(reach.kind).toBe('not-the-middleman');
  });
});


describe('the connection the app holds open', () => {
  test('holds it open at the machine that was set', () => {
    expect(line().connectedTo()).toBe('ws://desk.tail1234.ts.net:8787/updates');
  });

  test('says nothing down it until it is open', () => {
    const holding = line();

    holding.watchesNothing();

    expect(holding.heardOnIt()).toEqual([]);
  });

  test('reports a connection that goes down as unreachable', () => {
    const holding = open();

    holding.drops('the connection to the machine closed');

    expect(holding.changes).toEqual([
      { kind: 'unreachable', why: 'the connection to the machine closed' },
    ]);
  });

  test('reports a connection that never says anything as unreachable', () => {
    jest.useFakeTimers();
    try {
      const holding = open();

      jest.advanceTimersByTime(PATIENCE_AND_MORE);

      expect(holding.changes).toEqual([
        { kind: 'unreachable', why: 'it did not answer in time' },
      ]);
    } finally {
      jest.useRealTimers();
    }
  });

  test('waits no longer once the machine has said something', () => {
    jest.useFakeTimers();
    try {
      const holding = open();
      holding.says({ kind: 'fleet', fleet: { panes: [] } });

      jest.advanceTimersByTime(PATIENCE_AND_MORE);

      expect(holding.changes).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  test('puts the socket down even after it has reported itself gone', () => {
    const holding = open();
    holding.drops('the connection to the machine failed');

    holding.puts();

    expect(holding.isClosed()).toBe(true);
  });

  test('says nothing more once the connection has gone down', () => {
    const holding = open();
    holding.drops('the connection to the machine closed');

    holding.says({ kind: 'fleet', fleet: { panes: [] } });

    expect(holding.changes).toHaveLength(1);
  });

  test('refuses something on it that Viu has no word for', () => {
    expect(told({ kind: 'weather', sunny: true })?.kind).toBe('not-the-middleman');
  });

  test('refuses something on it that is not the protocol at all', () => {
    const holding = open();

    holding.saysRaw('hello?');

    expect(holding.changes[0]?.kind).toBe('not-the-middleman');
  });
});

describe('watching a pane on the connection', () => {
  const A_PANE = 'w2:p6J';

  test('asks for the pane by the handle it is addressed by', () => {
    const holding = open();

    holding.watch(A_PANE);

    expect(holding.heardOnIt()).toEqual([{ kind: 'watch', paneId: A_PANE }]);
  });

  test('waits for the connection to be open before asking', () => {
    const holding = line();

    holding.watch(A_PANE);
    expect(holding.heardOnIt()).toEqual([]);

    holding.opens();
    expect(holding.heardOnIt()).toEqual([{ kind: 'watch', paneId: A_PANE }]);
  });

  test('does not ask twice for the pane it is already watching', () => {
    const holding = open();

    holding.watch(A_PANE);
    holding.watch(A_PANE);

    expect(holding.heardOnIt()).toEqual([{ kind: 'watch', paneId: A_PANE }]);
  });

  test('says it has stopped watching, once, when it leaves the pane', () => {
    const holding = open();

    holding.watch(A_PANE);
    holding.watchesNothing();
    holding.watchesNothing();

    expect(holding.heardOnIt()).toEqual([
      { kind: 'watch', paneId: A_PANE },
      { kind: 'stop-watching' },
    ]);
  });

  test('puts the connection down when it is done with it', () => {
    const holding = open();

    holding.puts();

    expect(holding.isClosed()).toBe(true);
  });
});

describe('the fleet arriving on the connection', () => {
  const A_PANE = {
    id: 'w2:p6J',
    project: 'viu',
    agent: 'claude',
    activity: 'Reading the fleet',
    state: 'needs-you',
  };

  function fleetOf(panes: readonly unknown[]): Reach<Change> | undefined {
    return told({ kind: 'fleet', fleet: { panes } });
  }

  test('reads back every pane the middleman listed', () => {
    expect(fleetOf([A_PANE])).toEqual({
      kind: 'reached',
      got: { kind: 'fleet', fleet: { panes: [A_PANE] } },
    });
  });

  test('reads a pane that has no project, agent or activity', () => {
    const bare = { id: 'w1:p1', project: null, agent: null, activity: null, state: 'idle' };

    expect(fleetOf([bare])).toEqual({
      kind: 'reached',
      got: { kind: 'fleet', fleet: { panes: [bare] } },
    });
  });

  test('refuses a pane in a state Viu has no word for', () => {
    expect(fleetOf([{ ...A_PANE, state: 'on fire' }])?.kind).toBe('not-the-middleman');
  });

  test('refuses a pane missing something every pane carries', () => {
    const withoutAProject: Record<string, unknown> = { ...A_PANE };
    delete withoutAProject.project;

    expect(fleetOf([withoutAProject])?.kind).toBe('not-the-middleman');
  });

  test('refuses a fleet listing the same handle twice', () => {
    expect(fleetOf([A_PANE, { ...A_PANE, project: 'herdr' }])?.kind).toBe('not-the-middleman');
  });

  test('refuses a pane without the handle it would be addressed by', () => {
    expect(fleetOf([{ ...A_PANE, id: '' }])?.kind).toBe('not-the-middleman');
  });

  test('replaces the fleet it had rather than adding to it', () => {
    const holding = open();

    holding.says({ kind: 'fleet', fleet: { panes: [A_PANE] } });
    holding.says({ kind: 'fleet', fleet: { panes: [] } });

    expect(holding.changes).toEqual([
      { kind: 'reached', got: { kind: 'fleet', fleet: { panes: [A_PANE] } } },
      { kind: 'reached', got: { kind: 'fleet', fleet: { panes: [] } } },
    ]);
  });
});

describe('a conversation arriving on the connection', () => {
  const TURNS = [
    { role: 'agent', text: 'Which one shall I take?', cut: false },
    { role: 'person', text: 'The second one', cut: false },
  ];

  function conversationOf(conversation: unknown): Reach<Change> | undefined {
    return told({ kind: 'conversation', conversation });
  }

  test('reads back every turn the middleman rendered', () => {
    expect(conversationOf({ paneId: 'w2:p6J', turns: TURNS })).toEqual({
      kind: 'reached',
      got: { kind: 'conversation', conversation: { paneId: 'w2:p6J', turns: TURNS } },
    });
  });

  test('reads back a turn the screenful cut off', () => {
    const cut = [{ role: 'pane', text: 'alf a line', cut: true }];

    expect(conversationOf({ paneId: 'w1:p1', turns: cut })).toEqual({
      kind: 'reached',
      got: { kind: 'conversation', conversation: { paneId: 'w1:p1', turns: cut } },
    });
  });

  test('refuses a turn in a role Viu has no word for', () => {
    const conversation = { paneId: 'w2:p6J', turns: [{ role: 'daemon', text: 'hi', cut: false }] };

    expect(conversationOf(conversation)?.kind).toBe('not-the-middleman');
  });

  test('refuses a turn that does not say whether it was cut', () => {
    const conversation = { paneId: 'w2:p6J', turns: [{ role: 'agent', text: 'hello' }] };

    expect(conversationOf(conversation)?.kind).toBe('not-the-middleman');
  });

  test('refuses a conversation that does not say which pane it is of', () => {
    expect(conversationOf({ turns: [] })?.kind).toBe('not-the-middleman');
  });
});

describe('a trouble arriving on the connection', () => {
  test('passes back the trouble the middleman named for a pane that is gone', () => {
    const trouble = {
      kind: 'pane-gone',
      paneId: 'w2:p6J',
      message: 'herdr knows no pane w2:p6J',
    };

    expect(told({ kind: 'trouble', trouble })).toEqual({ kind: 'trouble', trouble });
  });

  test('passes back a trouble about the machine rather than an empty fleet', () => {
    const trouble = { kind: 'herdr-unreachable', message: 'herdr is not running' };

    expect(told({ kind: 'trouble', trouble })).toEqual({ kind: 'trouble', trouble });
  });

  test('refuses a failure Viu has no name for', () => {
    const trouble = { kind: 'kaboom', message: 'something went wrong' };

    expect(told({ kind: 'trouble', trouble })?.kind).toBe('not-the-middleman');
  });
});

describe('sending into a pane over HTTP', () => {
  function posting(status: number, body: unknown): {
    fetching: Fetching;
    asked: string[];
    told: unknown[];
  } {
    const asked: string[] = [];
    const told: unknown[] = [];
    return {
      asked,
      told,
      fetching: (url, options) => {
        asked.push(url);
        told.push({ method: options.method, body: options.body });
        return Promise.resolve(
          new Response(JSON.stringify(body), {
            status,
            headers: { 'content-type': 'application/json' },
          }),
        );
      },
    };
  }

  test('posts the text to that pane, with its handle encoded for a path', async () => {
    const { fetching, asked, told } = posting(200, {
      paneId: 'w2:p6J',
      confidence: 'queued',
      mayBeCut: false,
    });

    await httpMiddleman(THE_MACHINE, fetching, nowhere).send('w2:p6J', 'the second one');

    expect(asked).toEqual(['http://desk.tail1234.ts.net:8787/panes/w2%3Ap6J/send']);
    expect(told).toEqual([{ method: 'POST', body: JSON.stringify({ text: 'the second one' }) }]);
  });

  test('reads back a confirmed send and the state the agent is in now', async () => {
    const { fetching } = posting(200, {
      paneId: 'w2:p6J',
      confidence: 'confirmed',
      state: 'thinking',
    });

    const reach = await httpMiddleman(THE_MACHINE, fetching, nowhere).send('w2:p6J', 'go on');

    expect(reach).toEqual({
      kind: 'reached',
      got: { paneId: 'w2:p6J', confidence: 'confirmed', state: 'thinking' },
    });
  });

  test('reads back a queued send that may have been cut', async () => {
    const { fetching } = posting(200, {
      paneId: 'w1:p1',
      confidence: 'queued',
      mayBeCut: true,
    });

    const reach = await httpMiddleman(THE_MACHINE, fetching, nowhere).send('w1:p1', 'a very long line');

    expect(reach).toEqual({
      kind: 'reached',
      got: { paneId: 'w1:p1', confidence: 'queued', mayBeCut: true },
    });
  });

  test('refuses a confirmed send in a state Viu has no word for', async () => {
    const { fetching } = posting(200, {
      paneId: 'w2:p6J',
      confidence: 'confirmed',
      state: 'pondering',
    });

    const reach = await httpMiddleman(THE_MACHINE, fetching, nowhere).send('w2:p6J', 'go on');

    expect(reach.kind).toBe('not-the-middleman');
  });

  test('refuses a queued send that does not say whether it may have been cut', async () => {
    const { fetching } = posting(200, { paneId: 'w2:p6J', confidence: 'queued' });

    const reach = await httpMiddleman(THE_MACHINE, fetching, nowhere).send('w2:p6J', 'go on');

    expect(reach.kind).toBe('not-the-middleman');
  });

  test('waits longer than a read does, because the middleman waits for the agent', async () => {
    const answering: ((answer: Response) => void)[] = [];
    const fetching: Fetching = (_url, { signal }) =>
      new Promise((answer, giveUp) => {
        answering.push(answer);
        signal.addEventListener('abort', () => {
          const aborted = new Error('Aborted');
          aborted.name = 'AbortError';
          giveUp(aborted);
        });
      });

    jest.useFakeTimers();
    try {
      const sending = httpMiddleman(THE_MACHINE, fetching, nowhere).send('w2:p6J', 'go on');
      await jest.advanceTimersByTimeAsync(PATIENCE_AND_MORE);
      answering[0]?.(
        new Response(JSON.stringify({ paneId: 'w2:p6J', confidence: 'queued', mayBeCut: false }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

      expect(await sending).toEqual({
        kind: 'reached',
        got: { paneId: 'w2:p6J', confidence: 'queued', mayBeCut: false },
      });
    } finally {
      jest.useRealTimers();
    }
  });

  test('gives up on a send the middleman never answers', async () => {
    const fetching: Fetching = (_url, { signal }) => stalling(signal);

    jest.useFakeTimers();
    try {
      const sending = httpMiddleman(THE_MACHINE, fetching, nowhere).send('w2:p6J', 'go on');
      await jest.advanceTimersByTimeAsync(A_LONG_WAIT);

      expect(await sending).toEqual({ kind: 'unreachable', why: 'it did not answer in time' });
    } finally {
      jest.useRealTimers();
    }
  });

  test('passes back the trouble the middleman named for a pane not taking input', async () => {
    const { fetching } = posting(409, {
      kind: 'pane-not-accepting-input',
      paneId: 'w2:p6J',
      message: 'the agent in it stalled on the prompt',
    });

    const reach = await httpMiddleman(THE_MACHINE, fetching, nowhere).send('w2:p6J', 'go on');

    expect(reach).toEqual({
      kind: 'trouble',
      trouble: {
        kind: 'pane-not-accepting-input',
        paneId: 'w2:p6J',
        message: 'the agent in it stalled on the prompt',
      },
    });
  });
});

describe('pressing keys into a pane over HTTP', () => {
  function pressing(status: number, body: unknown): {
    fetching: Fetching;
    asked: string[];
    told: unknown[];
  } {
    const asked: string[] = [];
    const told: unknown[] = [];
    return {
      asked,
      told,
      fetching: (url, options) => {
        asked.push(url);
        told.push({ method: options.method, body: options.body });
        return Promise.resolve(
          status === 204
            ? new Response(null, { status })
            : new Response(JSON.stringify(body), {
                status,
                headers: { 'content-type': 'application/json' },
              }),
        );
      },
    };
  }

  test('posts the keys to that pane, with its handle encoded for a path', async () => {
    const { fetching, asked, told } = pressing(204, null);

    const reach = await httpMiddleman(THE_MACHINE, fetching, nowhere).press('w2:p6J', [
      'down',
      'enter',
    ]);

    expect(asked).toEqual(['http://desk.tail1234.ts.net:8787/panes/w2%3Ap6J/keys']);
    expect(told).toEqual([
      { method: 'POST', body: JSON.stringify({ keys: ['down', 'enter'] }) },
    ]);
    expect(reach.kind).toBe('reached');
  });

  test('takes an answer with nothing in it as the keys having landed', async () => {
    const { fetching } = pressing(204, null);

    const reach = await httpMiddleman(THE_MACHINE, fetching, nowhere).press('w2:p6J', ['ctrl-c']);

    expect(reach).toEqual({ kind: 'reached', got: undefined });
  });

  test('passes back the trouble the middleman named for a gone pane', async () => {
    const { fetching } = pressing(404, {
      kind: 'pane-gone',
      paneId: 'w2:p6J',
      message: 'herdr knows no pane w2:p6J',
    });

    const reach = await httpMiddleman(THE_MACHINE, fetching, nowhere).press('w2:p6J', ['up']);

    expect(reach).toEqual({
      kind: 'trouble',
      trouble: { kind: 'pane-gone', paneId: 'w2:p6J', message: 'herdr knows no pane w2:p6J' },
    });
  });

  test('says nothing answered when the machine cannot be reached', async () => {
    const fetching: Fetching = () => Promise.reject(new Error('Network request failed'));

    const reach = await httpMiddleman(THE_MACHINE, fetching, nowhere).press('w2:p6J', ['escape']);

    expect(reach).toEqual({ kind: 'unreachable', why: 'Network request failed' });
  });
});
