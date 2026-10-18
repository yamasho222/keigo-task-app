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
  it.each(['fortress', 'warped_forest', 'the_end'] as const)('%s never reads trial storage or renders test controls', location => {
    const getItem = vi.fn(() => { throw new Error('Production battle must not read DEV storage'); });
    vi.stubGlobal('window', { localStorage: { getItem }, matchMedia: () => ({ matches: false }), location: { search: '' } });
    const base = emptyMiningState(); base.unlockedGachas.push(location);
    const result = transitionAdventure(base, { kind: 'enter', revision: -1, day: '2026-10-18', location });
    expect(result.error).toBeUndefined(); const view = projectAdventure(result.state, location);
    const common = { onClose() {}, retry() {}, next() {}, onHelp() {}, seenHelp: true, endermanDefeats: 0, heldItems: ['none'] };
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
