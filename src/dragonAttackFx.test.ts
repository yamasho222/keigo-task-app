import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DragonAllyFx, DragonAttackFx } from './DragonAttackFx';
import { DragonThreatArt } from './DragonThreatArt';
import { existsSync, readFileSync } from 'node:fs';
import { SKILL_KINDS } from './dragonSkillRules';

describe('Dragon attacks are distinguishable without reading', () => {
  it.each(SKILL_KINDS)('uses separate cinematic %s geometry, not the old enlarged cut', skill => {
    const html = renderToStaticMarkup(createElement(DragonAttackFx, { technique: 'cleave', stage: 'strike', special: true, counter: false, stroke: 0, reduced: false, buddies: [], skill }));
    expect(html).toContain(`du-${skill}`); expect(html).not.toContain('da-cut-a');
    if (skill === 'burst') { expect(html).not.toContain('<canvas'); expect(html).toContain('data-renderer="energy-v2"'); }
    else { expect(html).not.toContain('<canvas'); expect(html).toContain(`data-renderer="element-${skill}-v1"`); }
    const marker = { burst: 'db-slash-main', gauge: 'thunder-strike.webp', repel: 'water-strike.webp', aim: 'light-strike.webp' }[skill]; expect(html).toContain(marker);
  });
  it('shows every participating helper in the large post-hit cut-in', () => {
    const buddies = ['one', 'two', 'three'].map(id => ({ id, image: `/${id}.png`, level: 10 }));
    const html = renderToStaticMarkup(createElement(DragonAllyFx, { buddies, stroke: 1, special: false, impact: false, reduced: false }));
    expect(html).toContain('/two.png'); expect(html).toContain('/one.png'); expect(html).toContain('/three.png'); expect(html).toContain('なかまの ついげき');
    const all = renderToStaticMarkup(createElement(DragonAllyFx, { buddies, stroke: 1, special: true, impact: true, reduced: true }));
    expect(all).toContain('da-ally-impact'); expect(all).toContain('da-reduced'); expect(all.match(/<img/g)).toHaveLength(3);
  });
  it.each(['cleave', 'shatter', 'dive', 'reflect', 'seal'] as const)('%s has its own geometry, controlled only by playback', technique => {
    const html = renderToStaticMarkup(createElement(DragonAttackFx, { technique, stage: 'strike', special: true, counter: false, stroke: 0, reduced: false, buddies: [] }));
    expect(html).toContain(`da-${technique}`); expect(html).toContain('<svg');
    expect(html).not.toContain('onclick'); expect(html).toContain('aria-hidden="true"');
    const marker = { cleave: 'da-cut', shatter: 'da-crystal', dive: 'da-sword', reflect: 'da-return', seal: 'da-seal-ring' }[technique];
    expect(html).toContain(marker);
  });
  it('varies normal strikes without inventing multiple engine hits', () => {
    for (let stroke = 0; stroke < 3; stroke++) {
      const html = renderToStaticMarkup(createElement(DragonAttackFx, { technique: 'cleave', stage: 'strike', special: false, counter: false, stroke, reduced: false, buddies: [] }));
      expect(html).toContain(`da-cut-${stroke}`); expect(html).not.toContain('da-cut-b'); expect(html).not.toContain('da-party');
    }
  });
  it('shows companions only during ultimate windup and supports static presentation', () => {
    const html = renderToStaticMarkup(createElement(DragonAttackFx, { technique: 'dive', stage: 'windup', special: true, counter: false, stroke: 0, reduced: true, buddies: [{ id: 'a', level: 10, image: '/stickers/mc-wolf.png' }] }));
    expect(html).toContain('da-reduced'); expect(html).toContain('da-party'); expect(html).toContain('とびこみ');
  });
  it.each(['claw', 'gust', 'breath', 'storm', 'orb'] as const)('distinguishes the enemy %s visually without Canvas', kind => {
    const html = renderToStaticMarkup(createElement(DragonThreatArt, { kind, phase: 'strike', reduced: true }));
    expect(html).toContain(`dt-${kind}`); expect(html).toContain('dt-calm');
    expect(html).not.toContain('<canvas'); expect(html).toContain('aria-hidden="true"'); expect(html).not.toContain('<button');
    for (const image of html.matchAll(/src="(\/[^"?]+)"/g)) expect(existsSync(new URL(`../public${image[1]}`, import.meta.url))).toBe(true);
  });
  it('shows distinct charge, projectile and guarded impact beats', () => {
    const render = (phase: 'windup' | 'strike' | 'impact') => renderToStaticMarkup(createElement(DragonThreatArt, { kind: 'breath', phase, reduced: false, guarded: true }));
    expect(render('windup')).toContain('dt-mouth'); expect(render('windup')).not.toContain('dt-contact');
    expect(render('strike')).toContain('breath.webp'); expect(render('strike')).not.toContain('dt-contact');
    expect(render('impact')).toContain('dt-contact'); expect(render('impact')).toContain('dt-shield-plane');
  });
  it('gives a critical its own cross-cut and supports reduced motion', () => {
    const html = renderToStaticMarkup(createElement(DragonAttackFx, { stage: 'impact', technique: 'cleave', special: false, counter: false, stroke: 0, reduced: true, critical: true, buddies: [] }));
    expect(html).toContain('da-critical-cross'); expect(html).toContain('da-reduced');
    const css = readFileSync(new URL('./dragonAttackFx.css', import.meta.url), 'utf8');
    expect(css).toContain('.da-fx>.da-impact {');
    expect(css).not.toMatch(/^\.da-impact \{/m); // Never shrink the stage root to the 1px spark origin.
  });
  it('keeps adult combat previews memory-only and motion-safe', () => {
    const source = readFileSync(new URL('./DragonCombatPreview.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/localStorage|stepDragonCampaign|nextDragonCritical/);
    expect(source).toContain('clearTimeout(start)'); expect(source).toContain('clearTimeout(hit)');
    const css = readFileSync(new URL('./dragonThreatArt.css', import.meta.url), 'utf8');
    expect(css).toContain('prefers-reduced-motion'); expect(css).toContain('.dt-calm *');
  });
});
