import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import BlazePrototype from './BlazePrototype';
import EndermanPrototype from './EndermanPrototype';
import DragonCampaignLab from './DragonCampaignLab';
import { projectAdventure, transitionAdventure } from './adventureSession';
import { emptyMiningState } from './miningTypes';

afterEach(() => vi.unstubAllGlobals());
describe('normal production battle ports', () => {
  it.each(['fortress', 'warped_forest', 'the_end'] as const)('%s distinguishes missing bread from full HP and a spent daily allowance', location => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }), location: { search: '' } });
    for (const [breadStock, foodToday, hp, enabled, help] of [
      [0, 0, 20, true, true], [0, 0, 5, true, true],
      [8, 2, 5, false, false], [0, 2, 5, false, false],
      [8, 0, 20, false, false], [8, 0, 5, true, false],
    ] as const) {
      const base = emptyMiningState(); base.unlockedGachas.push(location);
      base.materials.bread = breadStock;
      const entered = transitionAdventure(base, { kind: 'enter', revision: -1, day: '2026-10-18', location }).state;
      const state = { ...entered, adventure: { ...entered.adventure!, foodToday, hp } };
      const view = projectAdventure(state, location);
      const common = { onClose() {}, retry() {}, next() {}, onHelp() {}, seenHelp: true, endermanDefeats: 0, heldItems: ['none'], breadStock, foodToday };
      const html = view.kind === 'blaze' ? renderToStaticMarkup(createElement(BlazePrototype, { production: { ...common, run: view.run, act: () => { throw new Error('Help must not dispatch an action'); } } }))
        : view.kind === 'enderman' ? renderToStaticMarkup(createElement(EndermanPrototype, { production: { ...common, run: view.run, act: () => { throw new Error('Help must not dispatch an action'); } } }))
        : renderToStaticMarkup(createElement(DragonCampaignLab, { production: { ...common, run: view.run, act: () => { throw new Error('Help must not dispatch an action'); } } }));
      const button = html.match(/<button[^>]*class="(?:bp-command bp-eat|dc-command dc-heal)"[^>]*>/)?.[0];
      expect(button).toBeDefined();
      expect(button!.includes('disabled')).toBe(!enabled);
      expect(button!.includes('パンのつくりかた')).toBe(help);
    }
  });
  it.each(['fortress', 'warped_forest', 'the_end'] as const)('%s never reads trial storage or renders test controls', location => {
    const getItem = vi.fn(() => { throw new Error('Production battle must not read DEV storage'); });
    vi.stubGlobal('window', { localStorage: { getItem }, matchMedia: () => ({ matches: false }), location: { search: '' } });
    const base = emptyMiningState(); base.unlockedGachas.push(location);
    const result = transitionAdventure(base, { kind: 'enter', revision: -1, day: '2026-10-18', location });
    expect(result.error).toBeUndefined(); const view = projectAdventure(result.state, location);
    const common = { onClose() {}, retry() {}, next() {}, onHelp() {}, seenHelp: true, endermanDefeats: 0, heldItems: ['none'], breadStock: 0, foodToday: 0 };
    const html = view.kind === 'blaze' ? renderToStaticMarkup(createElement(BlazePrototype, { production: { ...common, run: view.run, act: () => ({ state: view.run, events: [] }) } }))
      : view.kind === 'enderman' ? renderToStaticMarkup(createElement(EndermanPrototype, { production: { ...common, run: view.run, act: () => ({ state: view.run, events: [] }) } }))
      : renderToStaticMarkup(createElement(DragonCampaignLab, { production: { ...common, run: view.run, act: () => ({ state: view.run, events: [] }) } }));
    expect(getItem).not.toHaveBeenCalled();
    for (const forbidden of ['保護者用の試験設定', '試験チケット', 'ぼうけんの じゅんび', 'おためしの', '本番データは変更しません', '?blaze-prototype', '?enderman-prototype']) expect(html).not.toContain(forbidden);
    expect(html).not.toContain('src=""');
    for (const match of html.matchAll(/src="(\/[^"?]+)"/g)) expect(existsSync(fileURLToPath(new URL(`../public${match[1]}`, import.meta.url))), match[1]).toBe(true);
    if (view.kind === 'dragon') expect(html).toContain('/mining/Ender_Dragon.gif');
  });
});
