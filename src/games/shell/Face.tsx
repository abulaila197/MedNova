import { Image } from 'expo-image';

import { characterOf } from './characters';

const FACES: Record<string, number> = {
  yazan: require('../../../assets/characters/yazan.png'),
  yara: require('../../../assets/characters/yara.png'),
  omar: require('../../../assets/characters/omar.png'),
  layla: require('../../../assets/characters/layla.png'),
  atlas: require('../../../assets/characters/atlas.png'),
  nova: require('../../../assets/characters/nova.png'),
  bolt: require('../../../assets/characters/bolt.png'),
  iris: require('../../../assets/characters/iris.png'),
  pip: require('../../../assets/characters/pip.png'),
  // Nova Mechs, won from daily chests.
  sprocket: require('../../../assets/mechs/sprocket-face.webp'),
  kit: require('../../../assets/mechs/kit-face.webp'),
  vex: require('../../../assets/mechs/vex-face.webp'),
  bulwark: require('../../../assets/mechs/bulwark-face.webp'),
  echo: require('../../../assets/mechs/echo-face.webp'),
  aurora: require('../../../assets/mechs/aurora-face.webp'),
  cortex: require('../../../assets/mechs/cortex-face.webp'),
  titan: require('../../../assets/mechs/titan-face.webp'),
  // Style shop characters (2026-10-25).
  bloop: require('../../../assets/shop/bloop-face.webp'),
  pixel: require('../../../assets/shop/pixel-face.webp'),
  nimbus: require('../../../assets/shop/nimbus-face.webp'),
  ember: require('../../../assets/shop/ember-face.webp'),
  zenith: require('../../../assets/shop/zenith-face.webp'),
  linky: require('../../../assets/shop/linky-face.webp'),
  sovereign: require('../../../assets/shop/sovereign-face.webp'),
  admin: require('../../../assets/shop/admin-face.webp'),
};

/** A character's round face (its ring is drawn into the picture). */
export function Face({ slug, size }: { slug: string; size: number }) {
  return <Image source={FACES[slug] ?? FACES.yara} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="contain" accessibilityLabel={characterOf(slug)?.name} />;
}
