import type { Fleet } from '@viu/protocol';

import { readFleet } from './fleet.js';
import type { HerdrConnection } from './herdr/connection.js';

export interface Middleman {
  fleet(): Promise<Fleet>;
}

export function createMiddleman(herdr: HerdrConnection): Middleman {
  return {
    fleet: () => readFleet(herdr),
  };
}
