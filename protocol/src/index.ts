export const PROTOCOL_VERSION = 1;

export type PaneId = string;

export type PaneState = 'needs-you' | 'thinking' | 'idle' | 'dormant' | 'unknown';

export interface Pane {
  readonly id: PaneId;
  readonly project: string | null;
  readonly agent: string | null;
  readonly activity: string | null;
  readonly state: PaneState;
}

export interface Fleet {
  readonly panes: readonly Pane[];
}
