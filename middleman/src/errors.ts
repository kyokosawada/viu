import { KEYS, type PaneId } from '@viu/protocol';

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
