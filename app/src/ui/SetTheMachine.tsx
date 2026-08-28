import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { DEFAULT_PORT, machineFrom, type Machine } from '../machine';

import { useLook } from './look';
import { Tap } from './Tap';

interface Asking {
  readonly machine: Machine | null;
  readonly onSet: (machine: Machine) => void;
  readonly onKeep: (() => void) | null;
}

export function SetTheMachine({ machine, onSet, onKeep }: Asking): React.JSX.Element {
  const { colour, look } = useLook();
  const [host, setHost] = useState(machine?.host ?? '');
  const [port, setPort] = useState(machine === null ? '' : String(machine.port));
  const asked = machineFrom(host, port);

  return (
    <ScrollView
      style={look.page}
      contentContainerStyle={look.screen}
      keyboardShouldPersistTaps="handled"
    >
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
          placeholderTextColor={colour.muted}
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
          placeholderTextColor={colour.muted}
          inputMode="numeric"
        />
      </View>

      <Tap
        style={[look.button, asked === null && { backgroundColor: colour.line }]}
        disabled={asked === null}
        onPress={() => {
          if (asked !== null) onSet(asked);
        }}
      >
        <Text style={look.buttonText}>Reach the machine</Text>
      </Tap>

      {onKeep !== null && (
        <Tap style={look.quiet} onPress={onKeep}>
          <Text style={look.quietText}>Keep the machine I had</Text>
        </Tap>
      )}
    </ScrollView>
  );
}
