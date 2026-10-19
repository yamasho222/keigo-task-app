import { createElement, createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, existsSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { BattleReward } from './BattleReward';
import { BattleGuardArt } from './BattleGuardArt';
import { BattleSpectacle } from './BattleSpectacle';

describe('shared battle presentation without rule changes', () => {
  it.each([
    ['blaze', 'ブレイズ', 'ブレイズロッド', '/mining/Blaze_Rod.webp', 'BlazePrototype.tsx'],
    ['enderman', 'エンダーマン', 'エンダーパール', '/mining/Ender_Pearl.png', 'EndermanPrototype.tsx'],
    ['dragon', 'エンドラ', 'エリトラ', '/mining/Elytra.png', 'DragonCampaignLab.tsx'],
  ] as const)('uses the same unobscured reward layout for %s', (variant, enemy, item, image, file) => {
    const html = renderToStaticMarkup(createElement(BattleReward, { variant, enemy, item, image, headingRef: createRef<HTMLHeadingElement>() }));
    expect(html).toContain(`alt="${item}"`); expect(html).toContain('× 1'); expect(html).toContain('tabindex="-1"');
    expect(html).not.toMatch(/bs-victory-star|bs-laurel|<button|<canvas/);
    expect(html.indexOf('class="br-item"')).toBeLessThan(html.indexOf('<h2'));
    expect(existsSync(new URL(`../public${image}`, import.meta.url))).toBe(true);
    const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
    expect(source).toContain('<BattleReward');
    expect(source).toContain('role="status" aria-live="polite"');
    if (variant !== 'dragon') expect(source).toContain('className="bp-battle-message"');
  });
  it('uses the supplied actual shield only when equipped, and arms otherwise', () => {
    const shield = renderToStaticMarkup(createElement(BattleGuardArt, { shield: true, large: true }));
    const arms = renderToStaticMarkup(createElement(BattleGuardArt, { large: true }));
    expect(shield).toContain('/mining/Shield.webp'); expect(shield).toContain('bs-equipped-guard');
    expect(arms).toContain('bs-guard-arms'); expect(arms).not.toContain('Shield.webp');
    for (const html of [shield, arms]) expect(html).toContain('aria-hidden="true"');
  });
  it('keeps celebratory decoration behind the item and reduced motion supported', () => {
    const html = renderToStaticMarkup(createElement(BattleSpectacle, { kind: 'victory', phase: 'impact', reduced: true }));
    expect(html).toContain('bs-victory-atmosphere'); expect(html).not.toMatch(/bs-victory-star|bs-laurel/);
    const css = readFileSync(new URL('./battleReward.css', import.meta.url), 'utf8');
    expect(css).toContain('.br-content { position:relative; z-index:1;');
    expect(css).toContain('prefers-reduced-motion'); expect(css).toContain('max-height:270px');
    const guardCss = readFileSync(new URL('./battleGuard.css', import.meta.url), 'utf8');
    expect(guardCss).toContain('.bs-guard-texture { position:absolute; inset:0;');
    const dragon = readFileSync(new URL('./DragonCampaignLab.tsx', import.meta.url), 'utf8');
    expect(dragon).toContain('onClick={production.onClose}>ぼうけんへ');
  });
});
