import type { PaneId } from '@viu/protocol';

export class PaneGone extends Error {
  readonly paneId: PaneId;

  constructor(paneId: PaneId) {
    super(`pane ${paneId} is no longer in the fleet`);
    this.name = 'PaneGone';
    this.paneId = paneId;
  }
}
