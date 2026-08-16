import type { Greeting, Key, PaneId, Send, Sent, Trouble, Update } from '@viu/protocol';

import type { Machine } from '../machine';

export type Reach<Got> =
  | { readonly kind: 'reached'; readonly got: Got }
  | { readonly kind: 'unreachable'; readonly why: string }
  | { readonly kind: 'not-the-middleman'; readonly why: string }
  | { readonly kind: 'trouble'; readonly trouble: Trouble };

export type Missed = Exclude<Reach<never>, { readonly kind: 'reached' }>;

export type Change = Exclude<Update, { readonly kind: 'trouble' }>;

export type Receive = (change: Reach<Change>) => void;

export interface Connection {
  watch(paneId: PaneId): void;
  stopWatching(): void;
  close(): void;
}

export interface MiddlemanClient {
  greet(): Promise<Reach<Greeting>>;
  connect(receive: Receive): Connection;
  send(paneId: PaneId, sending: Send): Promise<Reach<Sent>>;
  press(paneId: PaneId, keys: readonly Key[]): Promise<Reach<void>>;
}

export type MiddlemanAt = (machine: Machine) => MiddlemanClient;
