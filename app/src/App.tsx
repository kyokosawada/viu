import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import type { Machine } from './machine';
import type { MachineStore } from './machine-store';
import type { MiddlemanAt, Reach } from './middleman/client';
import { nothingAnswered } from './middleman/trouble';
import { look } from './ui/look';
import { SetTheMachine } from './ui/SetTheMachine';
import { TheMachine } from './ui/TheMachine';

export interface Wiring {
  readonly middleman: MiddlemanAt;
  readonly machines: MachineStore;
}

interface Reaching {
  readonly machine: Machine;
  readonly attempt: number;
}

export function App({ middleman, machines }: Wiring): React.JSX.Element {
  const [reaching, setReaching] = useState<Reaching | null>(null);
  const [known, setKnown] = useState(false);
  const [changing, setChanging] = useState(false);
  const [answered, setAnswered] = useState<{ to: Reaching; reach: Reach } | null>(null);
  const reached = answered !== null && answered.to === reaching ? answered.reach : null;

  useEffect(() => {
    let live = true;
    const settle = (machine: Machine | null) => {
      if (!live) return;
      setReaching(machine === null ? null : { machine, attempt: 0 });
      setKnown(true);
    };
    void machines.remembered().then(settle, () => {
      settle(null);
    });
    return () => {
      live = false;
    };
  }, [machines]);

  useEffect(() => {
    if (reaching === null) return;
    let live = true;
    const settle = (reach: Reach) => {
      if (live) setAnswered({ to: reaching, reach });
    };
    void middleman(reaching.machine)
      .greet()
      .then(settle, (error: unknown) => {
        settle(nothingAnswered(error));
      });
    return () => {
      live = false;
    };
  }, [middleman, reaching]);

  const set = (asked: Machine) => {
    const reach = () => {
      setReaching({ machine: asked, attempt: 0 });
      setChanging(false);
    };
    void machines.remember(asked).then(reach, reach);
  };

  if (!known) {
    return (
      <View style={[look.fill, look.screen]}>
        <Text style={look.title}>Viu</Text>
      </View>
    );
  }
  if (reaching === null || changing) {
    return (
      <SetTheMachine
        machine={reaching?.machine ?? null}
        onSet={set}
        onKeep={
          reaching === null
            ? null
            : () => {
                setChanging(false);
              }
        }
      />
    );
  }
  return (
    <TheMachine
      machine={reaching.machine}
      reach={reached}
      onTryAgain={() => {
        setReaching({ machine: reaching.machine, attempt: reaching.attempt + 1 });
      }}
      onChangeMachine={() => {
        setChanging(true);
      }}
    />
  );
}
