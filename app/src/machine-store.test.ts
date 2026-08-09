import AsyncStorage from '@react-native-async-storage/async-storage';

import { machineOnThePhone } from './machine-store';

const KEY = 'viu.machine';

describe('the machine kept on the phone', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('remembers nothing until a machine has been set', async () => {
    await expect(machineOnThePhone().remembered()).resolves.toBeNull();
  });

  test('gives back the machine it was told to remember', async () => {
    const machines = machineOnThePhone();

    await machines.remember({ host: 'desk.tail1234.ts.net', port: 9000 });

    await expect(machines.remembered()).resolves.toEqual({
      host: 'desk.tail1234.ts.net',
      port: 9000,
    });
  });

  test('forgets what was written that is not a machine', async () => {
    const machines = machineOnThePhone();

    for (const written of ['', 'not json', '[]', '{"host":"desk one","port":8787}']) {
      await AsyncStorage.setItem(KEY, written);
      await expect(machines.remembered()).resolves.toBeNull();
    }
  });

  test('forgets a port that is not a port', async () => {
    const machines = machineOnThePhone();

    await AsyncStorage.setItem(KEY, JSON.stringify({ host: 'desk.ts.net', port: 0 }));

    await expect(machines.remembered()).resolves.toBeNull();
  });
});
