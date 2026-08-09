import type { Fleet, Greeting, Trouble } from '@viu/protocol';

import type { Machine } from '../machine';

export type Reach<Got> =
  | { readonly kind: 'reached'; readonly got: Got }
  | { readonly kind: 'unreachable'; readonly why: string }
  | { readonly kind: 'not-the-middleman'; readonly why: string }
  | { readonly kind: 'trouble'; readonly trouble: Trouble };

export type Missed = Exclude<Reach<never>, { readonly kind: 'reached' }>;

export interface MiddlemanClient {
  greet(): Promise<Reach<Greeting>>;
  fleet(): Promise<Reach<Fleet>>;
}

export type MiddlemanAt = (machine: Machine) => MiddlemanClient;
