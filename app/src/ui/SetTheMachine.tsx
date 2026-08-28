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

const A_NAME_VIU_CAN_USE = 'desk';

export function SetTheMachine({ machine, onSet, onKeep }: Asking): React.JSX.Element {
  const { colour, look } = useLook();
  const [host, setHost] = useState(machine?.host ?? '');
  const [port, setPort] = useState(machine === null ? '' : String(machine.port));
  const asked = machineFrom(host, port);
  const namedWrong = host.trim() !== '' && machineFrom(host, '') === null;
  const portWrong = machineFrom(A_NAME_VIU_CAN_USE, port) === null;

  return (
    <ScrollView
      style={look.page}
      contentContainerStyle={[look.screen, look.fromTheTop]}
      keyboardShouldPersistTaps="handled"
    >
      <View>
        <Text style={look.label}>Viu</Text>
        <Text accessibilityRole="header" style={look.title}>
          {machine === null ? 'No machine set' : 'Change the machine'}
        </Text>
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
        <Text style={[look.hint, namedWrong && look.wrong]}>
          {namedWrong
            ? 'A machine is named without spaces in it.'
            : 'Its tailnet name, or its tailnet address.'}
        </Text>
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
        <Text style={[look.hint, portWrong && look.wrong]}>
          {portWrong
            ? 'A port is a whole number from 1 to 65535.'
            : `The middleman listens on ${String(DEFAULT_PORT)} unless it was told otherwise.`}
        </Text>
      </View>

      <View style={look.fill} />

      <View style={look.bench}>
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
      </View>
    </ScrollView>
  );
}
