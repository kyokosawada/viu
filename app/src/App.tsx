import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import type { Conversation, Fleet, Greeting, Pane, PaneId } from '@viu/protocol';

import { noDictation, type Dictation } from './dictation/dictation';
import { needingYouElsewhere } from './fleet';
import type { Machine } from './machine';
import type { MachineStore } from './machine-store';
import type { Change, Connection, MiddlemanAt, Missed, Reach } from './middleman/client';
import { aboutAPane, nothingAnswered } from './middleman/trouble';
import { ALWAYS_IN_HAND, type Phone } from './phone';
import { TheFleet } from './ui/TheFleet';
import { look } from './ui/look';
import { SetTheMachine } from './ui/SetTheMachine';
import { TheMachine } from './ui/TheMachine';
import { ThePane } from './ui/ThePane';

export interface Wiring {
  readonly middleman: MiddlemanAt;
  readonly machines: MachineStore;
  readonly dictation?: Dictation;
  readonly phone?: Phone;
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
  phone = ALWAYS_IN_HAND,
}: Wiring): React.JSX.Element {
  const [reaching, setReaching] = useState<Reaching | null>(null);
  const [known, setKnown] = useState(false);
  const [changing, setChanging] = useState(false);
  const [answered, setAnswered] = useState<{ to: Reaching; reach: Reach<Greeting> } | null>(null);
  const [read, setRead] = useState<{ to: Reaching; reach: Reach<Fleet> } | null>(null);
  const [opened, setOpened] = useState<PaneId | null>(null);
  const [inHand, setInHand] = useState(() => phone.inHand());
  const connection = useRef<Connection | null>(null);
  const watching = useRef<PaneId | null>(null);
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

  useEffect(() => phone.changes(setInHand), [phone]);

  useEffect(() => {
    if (reaching === null || greeted === null || !inHand) return;
    let live = true;
    const held = middleman(reaching.machine).connect((change: Reach<Change>) => {
      if (!live) return;
      if (change.kind === 'reached') {
        if (change.got.kind === 'fleet') {
          setRead({ to: reaching, reach: { kind: 'reached', got: change.got.fleet } });
        } else {
          const conversation = change.got.conversation;
          setHeard({
            to: reaching,
            paneId: conversation.paneId,
            reach: { kind: 'reached', got: conversation },
          });
        }
        return;
      }
      if (change.kind === 'trouble' && aboutAPane(change.trouble)) {
        setHeard({ to: reaching, paneId: change.trouble.paneId, reach: change });
        return;
      }
      setRead({ to: reaching, reach: change });
    });
    connection.current = held;
    if (watching.current !== null) held.watch(watching.current);
    return () => {
      live = false;
      connection.current = null;
      held.close();
    };
  }, [middleman, reaching, greeted, inHand]);

  const open = (paneId: PaneId | null) => {
    setOpened(paneId);
    setHeard(null);
    watching.current = paneId;
    if (paneId === null) connection.current?.stopWatching();
    else connection.current?.watch(paneId);
  };

  const set = (asked: Machine) => {
    const reach = () => {
      setReaching({ machine: asked, attempt: 0 });
      open(null);
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
                open(null);
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
          elsewhere={needingYouElsewhere(fleet === null ? null : fleet.got, opened)}
          dictation={dictation}
          onOpen={open}
          onSend={(text) => middleman(reaching.machine).send(opened, text)}
          onBack={() => {
            open(null);
          }}
        />
      );
    }
    return (
      <TheFleet
        machine={reaching.machine}
        herdr={greeted.herdr}
        fleet={fleet === null ? null : fleet.got}
        onOpen={open}
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
