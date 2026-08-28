import { Text, View } from 'react-native';

import type { PaneState } from '@viu/protocol';

import { useLook } from './look';
import { colourFor, wordFor } from './states';

export function StateChip({ state }: { readonly state: PaneState }): React.JSX.Element {
  const { colour, look } = useLook();
  const drawn = colourFor(state, colour);

  return (
    <View style={[look.chip, { borderColor: drawn }]}>
      <Text style={[look.chipWord, { color: drawn }]}>{wordFor(state)}</Text>
    </View>
  );
}
