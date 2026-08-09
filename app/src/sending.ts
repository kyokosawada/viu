import type { Pane, PaneState, Sent } from '@viu/protocol';

export interface Guarantee {
  readonly said: string;
  readonly detail: string;
  readonly warning: string | null;
}

const AFTERWARDS = {
  'needs-you': 'it needs you',
  thinking: 'it is thinking',
  idle: 'it is idle',
  dormant: 'it is dormant',
  unknown: 'Viu cannot tell what it is doing',
} satisfies Record<PaneState, string>;

const A_LONG_LINE = 'That line is long, and a shell may have cut it.';

export function guaranteeOf(sent: Sent, pane: Pane | null): Guarantee {
  if (sent.confidence === 'confirmed') {
    return {
      said: 'Confirmed',
      detail: `The agent picked it up. Now ${AFTERWARDS[sent.state]}.`,
      warning: null,
    };
  }
  const warning = sent.mayBeCut ? A_LONG_LINE : null;
  if (pane === null) {
    return { said: 'Sent', detail: 'Nothing was seen to take it.', warning };
  }
  if (pane.agent === null) {
    return { said: 'Sent', detail: 'There is no agent here to confirm it.', warning };
  }
  return {
    said: 'Queued',
    detail:
      pane.state === 'thinking'
        ? 'The agent is mid-turn. It has not been seen to take it.'
        : 'The agent was not seen to take it.',
    warning,
  };
}
