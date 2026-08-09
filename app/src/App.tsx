import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import type { Conversation, Fleet, Greeting, Pane, PaneId } from '@viu/protocol';

import { noDictation, type Dictation } from './dictation/dictation';
import type { Machine } from './machine';
import type { MachineStore } from './machine-store';
import type { MiddlemanAt, Missed, Reach } from './middleman/client';
import { nothingAnswered } from './middleman/trouble';
import { TheFleet } from './ui/TheFleet';
import { look } from './ui/look';
import { SetTheMachine } from './ui/SetTheMachine';
import { TheMachine } from './ui/TheMachine';
import { ThePane } from './ui/ThePane';

export interface Wiring {
  readonly middleman: MiddlemanAt;
  readonly machines: MachineStore;
  readonly dictation?: Dictation;
}

interface Reaching {
  readonly machine: Machine;
  readonly attempt: number;
}

const NOTHING_TO_DICTATE_WITH = noDictation();

export function App({
  middleman,
  machines,
  dictation = NOTHING_TO_DICTATE_WITH,
}: Wiring): React.JSX.Element {
  const [reaching, setReaching] = useState<Reaching | null>(null);
  const [known, setKnown] = useState(false);
  const [changing, setChanging] = useState(false);
  const [answered, setAnswered] = useState<{ to: Reaching; reach: Reach<Greeting> } | null>(null);
  const [read, setRead] = useState<{ to: Reaching; reach: Reach<Fleet> } | null>(null);
  const [opened, setOpened] = useState<PaneId | null>(null);
  const [heard, setHeard] = useState<{
    to: Reaching;
    paneId: PaneId;
    reach: Reach<Conversation>;
  } | null>(null);
  const reached = answered !== null && answered.to === reaching ? answered.reach : null;
  const greeted: Greeting | null = reached?.kind === 'reached' ? reached.got : null;
  const fleet = read !== null && read.to === reaching ? read.reach : null;
  const conversation =
    heard !== null && heard.to === reaching && heard.paneId === opened ? heard.reach : null;

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
    const settle = (reach: Reach<Greeting>) => {
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

  useEffect(() => {
    if (reaching === null || greeted === null) return;
    let live = true;
    const settle = (reach: Reach<Fleet>) => {
      if (live) setRead({ to: reaching, reach });
    };
    void middleman(reaching.machine)
      .fleet()
      .then(settle, (error: unknown) => {
        settle(nothingAnswered(error));
      });
    return () => {
      live = false;
    };
  }, [middleman, reaching, greeted]);

  useEffect(() => {
    if (reaching === null || opened === null) return;
    let live = true;
    const settle = (reach: Reach<Conversation>) => {
      if (live) setHeard({ to: reaching, paneId: opened, reach });
    };
    void middleman(reaching.machine)
      .conversation(opened)
      .then(settle, (error: unknown) => {
        settle(nothingAnswered(error));
      });
    return () => {
      live = false;
    };
  }, [middleman, reaching, opened]);

  const set = (asked: Machine) => {
    const reach = () => {
      setReaching({ machine: asked, attempt: 0 });
      setOpened(null);
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
                setReaching({ machine: reaching.machine, attempt: reaching.attempt + 1 });
                setOpened(null);
                setChanging(false);
              }
        }
      />
    );
  }

  const tryAgain = () => {
    setReaching({ machine: reaching.machine, attempt: reaching.attempt + 1 });
  };
  const changeMachine = () => {
    setChanging(true);
  };

  if (greeted !== null && (fleet === null || fleet.kind === 'reached')) {
    if (opened !== null) {
      return (
        <ThePane
          paneId={opened}
          pane={paneIn(fleet === null ? null : fleet.got, opened)}
          conversation={conversation?.kind === 'reached' ? conversation.got : null}
          missed={missed(conversation)}
          dictation={dictation}
          onSend={(text) => middleman(reaching.machine).send(opened, text)}
          onBack={() => {
            setOpened(null);
          }}
        />
      );
    }
    return (
      <TheFleet
        machine={reaching.machine}
        herdr={greeted.herdr}
        fleet={fleet === null ? null : fleet.got}
        onOpen={setOpened}
        onChangeMachine={changeMachine}
      />
    );
  }
  return (
    <TheMachine
      machine={reaching.machine}
      reach={missed(fleet) ?? missed(reached)}
      onTryAgain={tryAgain}
      onChangeMachine={changeMachine}
    />
  );
}

function paneIn(fleet: Fleet | null, paneId: PaneId): Pane | null {
  return fleet?.panes.find((pane) => pane.id === paneId) ?? null;
}

function missed<Got>(reach: Reach<Got> | null): Missed | null {
  return reach === null || reach.kind === 'reached' ? null : reach;
}
