import { describe, expect, it } from 'vitest';
import { ensureAdventure, transitionAdventure, type AdventureCommand } from './adventureSession';
import { readAdventure, type AdventureLocation } from './adventureState';
import { attackDamage, defaultEquipment, type CampaignEquipment } from './campaignEquipment';
import { blazeAttackDamage } from './blazePrototypeEngine';
import { endermanAttackDamage } from './endermanPrototypeEngine';
import { emptyMiningState, normalizeMiningState, type MiningState } from './miningTypes';
import type { AdventureRequest } from './useAdventureController';

const DAY = '2026-11-09';
const KINDS = ['power', 'ultimate', 'break'] as const;
function fixture(attack: CampaignEquipment['attack'] = { kind: 'none', rank: 0 }, endUnlocked = true): MiningState {
  const state = ensureAdventure({
    ...emptyMiningState(), tickets: 12,
    unlockedGachas: endUnlocked ? ['fortress', 'warped_forest', 'the_end'] : ['fortress', 'warped_forest'],
    crafted: { enchanting_table: true, sword_diamond: true },
    materials: { lapis: 40, book: 2, nether_quartz: 12, bread: 3, water: 1 },
  }, DAY);
  state.adventure!.attack = { ...attack };
  state.adventure!.defense = { kind: 'protection', rank: 2 };
  state.adventure!.hp = 13;
  state.adventure!.hands = 2;
  state.adventure!.gauge = 3;
  return state;
}
function command(state: MiningState, request: AdventureRequest, location: AdventureLocation = 'fortress'): AdventureCommand {
  return { ...request, revision: state.adventure?.revision ?? -1, day: DAY, location };
}
function send(state: MiningState, request: AdventureRequest, location: AdventureLocation = 'fortress') {
  return transitionAdventure(state, command(state, request, location));
}
function step(state: MiningState, request: AdventureRequest, location: AdventureLocation = 'fortress'): MiningState {
  const result = send(state, request, location);
  expect(result.error).toBeUndefined();
  expect(() => readAdventure(result.state.adventure)).not.toThrow();
  return result.state;
}
function ready(state: MiningState, location: AdventureLocation): MiningState {
  return step(step(state, { kind: 'enter' }, location), { kind: 'lesson' }, location);
}
function rejected(state: MiningState, request: AdventureRequest, location: AdventureLocation = 'fortress') {
  const before = structuredClone(state);
  const result = send(state, request, location);
  expect(result.error).toBeTruthy();
  expect(result.state).toBe(state);
  expect(state).toEqual(before);
}

describe('atomic attack enchant transactions', () => {
  it.each(KINDS)('selects %s and buys its first star in one revision without touching other resources', value => {
    const state = fixture(), before = structuredClone(state);
    const next = step(state, { kind: 'enchantAttack', value, expectedRank: 0 });
    expect(next.adventure!.attack).toEqual({ kind: value, rank: 1 });
    expect(next.adventure!.revision).toBe(state.adventure!.revision + 1);
    expect(next.materials).toEqual({ ...state.materials, lapis: 34, book: 1 });
    expect(next.adventure).toMatchObject({ hp: 13, hands: 2, gauge: 3, defense: state.adventure!.defense });
    expect(next.tickets).toBe(state.tickets);
    expect(next.crafted).toEqual(state.crafted);
    expect(state).toEqual(before);
  });

  it('can initialize an adventure and equip with exactly the first-star cost', () => {
    const state = fixture(); delete state.adventure;
    state.materials = { lapis: 6, book: 1, nether_quartz: 0 };
    const next = step(state, { kind: 'enchantAttack', value: 'ultimate', expectedRank: 0 });
    expect(next.adventure!.attack).toEqual({ kind: 'ultimate', rank: 1 });
    expect(next.adventure!.revision).toBe(0);
    expect(next.materials).toEqual({ lapis: 0, book: 0, nether_quartz: 0 });
  });

  it.each(KINDS)('also charges once when a legacy rank-zero save already selects %s', value => {
    const state = fixture({ kind: value, rank: 0 });
    const next = step(state, { kind: 'enchantAttack', value, expectedRank: 0 });
    expect(next.adventure!.attack).toEqual({ kind: value, rank: 1 });
    expect(next.materials).toEqual({ ...state.materials, lapis: 34, book: 1 });
  });

  it.each([
    { lapis: 5, book: 1 }, { lapis: 6, book: 0 }, { lapis: -1, book: 1 },
    { lapis: 6.5, book: 1 }, { lapis: NaN, book: 1 }, { lapis: Infinity, book: 1 },
    { lapis: Number.MAX_SAFE_INTEGER + 1, book: 1 },
  ])('rejects insufficient or invalid costs without selecting or charging: %j', costs => {
    const state = fixture({ kind: 'ultimate', rank: 0 });
    state.materials = { ...state.materials, ...costs };
    rejected(state, { kind: 'enchantAttack', value: 'power', expectedRank: 0 });
  });

  it('requires the existing table prerequisite without partially selecting an attack', () => {
    const state = fixture(); delete state.crafted.enchanting_table;
    rejected(state, { kind: 'enchantAttack', value: 'power', expectedRank: 0 });
  });

  it.each([0, 1, 2, 3] as const)('requires a crafted sword for attack selection and upgrades at rank %s', rank => {
    const state = fixture({ kind: 'power', rank }); delete state.crafted.sword_diamond;
    const requests: AdventureRequest[] = [
      { kind: 'enchantAttack', value: 'power', expectedRank: rank },
      { kind: 'enchantAttack', value: 'ultimate', expectedRank: rank },
      { kind: 'upgrade', category: 'attack', expectedRank: rank },
      { kind: 'upgrade', category: 'attack' },
    ];
    for (const request of requests) {
      expect(send(state, request).error).toContain('けん');
      rejected(state, request);
    }
  });

  it.each(['wood', 'stone', 'iron', 'gold', 'diamond', 'netherite'] as const)('accepts a real crafted %s sword for first equip', tier => {
    const state = fixture(); delete state.crafted.sword_diamond;
    state.crafted[`sword_${tier}`] = true;
    expect(step(state, { kind: 'enchantAttack', value: 'power', expectedRank: 0 }).adventure!.attack).toEqual({ kind: 'power', rank: 1 });
  });

  it('rejects a duplicate first equip even when dispatch refreshes its revision', () => {
    const state = fixture();
    const request = { kind: 'enchantAttack', value: 'power', expectedRank: 0 } as const;
    const original = command(state, request), first = transitionAdventure(state, original);
    expect(first.error).toBeUndefined();
    const duplicate = transitionAdventure(first.state, original);
    expect(duplicate.error).toBeTruthy(); expect(duplicate.state).toBe(first.state);
    rejected(first.state, request);
    rejected(first.state, { ...request, value: 'ultimate' });
    expect(first.state.materials).toEqual({ ...state.materials, lapis: 34, book: 1 });
  });

  it.each([-1, .5, 4, NaN, Infinity, '0', undefined])('rejects invalid expectedRank %s', expectedRank => {
    rejected(fixture(), { kind: 'enchantAttack', value: 'power', expectedRank } as AdventureRequest);
  });

  it.each(['none', '', 'health', 'invalid', null, 3])('rejects invalid attack selection %s', value => {
    rejected(fixture(), { kind: 'enchantAttack', value, expectedRank: 0 } as AdventureRequest);
  });

  it.each([1, 2, 3] as const)('switches freely at rank %s with no materials and never raises the rank', rank => {
    for (const from of KINDS) for (const value of KINDS.filter(kind => kind !== from)) {
      const state = fixture({ kind: from, rank }); state.materials = {};
      const before = structuredClone(state);
      const next = step(state, { kind: 'enchantAttack', value, expectedRank: rank });
      expect(next.adventure!.attack).toEqual({ kind: value, rank });
      expect(next.adventure!.revision).toBe(state.adventure!.revision + 1);
      expect(next.materials).toEqual({}); expect(next.tickets).toBe(state.tickets);
      expect(next.adventure).toMatchObject({ hp: 13, hands: 2, gauge: 3, defense: state.adventure!.defense });
      expect(state).toEqual(before);
    }
  });

  it.each(KINDS)('reapplying %s at any nonzero rank returns the same state without a revision or charge', value => {
    for (const rank of [1, 2, 3] as const) {
      const state = fixture({ kind: value, rank });
      state.materials = {}; delete state.crafted.enchanting_table;
      expect(send(state, { kind: 'enchantAttack', value, expectedRank: rank })).toEqual({ state });
      expect(send(state, { kind: 'enchantAttack', value, expectedRank: rank }).state).toBe(state);
      expect(send(state, { kind: 'magic', category: 'attack', value }).state).toBe(state);
    }
  });

  it('keeps upgrades separate and rejects a stale guarded upgrade after the revision refreshes', () => {
    let state = step(fixture(), { kind: 'enchantAttack', value: 'power', expectedRank: 0 });
    const request = { kind: 'upgrade', category: 'attack', expectedRank: 1 } as const;
    const original = command(state, request), upgraded = transitionAdventure(state, original);
    expect(upgraded.error).toBeUndefined();
    expect(upgraded.state.adventure!.attack).toEqual({ kind: 'power', rank: 2 });
    expect(upgraded.state.materials).toEqual({ ...state.materials, lapis: 24, nether_quartz: 8 });
    expect(transitionAdventure(upgraded.state, original).state).toBe(upgraded.state);
    rejected(upgraded.state, request);
    state = step(upgraded.state, { kind: 'upgrade', category: 'attack', expectedRank: 2 });
    expect(state.adventure!.attack.rank).toBe(3);
    expect(state.materials).toEqual({ ...upgraded.state.materials, lapis: 10, nether_quartz: 0 });
    rejected(state, { kind: 'upgrade', category: 'attack', expectedRank: 3 });
  });

  it.each([-1, .5, 0, 2, 4, NaN, Infinity])('rejects mismatched or invalid upgrade expectedRank %s without charging', expectedRank => {
    rejected(fixture({ kind: 'power', rank: 1 }), { kind: 'upgrade', category: 'attack', expectedRank });
  });

  it('preserves unguarded upgrade compatibility and leaves defense selection and costs unchanged', () => {
    const state = fixture({ kind: 'power', rank: 1 });
    expect(step(state, { kind: 'upgrade', category: 'attack' }).adventure!.attack.rank).toBe(2);
    delete state.crafted.sword_diamond;
    state.adventure!.defense = { kind: 'none', rank: 0 };
    const selected = step(state, { kind: 'magic', category: 'defense', value: 'health' });
    expect(selected.adventure!.defense).toEqual({ kind: 'health', rank: 0 });
    expect(selected.materials).toEqual(state.materials);
    const upgraded = step(selected, { kind: 'upgrade', category: 'defense' });
    expect(upgraded.adventure!.defense).toEqual({ kind: 'health', rank: 1 });
    expect(upgraded.adventure!.hp).toBe(13);
    expect(upgraded.adventure!.attack).toEqual(state.adventure!.attack);
    expect(upgraded.materials).toEqual({ ...state.materials, lapis: 34, book: 1 });
  });
});

describe('attack unlock and battle transaction guards', () => {
  it.each([0, 1, 3] as const)('blocks new break selection through both commands before the End at rank %s', rank => {
    const state = fixture({ kind: rank ? 'power' : 'none', rank }, false);
    rejected(state, { kind: 'enchantAttack', value: 'break', expectedRank: rank });
    rejected(state, { kind: 'magic', category: 'attack', value: 'break' });
  });

  it.each([0, 1, 2, 3] as const)('preserves a saved break at rank %s without the End and allows switching away', rank => {
    const state = normalizeMiningState(JSON.parse(JSON.stringify(fixture({ kind: 'break', rank }, false))));
    expect(state.adventure!.attack).toEqual({ kind: 'break', rank });
    const retained = step(state, { kind: 'enchantAttack', value: 'break', expectedRank: rank });
    expect(retained.adventure!.attack).toEqual({ kind: 'break', rank: rank || 1 });
    if (rank) expect(retained).toBe(state);
    if (rank < 3) expect(step(state, { kind: 'upgrade', category: 'attack', expectedRank: rank }).adventure!.attack).toEqual({ kind: 'break', rank: rank + 1 });
    const switched = step(retained, { kind: 'enchantAttack', value: 'ultimate', expectedRank: retained.adventure!.attack.rank });
    expect(switched.adventure!.attack).toEqual({ kind: 'ultimate', rank: rank || 1 });
    expect(switched.materials).toEqual(retained.materials);
    rejected(switched, { kind: 'magic', category: 'attack', value: 'break' });
    const legacySwitch = step(state, { kind: 'magic', category: 'attack', value: 'power' });
    expect(legacySwitch.adventure!.attack).toEqual({ kind: 'power', rank });
  });

  it.each(['fortress', 'warped_forest', 'the_end'] as const)('rejects first equip and switching while %s tutorial or skill is pending', location => {
    for (const rank of [0, 1] as const) {
      let state = step(fixture({ kind: 'power', rank }), { kind: 'enter' }, location);
      const requests: AdventureRequest[] = [
        { kind: 'enchantAttack', value: 'ultimate', expectedRank: rank },
        { kind: 'enchantAttack', value: 'power', expectedRank: rank },
        { kind: 'magic', category: 'attack', value: 'ultimate' },
        { kind: 'upgrade', category: 'attack', expectedRank: rank },
      ];
      for (const request of requests) rejected(state, request, location);
      state = step(state, { kind: 'lesson' }, location);
      const kind = location === 'fortress' ? 'blaze' : location === 'warped_forest' ? 'enderman' : 'dragon';
      state = step(state, { kind, action: { kind: 'beginSkill' } }, location);
      expect(state.adventure![kind]!.skills!.pending).toBeTruthy();
      for (const request of requests) rejected(state, request, 'fortress');
    }
  });

  it('blocks type changes at unsafe dragon checkpoints but permits a no-op and guarded upgrades', () => {
    let state = ready(fixture({ kind: 'power', rank: 1 }), 'the_end');
    expect(state.adventure!.dragon!.safePreparation).toBe(true);
    state = step(state, { kind: 'enchantAttack', value: 'ultimate', expectedRank: 1 }, 'the_end');
    state = step(state, { kind: 'dragon', action: { kind: 'guard' } }, 'the_end');
    expect(state.adventure!.dragon!.safePreparation).toBe(false);
    rejected(state, { kind: 'enchantAttack', value: 'power', expectedRank: 1 });
    rejected(state, { kind: 'magic', category: 'attack', value: 'break' });
    expect(send(state, { kind: 'enchantAttack', value: 'ultimate', expectedRank: 1 }).state).toBe(state);
    expect(step(state, { kind: 'upgrade', category: 'attack', expectedRank: 1 }).adventure!.attack).toEqual({ kind: 'ultimate', rank: 2 });
  });

  it('rejects a first equip at an unsafe dragon checkpoint without spending materials', () => {
    let state = ready(fixture(), 'the_end');
    state = step(state, { kind: 'dragon', action: { kind: 'guard' } }, 'the_end');
    rejected(state, { kind: 'enchantAttack', value: 'break', expectedRank: 0 }, 'the_end');
  });
});

describe('attack enchant balance and small battle compatibility', () => {
  it.each([0, 1, 2, 3] as const)('gives break +2/+4 per star only against parts at rank %s', rank => {
    const base = defaultEquipment();
    const eq = { ...base, attack: { kind: 'break' as const, rank } };
    for (const special of [false, true]) for (const weak of [false, true]) {
      expect(attackDamage(eq, special, false, weak)).toEqual(attackDamage(base, special, false, weak));
    }
    expect(attackDamage(eq, false, true, false).weapon).toBe(4 + 2 * rank);
    expect(attackDamage(eq, true, true, false)).toEqual({ weapon: 8 + 4 * rank, companions: 9, total: 17 + 4 * rank });
    const power = { ...base, attack: { kind: 'power' as const, rank } };
    const ultimate = { ...base, attack: { kind: 'ultimate' as const, rank } };
    expect(attackDamage(eq, false, true, false).weapon - attackDamage(power, false, true, false).weapon).toBe(rank);
    expect(attackDamage(eq, true, true, false)).toEqual(attackDamage(ultimate, true, true, false));
  });

  it.each([0, 1, 2, 3] as const)('keeps power and ultimate bonuses identical in small battles at rank %s', rank => {
    for (const kind of ['none', ...KINDS] as const) {
      const eq = { ...defaultEquipment(), attack: { kind, rank } };
      const loadout = { sword: eq.sword, armor: eq.armor, magic: { attack: eq.attack, defense: eq.defense } };
      const normal = 4 + (kind === 'power' ? rank : 0);
      const special = 8 + (kind === 'ultimate' ? 4 * rank : 0);
      expect(blazeAttackDamage(loadout)).toBe(normal);
      expect(blazeAttackDamage(loadout, true)).toBe(special);
      expect(endermanAttackDamage({ loadout, item: 'none' })).toBe(normal);
      expect(endermanAttackDamage({ loadout, item: 'none' }, true)).toBe(special);
      expect(endermanAttackDamage({ loadout, item: 'water' })).toBe(normal + 3);
      expect(endermanAttackDamage({ loadout, item: 'water' }, true)).toBe(special + 6);
    }
  });
});
