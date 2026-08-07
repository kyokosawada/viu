# React Native with Expo, Android only

The same slice was built for real in four candidates - React Native, Compose Multiplatform,
Flutter, and native Kotlin - and React Native with Expo won. Compose Multiplatform was the
runner-up. Flutter was eliminated on its own build output, which warned that future Flutter
versions will fail to build apps using the speech plugin Viu would depend on.

Android only: there is no Mac and no Apple developer account, so iOS work cannot be built or
shipped. Cross-platform insurance still counted in the comparison, so the door is not nailed shut,
but no iOS work is charted.

## Consequences

Over-the-air updates make JavaScript changes reach the phone in about a second with no reinstall,
while native or configuration changes force a full rebuild and fail silently if skipped. That
asymmetry is worth remembering whenever choosing where a piece of logic should live.
