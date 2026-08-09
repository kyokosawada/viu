import type { Pane } from '@viu/protocol';

export function needsYouFirst(panes: readonly Pane[]): readonly Pane[] {
  return [...panes].sort((one, other) => urgency(one) - urgency(other));
}

export function labelOf(pane: Pane): string {
  return pane.project ?? pane.id;
}

function urgency(pane: Pane): number {
  return pane.state === 'needs-you' ? 0 : 1;
}
