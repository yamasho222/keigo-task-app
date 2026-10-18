import { afterEach, describe, expect, it, vi } from 'vitest';
import * as engine from './blazePrototypeEngine';
import { BLAZE_ACTIONS_PER_TICKET, blazeFullArmor, type BlazeLoadout, type BlazeStartOptions } from './blazePrototypeEngine';
import { simulateBlaze, type BlazePolicy } from './blazePrototypeBalance';

const armorSets: Record<string, BlazeLoadout['armor']> = {
  iron: blazeFullArmor('iron'),
  diamondChest: { ...blazeFullArmor('iron'), chest: 'diamond' },
  diamond: blazeFullArmor('diamond'),
  netherite: blazeFullArmor('netherite'),
};
const policies: BlazePolicy[] = ['aggressive', 'guarded', 'prepared'];
afterEach(() => vi.restoreAllMocks());

describe('blaze balance simulation', () => {
  it('compares 48 combinations of armor, swords, starting HP and policies', () => {
    const report: Record<string, string>[] = [];
    for (const [armorName, armor] of Object.entries(armorSets)) {
      for (const sword of ['diamond', 'netherite'] as const) {
        for (const startHp of ['full', 'half'] as const) {
          const row: Record<string, string> = { armor: armorName, sword, startHp };
          for (const policy of policies) {
            const options: BlazeStartOptions = { loadout: { sword, armor }, startHp };
            const before = structuredClone(options);
            const result = simulateBlaze(options, policy);
            expect(options).toEqual(before);
            expect(result).toEqual(simulateBlaze(options, policy));
            expect(['won', 'lost', 'stalled']).toContain(result.phase);
            expect(result.ticketsSpent).toBeGreaterThanOrEqual(1);
            expect(result.ticketsSpent).toBeLessThanOrEqual(4);
            expect(result.ticketsSpent).toBe(Math.ceil(result.turns / BLAZE_ACTIONS_PER_TICKET));
            expect(result.turns).toBeLessThanOrEqual(8);
            expect(result.breadUsed).toBeLessThanOrEqual(2);
            expect(result.hpHearts).toBeGreaterThanOrEqual(0);
            expect(result.hpHearts).toBeLessThanOrEqual(10);
            if (result.phase === 'won') expect(result.enemyHp).toBe(0);
            if (result.phase === 'lost') expect(result.hpHearts).toBe(0);
            if (policy !== 'prepared') expect(result.breadUsed).toBe(0);
            // Partial guard is not invulnerability: half-health iron can still lose without bread.
            if (policy === 'prepared') expect(result.phase).toBe('won');
            row[policy] = `${result.phase}: tickets=${result.ticketsSpent}, turns=${result.turns}, bread=${result.breadUsed}, hearts=${result.hpHearts}, enemy=${result.enemyHp}`;
          }
          report.push(row);
        }
      }
    }
    expect(report).toHaveLength(16);
    console.table(report);
  });

  it('records the 24-HP enemy outcome under the 25% armor rule with a legacy unscored ultimate', () => {
    expect(simulateBlaze({}, 'aggressive')).toEqual({
      phase: 'won', ticketsSpent: 2, turns: 5, breadUsed: 0, hpHearts: 1.5, enemyHp: 0,
    });
  });

  it('protects all 48 policy outcomes against balance regressions', () => {
    const outcomes: string[] = [];
    for (const armor of Object.values(armorSets)) {
      for (const sword of ['diamond', 'netherite'] as const) {
        for (const startHp of ['full', 'half'] as const) {
          outcomes.push(policies.map((policy) => {
            const result = simulateBlaze({ loadout: { sword, armor }, startHp }, policy);
            return `${result.phase}/${result.ticketsSpent}/${result.turns}/${result.breadUsed}/${result.hpHearts}/${result.enemyHp}`;
          }).join(' | '));
        }
      }
    }
    // Each cell: phase / tickets / turns / bread / remaining hearts / enemy HP.
    expect(outcomes).toEqual([
      'won/2/5/0/1.5/0 | won/2/6/0/5/0 | won/2/5/1/6.5/0',
      'lost/1/2/0/0/16 | lost/1/3/0/0/16 | won/2/5/2/6.5/0',
      'won/1/4/0/1.5/0 | won/2/5/0/5/0 | won/1/4/1/6.5/0',
      'lost/1/2/0/0/12 | lost/1/3/0/0/12 | won/1/4/2/6.5/0',
      'won/2/5/0/2/0 | won/2/6/0/5/0 | won/2/5/1/7/0',
      'lost/1/2/0/0/16 | lost/1/3/0/0/16 | won/2/5/2/7/0',
      'won/1/4/0/2/0 | won/2/5/0/5/0 | won/1/4/1/7/0',
      'lost/1/2/0/0/12 | lost/1/3/0/0/12 | won/1/4/2/7/0',
      'won/2/5/0/3/0 | won/2/6/0/5.5/0 | won/2/5/1/8/0',
      'lost/1/2/0/0/16 | won/2/6/0/0.5/0 | won/2/5/2/8/0',
      'won/1/4/0/3/0 | won/2/5/0/5.5/0 | won/1/4/1/8/0',
      'lost/1/2/0/0/12 | won/2/5/0/0.5/0 | won/1/4/2/8/0',
      'won/2/5/0/4.5/0 | won/2/6/0/6.5/0 | won/2/5/1/9.5/0',
      'lost/1/3/0/0/12 | won/2/6/0/1.5/0 | won/2/5/2/9.5/0',
      'won/1/4/0/4.5/0 | won/2/5/0/6.5/0 | won/1/4/1/9.5/0',
      'lost/1/3/0/0/6 | won/2/5/0/1.5/0 | won/1/4/2/9.5/0',
    ]);
  });

  it('stops at ticket exhaustion even with bread remaining', () => {
    const state = engine.createBlazeRun();
    state.tickets = 0;
    vi.spyOn(engine, 'createBlazeRun').mockReturnValue(state);
    expect(simulateBlaze({}, 'prepared')).toEqual({
      phase: 'stalled', ticketsSpent: 0, turns: 0, breadUsed: 0, hpHearts: 10, enemyHp: 24,
    });
  });

  it('uses prepaid hands before reporting a stall', () => {
    const state = engine.createBlazeRun();
    Object.assign(state, { tickets: 0, handsLeft: 1 });
    vi.spyOn(engine, 'createBlazeRun').mockReturnValue(state);
    expect(simulateBlaze({}, 'aggressive')).toEqual({
      phase: 'stalled', ticketsSpent: 0, turns: 1, breadUsed: 0, hpHearts: 10, enemyHp: 20,
    });
  });

  it('never loops forever when an engine integration stops advancing', () => {
    vi.spyOn(engine, 'actOnBlaze').mockImplementation((state) => ({ state, events: [] }));
    expect(simulateBlaze({}, 'aggressive').phase).toBe('stalled');
    expect(engine.actOnBlaze).toHaveBeenCalledTimes(64);
  });

  it('reports a stalled run if an engine command is rejected', () => {
    vi.spyOn(engine, 'actOnBlaze').mockImplementation((state) => ({ state, events: [], error: 'test' }));
    expect(simulateBlaze({}, 'aggressive').phase).toBe('stalled');
    expect(engine.actOnBlaze).toHaveBeenCalledTimes(1);
  });
});
