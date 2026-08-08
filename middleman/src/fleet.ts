import { basename } from 'node:path';

import type { Fleet, Pane, PaneState } from '@viu/protocol';

import type { HerdrConnection, HerdrPane } from './herdr/connection.js';

export async function readFleet(herdr: HerdrConnection): Promise<Fleet> {
  const panes = paneListOf(await herdr.request('pane.list', {})).map(toPane);
  return { panes: panes.sort(needsYouFirst) };
}

function paneListOf(result: unknown): HerdrPane[] {
  if (!isRecord(result) || !Array.isArray(result.panes)) {
    throw new Error('herdr answered pane.list without a list of panes');
  }
  const listed: unknown[] = result.panes;
  if (!listed.every(isRecord)) {
    throw new Error('herdr listed something that is not a pane');
  }
  return listed;
}

function toPane(herdrPane: HerdrPane): Pane {
  const paneHandle = nonEmptyText(herdrPane.pane_id);
  if (paneHandle === null) {
    throw new Error('herdr listed a pane without the durable handle Viu addresses it by');
  }

  const recognisedAgent = nonEmptyText(herdrPane.agent);
  return {
    id: paneHandle,
    project: projectOf(herdrPane),
    agent:
      recognisedAgent === null
        ? null
        : (nonEmptyText(herdrPane.display_agent) ?? recognisedAgent),
    activity:
      nonEmptyText(herdrPane.terminal_title_stripped) ?? nonEmptyText(herdrPane.terminal_title),
    state: stateOf(herdrPane, recognisedAgent),
  };
}

function stateOf(herdrPane: HerdrPane, recognisedAgent: string | null): PaneState {
  if (recognisedAgent === null) {
    return isRecord(herdrPane.agent_session) ? 'dormant' : 'idle';
  }
  switch (herdrPane.agent_status) {
    case 'blocked':
      return 'needs-you';
    case 'working':
      return 'thinking';
    case 'idle':
    case 'done':
      return 'idle';
    default:
      return 'unknown';
  }
}

function projectOf(herdrPane: HerdrPane): string | null {
  const directory = nonEmptyText(herdrPane.foreground_cwd) ?? nonEmptyText(herdrPane.cwd);
  if (directory === null) return null;
  return nonEmptyText(basename(directory)) ?? directory;
}

function needsYouFirst(one: Pane, other: Pane): number {
  return urgency(one) - urgency(other);
}

function urgency(pane: Pane): number {
  return pane.state === 'needs-you' ? 0 : 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyText(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}
