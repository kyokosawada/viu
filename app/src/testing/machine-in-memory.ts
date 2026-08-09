import type { Machine } from '../machine';
import type { MachineStore } from '../machine-store';

export interface FakeMachineStore extends MachineStore {
  breaks(why: string): void;
}

export function machineInMemory(known: Machine | null = null): FakeMachineStore {
  let machine = known;
  let broken: string | null = null;

  return {
    remembered: () => (broken === null ? Promise.resolve(machine) : Promise.reject(new Error(broken))),

    remember: (asked: Machine) => {
      if (broken !== null) return Promise.reject(new Error(broken));
      machine = asked;
      return Promise.resolve();
    },

    breaks(why: string): void {
      broken = why;
    },
  };
}
