import { basename } from 'node:path';

import type { Fleet, Pane, PaneState } from '@viu/protocol';

import type { HerdrConnection } from './herdr/connection.js';

export async function readFleet(herdr: HerdrConnection): Promise<Fleet> {
  const panes = paneListOf(await herdr.request('pane.list', {})).flatMap(toPane);
  return { panes: panes.sort(needsYouFirst) };
}

function paneListOf(result: unknown): Record<string, unknown>[] {
  if (!isRecord(result) || !Array.isArray(result.panes)) {
    throw new Error('herdr answered pane.list without a list of panes');
  }
  return result.panes.filter(isRecord);
}

function toPane(herdrPane: Record<string, unknown>): Pane[] {
  const paneHandle = text(herdrPane.pane_id);
  if (paneHandle === null) return [];

  const recognisedAgent = text(herdrPane.agent);
  return [
    {
      id: paneHandle,
      project: projectOf(herdrPane),
      agent:
        recognisedAgent === null ? null : (text(herdrPane.display_agent) ?? recognisedAgent),
      activity: text(herdrPane.terminal_title_stripped) ?? text(herdrPane.terminal_title),
      state: stateOf(herdrPane, recognisedAgent),
    },
  ];
}

function stateOf(herdrPane: Record<string, unknown>, recognisedAgent: string | null): PaneState {
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

function projectOf(herdrPane: Record<string, unknown>): string | null {
  const directory = text(herdrPane.foreground_cwd) ?? text(herdrPane.cwd);
  if (directory === null) return null;
  return text(basename(directory)) ?? directory;
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

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}
