import type { Greeting, Trouble } from '@viu/protocol';

import type { Machine } from '../machine';

export type Reach =
  | { readonly kind: 'reached'; readonly greeting: Greeting }
  | { readonly kind: 'unreachable'; readonly why: string }
  | { readonly kind: 'not-the-middleman'; readonly why: string }
  | { readonly kind: 'trouble'; readonly trouble: Trouble };

export interface MiddlemanClient {
  greet(): Promise<Reach>;
}

export type ReachMachine = (machine: Machine) => MiddlemanClient;
