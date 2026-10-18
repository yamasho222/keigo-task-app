import { BLAZE_SWORD_IMAGES } from './blazePrototypeAssets';
/** Presentation only: none of these values enter scoring, damage or persistence. */
export const BURST_ASSETS = {
  core: '/mining/dragon-burst-v2/fire-core.webp',
  flame: '/mining/dragon-burst-v1/flame.webp',
  slash: '/mining/dragon-burst-v1/slash.webp',
} as const;
export const BURST_WEAPON_IMAGES = BLAZE_SWORD_IMAGES;
const PRELOAD_ASSETS = [...Object.values(BURST_ASSETS), ...Object.values(BURST_WEAPON_IMAGES).filter(Boolean)];

export function richBurstEnabled(search = '') {
  return new URLSearchParams(search).get('burst-art') !== 'legacy';
}

export function burstVisualPower(value: number) {
  const power = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  return { power, tier: power >= 1 ? 4 : power >= .75 ? 3 : power >= .42 ? 2 : 1 };
}

export const BURST_EMBERS = Array.from({ length: 22 }, (_, i) => ({
  x: 13 + (i * 37 % 75), delay: -(i * .31), duration: 1.8 + (i % 5) * .37,
  drift: (i % 2 ? 1 : -1) * (12 + (i * 11 % 45)), size: 2 + (i % 3),
}));

export const BURST_SPARKS = Array.from({ length: 10 }, (_, i) => {
  const angle = i * Math.PI * 2 / 10;
  return { x: Math.cos(angle) * (35 + i % 3 * 15), y: Math.sin(angle) * (35 + i % 3 * 15) };
});
export const BURST_INFLOW = Array.from({ length: 8 }, (_, i) => {
  const angle = i * Math.PI * 2 / 8;
  return { x: Math.cos(angle) * 44, y: Math.sin(angle) * 42, delay: i % 3 * 25 };
});

let warming: Promise<boolean> | null = null;
let failed = false;
export const burstAssetsFailed = () => failed;
/** Preload every cast layer before starting the clock; a failed load keeps the old renderer usable. */
export function warmBurstAssets(): Promise<boolean> {
  warming ??= new Promise(resolve => {
    let remaining = PRELOAD_ASSETS.length, done = false;
    const images: HTMLImageElement[] = [];
    const settle = (ok: boolean) => {
      if (done) return;
      done = true; failed = !ok; clearTimeout(timeout);
      images.forEach(image => { image.onload = null; image.onerror = null; });
      resolve(ok);
    };
    const timeout = setTimeout(() => settle(false), 8000);
    for (const src of PRELOAD_ASSETS) {
      const image = new Image(); images.push(image);
      image.onload = () => { if (--remaining === 0) settle(true); };
      image.onerror = () => settle(false);
      image.src = src;
    }
  });
  return warming;
}
