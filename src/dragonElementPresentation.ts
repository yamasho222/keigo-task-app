import { BLAZE_SWORD_IMAGES } from './blazePrototypeAssets';
import type { DragonSkillKind } from './dragonSkillRules';

export type DragonElementKind = Exclude<DragonSkillKind, 'burst'>;
export const ELEMENT_ASSETS = {
  gauge: { core: '/mining/dragon-elements-v1/thunder-core.webp', strike: '/mining/dragon-elements-v1/thunder-strike.webp' },
  repel: { core: '/mining/dragon-elements-v1/water-core.webp', strike: '/mining/dragon-elements-v1/water-strike.webp' },
  aim: { core: '/mining/dragon-elements-v1/light-core.webp', strike: '/mining/dragon-elements-v1/light-strike.webp' },
} as const;
export const ELEMENT_MOTES = Array.from({ length: 18 }, (_, i) => ({
  x: 7 + i * 37 % 87, y: 10 + i * 23 % 78, delay: -i * .33, size: 2 + i % 3,
}));
export const ELEMENT_PROJECTILE_IMAGE = '/mining/dragon-burst-v2/fire-core.webp';
export const richElementEnabled = (search = '') => new URLSearchParams(search).get('skill-art') !== 'legacy';
const warming = new Map<DragonElementKind, Promise<boolean>>(), failed = new Set<DragonElementKind>();
export const elementAssetsFailed = (kind: DragonElementKind) => failed.has(kind);

/** Only warm the selected skill, not six large textures at once. Never touches a battle record. */
export function warmElementAssets(kind: DragonElementKind): Promise<boolean> {
  const existing = warming.get(kind); if (existing) return existing;
  const sources = [...Object.values(ELEMENT_ASSETS[kind]), ...Object.values(BLAZE_SWORD_IMAGES).filter(Boolean), ...(kind === 'repel' ? [ELEMENT_PROJECTILE_IMAGE] : [])];
  const promise = new Promise<boolean>(resolve => {
    let remaining = sources.length, done = false;
    const images: HTMLImageElement[] = [];
    const finish = (ok: boolean) => {
      if (done) return;
      done = true; clearTimeout(timer); if (!ok) failed.add(kind);
      images.forEach(image => { image.onload = null; image.onerror = null; }); resolve(ok);
    };
    const timer = setTimeout(() => finish(false), 8000);
    for (const src of sources) {
      const image = new Image(); images.push(image);
      image.onload = () => { if (--remaining === 0) finish(true); };
      image.onerror = () => finish(false); image.src = src;
    }
  });
  warming.set(kind, promise); return promise;
}
