import type { Pane } from '@viu/protocol';

export function needsYouFirst(panes: readonly Pane[]): readonly Pane[] {
  return [...panes].sort((one, other) => urgency(one) - urgency(other));
}

export function labelOf(pane: Pane): string {
  return pane.project ?? pane.id;
}

export function detailOf(pane: Pane): string | null {
  const said = [pane.agent, pane.activity].filter((part) => part !== null);
  return said.length === 0 ? null : said.join(' · ');
}

function urgency(pane: Pane): number {
  return pane.state === 'needs-you' ? 0 : 1;
}
