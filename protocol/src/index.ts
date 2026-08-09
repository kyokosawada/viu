export const PROTOCOL_VERSION = 1;

export type PaneId = string;

export interface Greeting {
  readonly viu: 'middleman';
  readonly protocol: number;
  readonly herdr: string;
}

export const PANE_STATES = ['needs-you', 'thinking', 'idle', 'dormant', 'unknown'] as const;

export type PaneState = (typeof PANE_STATES)[number];

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

export const TURN_ROLES = ['agent', 'person', 'pane'] as const;

export type TurnRole = (typeof TURN_ROLES)[number];

export interface Turn {
  readonly role: TurnRole;
  readonly text: string;
  readonly cut: boolean;
}

export interface Conversation {
  readonly paneId: PaneId;
  readonly turns: readonly Turn[];
}

export const KEYS = [
  'escape',
  'enter',
  'tab',
  'up',
  'down',
  'left',
  'right',
  'backspace',
  'space',
  'ctrl-c',
] as const;

export type Key = (typeof KEYS)[number];

export type Trouble =
  | {
      readonly kind: 'pane-gone';
      readonly paneId: PaneId;
      readonly message: string;
    }
  | {
      readonly kind: 'pane-not-accepting-input';
      readonly paneId: PaneId;
      readonly message: string;
    }
  | {
      readonly kind: 'herdr-unreachable';
      readonly message: string;
    }
  | {
      readonly kind: 'protocol-mismatch';
      readonly message: string;
    }
  | {
      readonly kind: 'herdr-refused';
      readonly message: string;
    }
  | {
      readonly kind: 'unsupported-key';
      readonly key: string;
      readonly message: string;
    }
  | {
      readonly kind: 'malformed-request';
      readonly message: string;
    }
  | {
      readonly kind: 'too-much';
      readonly message: string;
    }
  | {
      readonly kind: 'no-such-endpoint';
      readonly message: string;
    }
  | {
      readonly kind: 'middleman-failed';
      readonly message: string;
    };

export type Update =
  | {
      readonly kind: 'fleet';
      readonly fleet: Fleet;
    }
  | {
      readonly kind: 'conversation';
      readonly conversation: Conversation;
    }
  | {
      readonly kind: 'trouble';
      readonly trouble: Trouble;
    };

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
