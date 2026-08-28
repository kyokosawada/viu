import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type PressableStateCallbackType,
} from 'react-native';

import { useLook } from './look';

const CLIPPED = StyleSheet.create({
  to: { overflow: 'hidden' },
});

export function Tap({ android_ripple, style, ...pressing }: PressableProps): React.JSX.Element {
  const { colour } = useLook();

  return (
    <Pressable
      android_ripple={android_ripple ?? { color: colour.line }}
      style={
        typeof style === 'function'
          ? (state: PressableStateCallbackType) => [CLIPPED.to, style(state)]
          : [CLIPPED.to, style]
      }
      {...pressing}
    />
  );
}
