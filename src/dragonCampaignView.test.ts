import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import DragonCampaignLab from './DragonCampaignLab';
import { dragonCampaignFixture, type DragonFixture } from './dragonCampaignFixtures';
import { isDragonCampaign } from './dragonCampaignEngine';
import { DRAGON_LAB_KEY } from './dragonCampaignStorage';

afterEach(() => vi.unstubAllGlobals());
function renderFixture(fixture: DragonFixture) {
  const state = dragonCampaignFixture(fixture, '2026-10-17');
  expect(isDragonCampaign(state)).toBe(true);
  const getItem = vi.fn((key: string) => key === DRAGON_LAB_KEY ? JSON.stringify(state) : null);
  vi.stubGlobal('window', { localStorage: { getItem } });
  return { html: renderToStaticMarkup(createElement(DragonCampaignLab)), getItem };
}
describe('DEV Dragon campaign interface', () => {
  it.each(['start', 'inner', 'wings', 'wingUltimate', 'orb', 'rage', 'ultimate', 'victory', 'lost'] as const)('renders %s using only isolated valid data and existing artwork', fixture => {
    const { html, getItem } = renderFixture(fixture);
    expect(html).toContain('試験専用');
    expect(getItem.mock.calls.every(([key]) => key === DRAGON_LAB_KEY)).toBe(true);
    for (const image of html.matchAll(/src="(\/[^"?]+)"/g)) expect(existsSync(fileURLToPath(new URL(`../public${image[1]}`, import.meta.url))), image[1]).toBe(true);
  });
  it('does not present every preparation control as an expanded wall of text', () => {
    const { html } = renderFixture('start');
    expect(html).toContain('⚔️ たたかう');
    expect(html.match(/<details class="campaign-prep__panel"/g)).toHaveLength(4);
    expect(html).not.toContain('<details class="campaign-prep__panel" open');
  });
  it('shows current HP numerically and four primary commands, not damage amounts on choices', () => {
    const { html } = renderFixture('rage');
    expect(html).toContain('aria-label="エンダードラゴンの体力"');
    for (const label of ['こうげき', 'まもる', 'ひっさつ', 'かいふく']) expect(html).toContain(`<b>${label}</b>`);
    expect(html).toContain('1まい → 4かい'); expect(html).toContain('パン ');
    expect(html).not.toContain('1回 4ダメ');
  });
  it('keeps the supplied animated GIF as the normal battle sprite and a static fallback for reduced motion', () => {
    const { html } = renderFixture('rage');
    expect(html).toContain('class="dc-dragon-flapping" src="/mining/Ender_Dragon.gif"');
    const source = readFileSync(new URL('./DragonCampaignLab.tsx', import.meta.url), 'utf8');
    expect(source).toContain("calm ? '/mining/Ender_Dragon_Campaign_v1.png' : '/mining/Ender_Dragon.gif'");
    const css = readFileSync(new URL('./dragonCampaign.css', import.meta.url), 'utf8');
    expect(css).toContain('mix-blend-mode:multiply');
  });
  it('shows thirteen hearts for health rank three and has a recoverable defeat command', () => {
    const state = dragonCampaignFixture('rage', '2026-10-17'); state.equipment.defense = { kind: 'health', rank: 3 }; state.hp = 26;
    vi.stubGlobal('window', { localStorage: { getItem: () => JSON.stringify(state) } });
    const html = renderToStaticMarkup(createElement(DragonCampaignLab));
    expect(html.match(/class="dc-heart-full"/g)).toHaveLength(13);
    const lost = renderFixture('lost').html;
    expect(lost).toContain('1まいで おきあがる'); expect(lost).toContain('そのまま 4かい うごける');
  });
  it('keeps the new entry DEV-guarded and production/profile imports absent', () => {
    const main = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8');
    expect(main).toMatch(/import\.meta\.env\.DEV && new URLSearchParams\(window.location.search\).get\("dragon-campaign"\) === "1"/);
    const source = readFileSync(new URL('./DragonCampaignLab.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/from ['"].*(CloudAppShell|cloudStorage|miningCommit|firebase)/);
    expect(source).toContain('navigator.locks.request'); expect(source).toContain("'visibilitychange', recoverDay");
    const css = readFileSync(new URL('./dragonCampaign.css', import.meta.url), 'utf8');
    expect(css).toContain('@container dc-game (max-width:460px)'); expect(css).toContain('prefers-reduced-motion');
  });
  it('offers full recovery only in the adult test controls, not as a fifth battle command', () => {
    const { html } = renderFixture('rage');
    expect(html).toContain('試験用：HPを全回復');
    expect(html.indexOf('試験用：HPを全回復')).toBeGreaterThan(html.indexOf('<details class="dc-parent"'));
    const source = readFileSync(new URL('./DragonCampaignLab.tsx', import.meta.url), 'utf8');
    expect(source).toContain('const next = recoverDragonTestHp(current.current)');
    expect(source).toContain('if (busyRef.current || blocked)');
    expect(source).toContain('if (!import.meta.env.DEV || busyRef.current || blocked)');
    expect(html.match(/class="dc-command /g)).toHaveLength(4);
  });
  it('shows a weak wing, a two-picture tactical cue and a contextual ultimate without predicted damage', () => {
    const { html } = renderFixture('wings');
    expect(html).toContain('光っている弱点'); expect(html).toContain('dc-focus-target');
    expect(html).toContain('dc-tactic-pictures'); expect(html).toContain('つばさが ひかった');
    expect(html).not.toContain('2倍');
    expect(html).toContain('dw-thickness'); expect(html).toContain('dw-frame'); expect(html).toContain('data-dw-hp-ratio');
    expect(html).not.toContain('m6 61 19-50 60 20');
  });
});
