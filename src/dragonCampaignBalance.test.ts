import { describe, expect, it } from 'vitest';
import { dragonBalanceEquipment, simulateDragonCampaign } from './dragonCampaignBalance';

describe('actual-engine Dragon campaign balance', () => {
  it('finishes all representative loadouts, retains state invariants and prints reproducible assumptions', () => {
    const rows = ([['iron', 0], ['mixed', 1], ['diamond', 3], ['netherite', 3]] as const).map(([tier, rank]) => {
      const result = simulateDragonCampaign(dragonBalanceEquipment(tier, rank));
      expect(result.won).toBe(true); expect(result.invalidStates).toBe(0); expect(result.beds).toBeLessThanOrEqual(3);
      expect(result.bread).toBeLessThanOrEqual(result.days * 2); expect(result.tickets * 4).toBeGreaterThanOrEqual(result.actions);
      expect(result.days).toBeGreaterThanOrEqual(Math.ceil(result.tickets / 5));
      expect(result.actions).toBeGreaterThan(80); expect(result.actions).toBeLessThan(600);
      return { tier, rank, ...result };
    });
    console.info('DRAGON_CAMPAIGN_ACTUAL_ENGINE', JSON.stringify({ assumptions: '5 battle tickets/day; 3 Lv10 buddies; shield; 3 beds; stocked bread; collection excluded', rows }));
  });
  it.each(['power', 'ultimate', 'break'] as const)('supports %s without unwinnable phases or invalid saves', kind => {
    const result = simulateDragonCampaign(dragonBalanceEquipment('mixed', 3, kind));
    expect(result.won).toBe(true); expect(result.invalidStates).toBe(0);
  });
  it('rejects invalid simulation budgets rather than looping', () => {
    for (const daily of [0, -1, NaN, Infinity]) expect(() => simulateDragonCampaign(dragonBalanceEquipment('mixed', 1), daily)).toThrow();
  });
});
