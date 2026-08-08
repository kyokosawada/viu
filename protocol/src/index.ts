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

export type TurnRole = 'agent' | 'person' | 'pane';

export interface Turn {
  readonly role: TurnRole;
  readonly text: string;
  readonly cut: boolean;
}

export interface Conversation {
  readonly paneId: PaneId;
  readonly turns: readonly Turn[];
}

export type Sent =
  | {
      readonly paneId: PaneId;
      readonly confidence: 'confirmed';
      readonly state: PaneState;
    }
  | {
      readonly paneId: PaneId;
      readonly confidence: 'queued';
      readonly mayBeCut: boolean;
    };
