import { describe, expect, it } from 'vitest';
import { createDragonCampaign, stepDragonCampaign } from './dragonCampaignEngine';
import { DRAGON_LAB_BACKUP_KEY, DRAGON_LAB_KEY, loadDragonCampaign, loadDragonSnapshot, saveDragonCampaign } from './dragonCampaignStorage';

function memory() {
  const data = new Map<string, string>();
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}
describe('isolated Dragon lab storage', () => {
  it('round trips only the lab key, with an exact previous valid backup', () => {
    const storage = memory(), first = createDragonCampaign('2026-10-17');
    storage.setItem('real-profile', 'do-not-touch');
    expect(saveDragonCampaign(storage, first, null).error).toBeUndefined();
    const second = stepDragonCampaign(first, { kind: 'resume' }).state;
    expect(saveDragonCampaign(storage, second, first.revision).error).toBeUndefined();
    expect(loadDragonCampaign(storage).state).toEqual(second);
    expect(JSON.parse(storage.getItem(DRAGON_LAB_BACKUP_KEY)!)).toEqual(first);
    expect(storage.getItem('real-profile')).toBe('do-not-touch');
  });
  it('rejects stale-tab writes and never overwrites newer progress', () => {
    const storage = memory(), s = createDragonCampaign('2026-10-17');
    saveDragonCampaign(storage, s, null);
    const next = stepDragonCampaign(s, { kind: 'resume' }).state; saveDragonCampaign(storage, next, 0);
    expect(saveDragonCampaign(storage, s, 0).error).toContain('別のタブ'); expect(loadDragonCampaign(storage).state).toEqual(next);
  });
  it('preserves corrupt primary data and offers a valid backup instead of resetting', () => {
    const storage = memory(), s = createDragonCampaign('2026-10-17');
    storage.setItem(DRAGON_LAB_KEY, '{bad'); storage.setItem(DRAGON_LAB_BACKUP_KEY, JSON.stringify(s));
    const result = loadDragonCampaign(storage); expect(result.error).toBeTruthy(); expect(result.backup).toEqual(s);
    expect(saveDragonCampaign(storage, s, null).error).toBeTruthy(); expect(storage.getItem(DRAGON_LAB_KEY)).toBe('{bad');
  });
  it('reports unavailable storage and quota failure without throwing', () => {
    const bad = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    expect(loadDragonCampaign(bad).error).toBeTruthy(); expect(saveDragonCampaign(bad, createDragonCampaign('2026-10-17'), null).error).toBeTruthy();
    const quota = { getItem: () => null, setItem() { throw new Error('quota'); } };
    expect(saveDragonCampaign(quota, createDragonCampaign('2026-10-17'), null).error).toContain('確定していません');
  });
  it('keeps the pre-fixture snapshot after subsequent ordinary actions overwrite the rolling backup', () => {
    const storage = memory(), original = createDragonCampaign('2026-10-17', { id: 'original' });
    saveDragonCampaign(storage, original, null);
    const fixture = createDragonCampaign('2026-10-17', { id: 'fixture' });
    saveDragonCampaign(storage, fixture, 0, true);
    const next = stepDragonCampaign(fixture, { kind: 'resume' }).state;
    saveDragonCampaign(storage, next, 0);
    expect(loadDragonSnapshot(storage)).toEqual(original);
    expect(JSON.parse(storage.getItem(DRAGON_LAB_BACKUP_KEY)!)).toEqual(fixture);
  });
});
