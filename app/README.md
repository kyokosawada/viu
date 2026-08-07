# app

Reserved space for the phone client. There is no app here yet, and nothing in this directory should
be built until the ticket that builds it.

It will be React Native with Expo, Android only - see
[ADR 0002](../docs/adr/0002-react-native-expo-android-only.md). It reaches the protocol types by
importing `@viu/protocol`, which lives beside it in this repo; see
[`protocol/README.md`](../protocol/README.md) for how that resolves under Metro and what the
fallback is if it ever does not.
