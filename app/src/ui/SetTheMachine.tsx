import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { DEFAULT_PORT, machineFrom, type Machine } from '../machine';

import { colour, look } from './look';

interface Asking {
  readonly machine: Machine | null;
  readonly onSet: (machine: Machine) => void;
}

export function SetTheMachine({ machine, onSet }: Asking): React.JSX.Element {
  const [host, setHost] = useState(machine?.host ?? '');
  const [port, setPort] = useState(machine === null ? '' : String(machine.port));
  const asked = machineFrom(host, port);

  return (
    <View style={look.screen}>
      <View>
        <Text style={look.title}>Viu</Text>
        <Text style={look.said}>Name the machine on your tailnet that runs the middleman.</Text>
      </View>

      <View>
        <Text style={look.label}>Machine</Text>
        <TextInput
          style={look.field}
          value={host}
          onChangeText={setHost}
          placeholder="my-machine.tail1234.ts.net"
          placeholderTextColor={colour.faded}
          autoCapitalize="none"
          autoCorrect={false}
          inputMode="url"
        />
      </View>

      <View>
        <Text style={look.label}>Port</Text>
        <TextInput
          style={look.field}
          value={port}
          onChangeText={setPort}
          placeholder={String(DEFAULT_PORT)}
          placeholderTextColor={colour.faded}
          inputMode="numeric"
        />
      </View>

      <Pressable
        style={[look.button, asked === null && { backgroundColor: colour.edge }]}
        disabled={asked === null}
        onPress={() => {
          if (asked !== null) onSet(asked);
        }}
      >
        <Text style={look.buttonText}>Reach the machine</Text>
      </Pressable>
    </View>
  );
}
