import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import {
  launchCameraAsync,
  launchImageLibraryAsync,
  requestCameraPermissionsAsync,
  type ImagePickerAsset,
  type ImagePickerOptions,
} from 'expo-image-picker';

import type { From, Picked, Picking } from './picking';

const LONGEST_SIDE = 2000;

const QUALITY = 0.8;

const NOT_ALLOWED_TO_USE_THE_CAMERA = 'Viu was not allowed to use the camera';

const NOTHING_CAME_BACK = 'the picker gave nothing back';

const ONE_IMAGE: ImagePickerOptions = {
  mediaTypes: 'images',
  allowsMultipleSelection: false,
  quality: 1,
};

export function onThePhonePicking(): Picking {
  return {
    async pick(from: From): Promise<Picked> {
      try {
        if (from === 'camera') {
          const allowed = await requestCameraPermissionsAsync();
          if (!allowed.granted) {
            return { kind: 'cut-short', why: NOT_ALLOWED_TO_USE_THE_CAMERA };
          }
        }

        const result =
          from === 'camera'
            ? await launchCameraAsync(ONE_IMAGE)
            : await launchImageLibraryAsync(ONE_IMAGE);
        if (result.canceled) return { kind: 'nothing' };

        const asset = result.assets[0];
        if (asset === undefined) return { kind: 'nothing' };
        return await smallEnoughToSend(asset);
      } catch (error: unknown) {
        return {
          kind: 'cut-short',
          why: error instanceof Error ? error.message : NOTHING_CAME_BACK,
        };
      }
    },
  };
}

async function smallEnoughToSend(asset: ImagePickerAsset): Promise<Picked> {
  const decoded = await ImageManipulator.manipulate(asset.uri).renderAsync();
  const longest = Math.max(decoded.width, decoded.height);
  const rendered =
    longest <= LONGEST_SIDE
      ? decoded
      : await ImageManipulator.manipulate(decoded)
          .resize(
            decoded.width >= decoded.height ? { width: LONGEST_SIDE } : { height: LONGEST_SIDE },
          )
          .renderAsync();

  const asScreenshot = asset.mimeType === 'image/png';
  const saved = await rendered.saveAsync({
    format: asScreenshot ? SaveFormat.PNG : SaveFormat.JPEG,
    compress: QUALITY,
    base64: true,
  });
  if (saved.base64 === undefined) return { kind: 'cut-short', why: NOTHING_CAME_BACK };
  return {
    kind: 'picked',
    picture: { format: asScreenshot ? 'png' : 'jpeg', base64: saved.base64 },
  };
}
