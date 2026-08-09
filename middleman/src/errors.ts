import { KEYS, type PaneId } from '@viu/protocol';

export class NoTailnet extends Error {
  constructor() {
    super(
      'no tailnet address to bind to: looked for an interface named tailscale* carrying an ' +
        'address in 100.64.0.0/10 or fd7a:115c:a1e0::/48, and found none. Is Tailscale up?',
    );
    this.name = 'NoTailnet';
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

export class UnsupportedKey extends Error {
  readonly key: string;

  constructor(key: string) {
    super(`there is no key named ${key} - the keys Viu can send are ${KEYS.join(', ')}`);
    this.name = 'UnsupportedKey';
    this.key = key;
  }
}
