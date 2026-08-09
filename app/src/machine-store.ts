import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_PORT, type Machine } from './machine';

export interface MachineStore {
  remembered(): Promise<Machine | null>;
  remember(machine: Machine): Promise<void>;
}

const KEY = 'viu.machine';

export function machineOnThePhone(): MachineStore {
  return {
    async remembered(): Promise<Machine | null> {
      const written = await AsyncStorage.getItem(KEY);
      return written === null ? null : machineIn(written);
    },

    async remember(machine: Machine): Promise<void> {
      await AsyncStorage.setItem(KEY, JSON.stringify(machine));
    },
  };
}

function machineIn(written: string): Machine | null {
  let read: unknown;
  try {
    read = JSON.parse(written);
  } catch {
    return null;
  }
  if (typeof read !== 'object' || read === null) return null;
  const { host, port } = read as Record<string, unknown>;
  if (typeof host !== 'string' || host === '') return null;
  return { host, port: typeof port === 'number' ? port : DEFAULT_PORT };
}
