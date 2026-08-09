import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import type { Machine } from './machine';
import type { MachineStore } from './machine-store';
import type { Reach, ReachMachine } from './middleman/client';
import { look } from './ui/look';
import { SetTheMachine } from './ui/SetTheMachine';
import { TheMachine } from './ui/TheMachine';

export interface Wiring {
  readonly reach: ReachMachine;
  readonly machines: MachineStore;
}

export function App({ reach, machines }: Wiring): React.JSX.Element {
  const [machine, setMachine] = useState<Machine | null>(null);
  const [known, setKnown] = useState(false);
  const [changing, setChanging] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [reached, setReached] = useState<Reach | null>(null);

  useEffect(() => {
    let listening = true;
    void machines.remembered().then((remembered) => {
      if (!listening) return;
      setMachine(remembered);
      setKnown(true);
    });
    return () => {
      listening = false;
    };
  }, [machines]);

  useEffect(() => {
    if (machine === null) return;
    let listening = true;
    setReached(null);
    void reach(machine)
      .greet()
      .then((answer) => {
        if (listening) setReached(answer);
      });
    return () => {
      listening = false;
    };
  }, [reach, machine, attempt]);

  const onSet = useCallback(
    (asked: Machine) => {
      void machines.remember(asked).then(() => {
        setMachine(asked);
        setChanging(false);
      });
    },
    [machines],
  );

  if (!known) {
    return (
      <View style={look.screen}>
        <Text style={look.title}>Viu</Text>
      </View>
    );
  }
  if (machine === null || changing) {
    return <SetTheMachine machine={machine} onSet={onSet} />;
  }
  return (
    <TheMachine
      machine={machine}
      reach={reached}
      onTryAgain={() => {
        setAttempt((count) => count + 1);
      }}
      onChangeMachine={() => {
        setChanging(true);
      }}
    />
  );
}
