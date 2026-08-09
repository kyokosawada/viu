import { KEYS, type PaneId } from '@viu/protocol';

export class HerdrNotRunning extends Error {
  readonly socketPath: string;

  constructor(socketPath: string, detail: string) {
    super(`herdr does not appear to be running: ${detail} (${socketPath})`);
    this.name = 'HerdrNotRunning';
    this.socketPath = socketPath;
  }
}

export class HerdrConnectionLost extends Error {
  readonly socketPath: string;

  constructor(socketPath: string, detail: string) {
    super(`the connection to herdr ${detail} (${socketPath})`);
    this.name = 'HerdrConnectionLost';
    this.socketPath = socketPath;
  }
}

export class HerdrProtocolMismatch extends Error {
  readonly understood: number;
  readonly spoken: number | null;

  constructor(understood: number, spoken: number | null, herdrVersion: string) {
    super(
      `this middleman understands herdr protocol ${understood}, and herdr ${herdrVersion} speaks ` +
        `${spoken ?? 'no protocol version it will name'}. Refusing to start rather than ` +
        'behaving strangely against a protocol Viu has not been read against.',
    );
    this.name = 'HerdrProtocolMismatch';
    this.understood = understood;
    this.spoken = spoken;
  }
}

export class NoTailnet extends Error {
  constructor() {
    super(
      'no tailnet address to bind to: looked for an interface named tailscale* carrying an ' +
        'address in 100.64.0.0/10 or fd7a:115c:a1e0::/48, and found none. Is Tailscale up?',
    );
    this.name = 'NoTailnet';
  }
}

export class NotTheTailnet extends Error {
  readonly address: string;

  constructor(address: string) {
    super(
      `refusing to listen on ${address}: that is every interface this machine has, and being on ` +
        'the tailnet is the whole of the authorisation. See ADR 0003.',
    );
    this.name = 'NotTheTailnet';
    this.address = address;
  }
}

export class PaneGone extends Error {
  readonly paneId: PaneId;

  constructor(paneId: PaneId) {
    super(`pane ${paneId} is no longer in the fleet`);
    this.name = 'PaneGone';
    this.paneId = paneId;
  }
}

export class PaneNotAcceptingInput extends Error {
  readonly paneId: PaneId;

  constructor(paneId: PaneId, detail: string) {
    super(`pane ${paneId} is still in the fleet and would not take the input: ${detail}`);
    this.name = 'PaneNotAcceptingInput';
    this.paneId = paneId;
  }
}

export class Malformed extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Malformed';
  }
}

export class TooMuch extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TooMuch';
  }
}

export class UnsupportedKey extends Error {
  readonly key: string;

  constructor(key: string) {
    super(`there is no key named ${key} - the keys Viu can send are ${KEYS.join(', ')}`);
    this.name = 'UnsupportedKey';
    this.key = key;
  }
}
