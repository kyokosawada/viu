import type { Image } from '@viu/protocol';

export type From = 'library' | 'camera';

export type Picked =
  | { readonly kind: 'picked'; readonly picture: Image }
  | { readonly kind: 'nothing' }
  | { readonly kind: 'cut-short'; readonly why: string };

export interface Picking {
  pick(from: From): Promise<Picked>;
}

const NOTHING_TO_PICK_WITH = 'this phone has nothing to pick an image with';

export function noPicking(): Picking {
  return {
    pick: () => Promise.resolve({ kind: 'cut-short', why: NOTHING_TO_PICK_WITH }),
  };
}
