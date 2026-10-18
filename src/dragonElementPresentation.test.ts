import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { DragonElementArt } from './DragonElementArt';
import { DragonSkillGame } from './DragonSkillGame';
import { DragonAttackFx } from './DragonAttackFx';
import { DragonSkillPreview } from './DragonSkillPreview';
import { ELEMENT_ASSETS, ELEMENT_MOTES, richElementEnabled } from './dragonElementPresentation';
import { BLAZE_SWORD_IMAGES } from './blazePrototypeAssets';
const kinds = ['gauge', 'repel', 'aim'] as const;
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('independent high-detail elemental textures', () => {
  it('uses distinct real alpha-enabled WebP assets with bounded total size', () => {
    const paths = Object.values(ELEMENT_ASSETS).flatMap(value => Object.values(value)); expect(new Set(paths).size).toBe(6);
    let total = 0;
    for (const path of paths) {
      const data = readFileSync(`public${path}`); total += data.length;
      expect(data.toString('ascii', 0, 4)).toBe('RIFF'); expect(data.includes(Buffer.from('ALPH')) || data.includes(Buffer.from('VP8L'))).toBe(true);
    }
    expect(total).toBeLessThan(4_500_000); expect(ELEMENT_MOTES).toHaveLength(18);
  });
  it.each(kinds)('%s uses energy rather than a fixed sword during the activity', kind => {
    const html = renderToStaticMarkup(createElement(DragonElementArt, { kind, power: .6, reduced: false, phase: 'charge', active: true, beat: 1, sword: 'netherite', shots: [100] }));
    expect(html).toContain(ELEMENT_ASSETS[kind].core); expect(html).toContain(`element-${kind}-v1`);
    expect(html).not.toContain('<canvas'); expect(html).not.toContain('<button'); expect(html).not.toContain('de-weapon'); expect(html).not.toContain(BLAZE_SWORD_IMAGES.netherite);
  });
  for (const sword of ['diamond', 'netherite'] as const) it.each(kinds)(`%s shows the equipped ${sword} sword at release, including practice`, kind => {
    const html = renderToStaticMarkup(createElement(DragonAttackFx, { skill: kind, stage: 'windup', special: true, technique: 'cleave', counter: false, stroke: 0, reduced: false, buddies: [], sword }));
    expect(html).toContain(`data-sword="${sword}"`); expect(html).toContain(BLAZE_SWORD_IMAGES[sword]); expect(html).not.toContain('<canvas');
    const preview = renderToStaticMarkup(createElement(DragonSkillPreview, { kind, score: 100, reduced: false, onClose: () => undefined, onStrike: () => undefined, sword }));
    expect(preview).toContain(`data-sword="${sword}"`);
  });
  it.each(kinds)('%s has a separate strike, cleanup state and quiet-mode support', kind => {
    const html = renderToStaticMarkup(createElement(DragonElementArt, { kind, power: 1, reduced: true, phase: 'impact' }));
    expect(html).toContain(ELEMENT_ASSETS[kind].strike); expect(html).toContain('de-reduced'); expect(html).not.toContain('<animate');
    const clean = renderToStaticMarkup(createElement(DragonElementArt, { kind, power: 1, reduced: false, phase: 'recover' }));
    expect(clean).not.toContain('de-core-field'); expect(clean).not.toContain('de-weapon');
  });
  it('retains each individual aim score and lights three independent crystals', () => {
    const html = renderToStaticMarkup(createElement(DragonElementArt, { kind: 'aim', power: .5, reduced: false, phase: 'charge', shots: [100, 50, 0] }));
    expect(html.match(/class="de-prism de-prism-lit"/g)).toHaveLength(3);
    expect(html).toContain('--de-prism-power:1'); expect(html).toContain('--de-prism-power:0.725'); expect(html).toContain('--de-prism-power:0.45');
  });
  it.each(kinds)('%s waits for image readiness without starting the minigame clock', kind => {
    const html = renderToStaticMarkup(createElement(DragonSkillGame, { kind, reduced: false, onDone: () => undefined }));
    expect(html).toContain('じゅんびちゅう'); expect(html).toContain('残り6秒'); expect(html).not.toContain('<canvas');
  });
  it('keeps a URL-only legacy fallback without changing saves', () => {
    expect(richElementEnabled('?dragon-campaign=1')).toBe(true); expect(richElementEnabled('?skill-art=legacy')).toBe(false);
    vi.stubGlobal('window', { location: { search: '?skill-art=legacy' } });
    const html = renderToStaticMarkup(createElement(DragonAttackFx, { skill: 'gauge', stage: 'strike', special: true, technique: 'cleave', counter: false, stroke: 0, reduced: false, buddies: [] }));
    expect(html).toContain('<canvas'); expect(html).not.toContain('de-art');
  });
  it('preloads only the chosen element and shares a bounded cache', async () => {
    vi.resetModules(); vi.useFakeTimers();
    const images: { onload: (() => void) | null; onerror: (() => void) | null; src: string }[] = [];
    vi.stubGlobal('Image', class { onload = null; onerror = null; src = ''; constructor() { images.push(this); } });
    const module = await import('./dragonElementPresentation'); const result = module.warmElementAssets('gauge');
    expect(module.warmElementAssets('gauge')).toBe(result); expect(images).toHaveLength(8);
    expect(images.every(image => image.src.length > 0)).toBe(true);
    expect(images.some(image => image.src.includes('water'))).toBe(false);
    images.forEach(image => image.onload?.()); expect(await result).toBe(true); expect(vi.getTimerCount()).toBe(0);
    expect(images.every(image => image.onload === null && image.onerror === null)).toBe(true);
  });
  it.each(['error', 'timeout'])('falls back after an image %s without disabling other elements', async reason => {
    vi.resetModules(); vi.useFakeTimers();
    const images: { onload: (() => void) | null; onerror: (() => void) | null; src: string }[] = [];
    vi.stubGlobal('Image', class { onload = null; onerror = null; src = ''; constructor() { images.push(this); } });
    const module = await import('./dragonElementPresentation'); const result = module.warmElementAssets('repel');
    if (reason === 'error') images[0].onerror?.(); else vi.advanceTimersByTime(8000);
    expect(await result).toBe(false); expect(module.elementAssetsFailed('repel')).toBe(true); expect(module.elementAssetsFailed('gauge')).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });
});
