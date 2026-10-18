import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync, readFileSync } from 'node:fs';
import { DragonBurstArt } from './DragonBurstArt';
import { DragonSkillGame } from './DragonSkillGame';
import { BURST_ASSETS, BURST_EMBERS, BURST_SPARKS, BURST_WEAPON_IMAGES, burstVisualPower, richBurstEnabled } from './dragonBurstPresentation';
import { DragonAttackFx } from './DragonAttackFx';
import { DragonSkillPreview } from './DragonSkillPreview';
import { burstScore } from './dragonSkillRules';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('raster-layer burst presentation stays separate from gameplay', () => {
  it('has four visible accumulation tiers, with bounded values', () => {
    expect([0, 12, 13, 23, 24, 30, 31].map(taps => burstVisualPower(burstScore(taps) / 100).tier)).toEqual([1, 1, 2, 2, 3, 3, 4]);
    for (const input of [-1, NaN, Infinity]) expect(burstVisualPower(input).power).toBe(0);
    expect(burstVisualPower(9).power).toBe(1);
  });
  it('can restore the old renderer without writing any saved data', () => {
    expect(richBurstEnabled('?dragon-campaign=1')).toBe(true);
    expect(richBurstEnabled('?dragon-campaign=1&burst-art=legacy')).toBe(false);
  });
  it('ships all alpha-enabled WebP layers as real project assets', () => {
    let total = 0;
    for (const asset of Object.values(BURST_ASSETS)) {
      const path = `public${asset}`; expect(existsSync(path)).toBe(true);
      const data = readFileSync(path); total += data.length;
      expect(data.toString('ascii', 0, 4)).toBe('RIFF');
      expect(data.includes(Buffer.from('ALPH')) || data.includes(Buffer.from('VP8L'))).toBe(true);
    }
    expect(total).toBeLessThan(1_500_000);
  });
  it('uses independent image layers without a canvas or input handlers', () => {
    const html = renderToStaticMarkup(createElement(DragonBurstArt, { power: 1, reduced: false, phase: 'charge', active: true, beat: 24 }));
    expect(html).not.toContain('<canvas'); expect(html).not.toContain('<button'); expect(html).not.toContain('onclick');
    expect(html).toContain('db-tier-4'); expect(html).toContain('db-tap-spark'); expect(html).toContain(BURST_ASSETS.flame);
    expect(html).toContain(BURST_ASSETS.core); expect(html).not.toContain('db-equipped-weapon'); expect(html).not.toContain('sword.webp');
    expect(html.match(/db-tap-spark/g)).toHaveLength(10); expect(BURST_EMBERS).toHaveLength(22); expect(BURST_SPARKS).toHaveLength(10);
  });
  it.each(['diamond', 'netherite'] as const)('uses the equipped %s sword only when releasing, never while charging', sword => {
    const charge = renderToStaticMarkup(createElement(DragonBurstArt, { power: 1, reduced: false, phase: 'charge', sword }));
    expect(charge).not.toContain(BURST_WEAPON_IMAGES[sword]);
    const release = renderToStaticMarkup(createElement(DragonAttackFx, { skill: 'burst', stage: 'windup', special: true, technique: 'cleave', counter: false, stroke: 0, reduced: false, buddies: [], sword }));
    expect(release).toContain(BURST_WEAPON_IMAGES[sword]); expect(release).toContain(`data-sword="${sword}"`);
    expect(release).not.toContain(BURST_WEAPON_IMAGES[sword === 'diamond' ? 'netherite' : 'diamond']);
    const preview = renderToStaticMarkup(createElement(DragonSkillPreview, { kind: 'burst', score: 100, reduced: false, onClose: () => undefined, onStrike: () => undefined, sword }));
    expect(preview).toContain(`data-sword="${sword}"`);
  });
  it('never guesses a diamond sword when equipment is unknown', () => {
    const html = renderToStaticMarkup(createElement(DragonBurstArt, { power: 1, reduced: false, phase: 'windup' }));
    expect(html).not.toContain('db-equipped-weapon'); expect(html).not.toContain('sword.webp');
    for (const image of Object.values(BURST_WEAPON_IMAGES)) expect(existsSync(`public${image}`)).toBe(true);
  });
  it('switches to a separate strike texture and supports quiet mode', () => {
    const html = renderToStaticMarkup(createElement(DragonBurstArt, { power: .5, reduced: true, phase: 'impact' }));
    expect(html).toContain(BURST_ASSETS.slash); expect(html).toContain('db-reduced'); expect(html).not.toContain('db-tap-fx');
  });
  it('does not enable the six-second game clock while images are loading', () => {
    const html = renderToStaticMarkup(createElement(DragonSkillGame, { kind: 'burst', onDone: () => undefined, reduced: false, practice: true }));
    expect(html).toContain('じゅんびちゅう'); expect(html).toContain('aria-label="ミニゲームをはじめる" disabled'); expect(html).not.toContain('<canvas');
  });
  it('preloads once, shares the result, and clears handlers on completion', async () => {
    vi.resetModules(); vi.useFakeTimers();
    const images: { onload: (() => void) | null; onerror: (() => void) | null; src: string }[] = [];
    vi.stubGlobal('Image', class { onload = null; onerror = null; src = ''; constructor() { images.push(this); } });
    const module = await import('./dragonBurstPresentation');
    const first = module.warmBurstAssets(); expect(module.warmBurstAssets()).toBe(first); expect(images).toHaveLength(9);
    expect(images.every(image => image.src.length > 0)).toBe(true);
    images.forEach(image => image.onload?.()); expect(await first).toBe(true); expect(module.burstAssetsFailed()).toBe(false);
    expect(vi.getTimerCount()).toBe(0); expect(images.every(image => image.onload === null && image.onerror === null)).toBe(true);
  });
  it.each(['error', 'timeout'])('falls back without starting gameplay after an asset %s', async reason => {
    vi.resetModules(); vi.useFakeTimers();
    const images: { onload: (() => void) | null; onerror: (() => void) | null; src: string }[] = [];
    vi.stubGlobal('Image', class { onload = null; onerror = null; src = ''; constructor() { images.push(this); } });
    const module = await import('./dragonBurstPresentation'); const result = module.warmBurstAssets();
    if (reason === 'error') images[0].onerror?.(); else vi.advanceTimersByTime(8000);
    expect(await result).toBe(false); expect(module.burstAssetsFailed()).toBe(true); expect(vi.getTimerCount()).toBe(0);
  });
});
