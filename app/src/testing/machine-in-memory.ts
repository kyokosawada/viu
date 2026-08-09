import type { Machine } from '../machine';
import type { MachineStore } from '../machine-store';

export function machineInMemory(known: Machine | null = null): MachineStore {
  let machine = known;
  return {
    remembered: () => Promise.resolve(machine),
    remember: (asked: Machine) => {
      machine = asked;
      return Promise.resolve();
    },
  };
}
