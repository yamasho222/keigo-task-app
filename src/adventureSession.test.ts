import { describe, expect, it } from 'vitest';
import { adventureEquipment, ensureAdventure, projectAdventure, transitionAdventure, type AdventureCommand } from './adventureSession';
import { readAdventure, type AdventureLocation } from './adventureState';
import { emptyMiningState, normalizeMiningState, type MiningState } from './miningTypes';
import { rebaseMiningWrite } from './miningCommit';
import { tryCraft, resolveDig } from './miningProgress';
import { MINING_RECIPES } from './miningRecipes';
import { endermanAttackDamage } from './endermanPrototypeEngine';
import type { AdventureRequest } from './useAdventureController';

const DAY = '2026-10-18';
export function releaseFixture(): MiningState {
  const s = emptyMiningState();
  return { ...s, tickets: 1000, unlockedGachas: ['wood', 'farm', 'fortress', 'warped_forest', 'the_end'],
    crafted: { workbench: true, sword_diamond: true, helmet_diamond: true, chest_diamond: true, leggings_diamond: true, boots_diamond: true, enchanting_table: true },
    equipped: { ...s.equipped, helmet: 'helmet_diamond', chest: 'chest_diamond', leggings: 'leggings_diamond', boots: 'boots_diamond', held: 'shield' },
    materials: { bread: 200, shield: 1, water: 1, spare_bed: 3, lapis: 100, nether_quartz: 100, book: 10, ancient_debris: 1 } };
}
function act(state: MiningState, request: AdventureRequest, location: AdventureLocation = 'fortress', day = DAY) {
  return transitionAdventure(state, { ...request, revision: state.adventure?.revision ?? -1, day, location } as AdventureCommand);
}
function step(state: MiningState, request: AdventureRequest, location: AdventureLocation = 'fortress', day = DAY) {
  const result = act(state, request, location, day); expect(result.error).toBeUndefined();
  expect(() => readAdventure(result.state.adventure)).not.toThrow(); return result.state;
}
function ready(location: AdventureLocation = 'fortress') { return step(releaseFixture(), { kind: 'enter' }, location); }

describe('profile-owned production adventure transactions', () => {
  it.each(['fortress', 'warped_forest', 'the_end'] as const)('enters %s with only real resources', location => {
    const original = releaseFixture(), s = step(original, { kind: 'enter' }, location);
    expect(s.tickets).toBe(original.tickets); expect(s.materials).toEqual(original.materials);
    expect(s.adventure!.hands).toBe(0); expect(s.adventure!.hp).toBe(20);
    expect(normalizeMiningState(JSON.parse(JSON.stringify(s))).adventure).toEqual(s.adventure);
  });
  it('buys exactly four actions, preserves the remainder through return and another battle', () => {
    let s = ready(); s = step(s, { kind: 'blaze', action: { kind: 'strike', target: { enemyId: 0, part: 'body' } } });
    expect(s.tickets).toBe(999); expect(s.adventure!.hands).toBe(3);
    const hp = s.adventure!.hp, enemy = s.adventure!.blaze!.enemies[0].hp;
    s = step(s, { kind: 'blaze', action: { kind: 'return' } });
    expect(s.adventure!.hands).toBe(3); expect(s.adventure!.hp).toBe(hp);
    s = step(s, { kind: 'enter' }); expect(s.adventure!.blaze!.phase).toBe('battle'); expect(s.adventure!.blaze!.enemies[0].hp).toBe(enemy);
    s = step(s, { kind: 'enter' }, 'warped_forest');
    s = step(s, { kind: 'enderman', action: { kind: 'guard' } }, 'warped_forest');
    expect(s.tickets).toBe(999); expect(s.adventure!.hands).toBe(2);
  });
  it('shares two breads/day across all battles, without actions, enemy turns or tickets', () => {
    let s = ready(); s = { ...s, tickets: 0, adventure: { ...s.adventure!, hp: 1 } };
    const before = s.adventure!.blaze!;
    s = step(s, { kind: 'blaze', action: { kind: 'eat' } });
    expect(s.adventure!.hp).toBe(11); expect(s.tickets).toBe(0); expect(s.adventure!.hands).toBe(0);
    expect(s.adventure!.blaze!.turn).toBe(before.turn); expect(s.adventure!.blaze!.enemies).toEqual(before.enemies);
    s = step(s, { kind: 'enter' }, 'warped_forest');
    s = step(s, { kind: 'enderman', action: { kind: 'eat' } }, 'warped_forest');
    expect(s.adventure!.hp).toBe(20); expect(s.materials.bread).toBe(198);
    s = step(s, { kind: 'enter' }, 'the_end'); s = { ...s, adventure: { ...s.adventure!, hp: 1 } };
    expect(act(s, { kind: 'dragon', action: { kind: 'heal' } }, 'the_end').error).toBeTruthy();
    expect(s.adventure!.foodToday).toBe(2);
    s = step(s, { kind: 'enter' }, 'the_end', '2026-10-19');
    expect(s.adventure!.hp).toBe(20); expect(s.adventure!.foodToday).toBe(0); expect(s.materials.bread).toBe(198);
  });
  it('loses unused actions on death, retries at five hearts with four paid actions', () => {
    let s = ready('warped_forest');
    s = { ...s, adventure: { ...s.adventure!, hp: 1, gauge: 3, hands: 2, enderman: { ...s.adventure!.enderman!, intent: 'approach' } } };
    s = step(s, { kind: 'enderman', action: { kind: 'guard' } }, 'warped_forest');
    expect(s.adventure!.hp).toBe(0); expect(s.adventure!.hands).toBe(0); expect(s.adventure!.gauge).toBe(0);
    expect(s.adventure!.endermanDefeats).toBe(1); const tickets = s.tickets;
    s = step(s, { kind: 'retry' }, 'warped_forest'); expect(s.tickets).toBe(tickets - 1);
    expect(s.adventure!.hp).toBe(10); expect(s.adventure!.hands).toBe(4);
    s = step(s, { kind: 'enter' }, 'warped_forest'); expect(s.adventure!.enderman!.enemyHp).toBe(36);
    s = step(s, { kind: 'enderman', action: { kind: 'strike' } }, 'warped_forest');
    expect(s.tickets).toBe(tickets - 1); expect(s.adventure!.hands).toBe(3);
  });
  it('awards once on kill, retaining leftover paid actions after victory', () => {
    let s = ready(); s.adventure!.blaze!.enemies[0].hp = 1;
    const before = structuredClone(s);
    const command: AdventureCommand = { revision: s.adventure!.revision, day: DAY, location: 'fortress', kind: 'blaze', action: { kind: 'strike', target: { enemyId: 0, part: 'body' } } };
    const result = transitionAdventure(s, command); expect(result.error).toBeUndefined(); s = result.state;
    expect(s.materials.blaze_rod).toBe(1); expect(s.adventure!.hands).toBe(3); expect(s.adventure!.blaze!.handsLeft).toBe(3);
    expect(transitionAdventure(s, command).state).toBe(s);
    expect(rebaseMiningWrite(s, before, result.state)).toBe(s);
    s = step(s, { kind: 'next' }); s = step(s, { kind: 'blaze', action: { kind: 'guard' } }); expect(s.tickets).toBe(999);
  });
  it('does not award drops for nonlethal strikes', () => {
    let s = ready(); s = step(s, { kind: 'blaze', action: { kind: 'strike', target: { enemyId: 0, part: 'body' } } });
    expect(s.materials.blaze_rod ?? 0).toBe(0);
  });
  it('preserves task-ticket gains on rebase but rejects conflicting resource writes', () => {
    const before = ready(); const result = act(before, { kind: 'blaze', action: { kind: 'guard' } }).state;
    const latest = { ...before, tickets: before.tickets + 2 };
    expect(rebaseMiningWrite(latest, before, result).tickets).toBe(1001);
    const changed = { ...latest, materials: { ...latest.materials, bread: 0 } };
    expect(rebaseMiningWrite(changed, before, result)).toBe(changed);
  });
  it('does not grant default swords, armor, companions or supplies', () => {
    const empty = emptyMiningState(); const s = { ...empty, unlockedGachas: ['fortress'] as MiningState['unlockedGachas'] };
    const eq = adventureEquipment(s); expect(eq.sword).toBe('none'); expect(eq.buddies).toEqual([]); expect(eq.armor.chest).toBe('none');
    const result = step(s, { kind: 'enter' }); const view = projectAdventure(result, 'fortress');
    expect(view.run.tickets).toBe(0); expect(result.materials).toEqual({});
  });
  it('only equips owned items, costs one action and never advances enemy intent', () => {
    let s = ready('warped_forest'); const intent = s.adventure!.enderman!.intent;
    s = step(s, { kind: 'enderman', action: { kind: 'equip', item: 'water' } }, 'warped_forest');
    expect(s.equipped.held).toBe('water'); expect(s.adventure!.hands).toBe(3); expect(s.adventure!.enderman!.intent).toBe(intent);
    s = { ...s, materials: { ...s.materials, shield: 0 } };
    expect(act(s, { kind: 'enderman', action: { kind: 'equip', item: 'shield' } }, 'warped_forest').error).toBeTruthy();
  });
  it('charges actual enchant materials and carries health capacity without free healing', () => {
    let s = ready(); s = step(s, { kind: 'magic', category: 'defense', value: 'health' });
    const hp = s.adventure!.hp; s = step(s, { kind: 'upgrade', category: 'defense' });
    expect(s.adventure!.defense.rank).toBe(1); expect(s.adventure!.hp).toBe(hp); expect(s.materials.lapis).toBeLessThan(100);
  });
  it('uses ultimate enchant separately rather than doubling the normal enchant', () => {
    const loadout = { sword: 'diamond' as const, armor: adventureEquipment(releaseFixture()).armor, magic: { attack: { kind: 'ultimate' as const, rank: 3 as const }, defense: { kind: 'none' as const, rank: 0 as const } } };
    expect(endermanAttackDamage({ loadout, item: 'water' }, true)).toBe(26);
  });
  it('migrates old paid hand once and yesterday HP correctly', () => {
    const old = releaseFixture(); old.playerHp = 0; old.playerHpDate = '2026-10-17';
    const initialized = ensureAdventure(old, DAY); expect(initialized.adventure!.hp).toBe(20);
    initialized.adventure!.hands = 2; expect(ensureAdventure(initialized, DAY).adventure!.hands).toBe(2);
  });
  it('fails closed on corrupt/future records and invalid dates', () => {
    const s = ready(); expect(() => readAdventure({ ...s.adventure, version: 99 })).toThrow();
    const corrupt = structuredClone(s); corrupt.adventure!.blaze!.enemies[0].hp = NaN;
    expect(act(corrupt, { kind: 'enter' }).state).toBe(corrupt);
    expect(act(s, { kind: 'enter' }, 'fortress', '2026-02-30').state).toBe(s);
  });
  it('never changes another child profile', () => {
    const a = ready(), b = ready(), snapshot = structuredClone(b);
    step(a, { kind: 'blaze', action: { kind: 'guard' } }); expect(b).toEqual(snapshot);
  });
  it('crafts one bread from three wheat in the existing real crafting pipeline', () => {
    const s = releaseFixture(); s.materials.wheat = 3;
    const result = tryCraft(s, MINING_RECIPES.find(recipe => recipe.id === 'bread_craft')!); expect(result.error).toBeUndefined();
    expect(result.state.materials.wheat).toBe(0); expect(result.state.materials.bread).toBe(201);
  });
  it.each(['wood', 'stone', 'iron', 'gold', 'diamond', 'netherite'] as const)('gives at least three wheat and at most one combined tool/party extra with %s', tier => {
    for (const roll of [0, .2, .5, .8, .999]) {
      const s = releaseFixture(); s.crafted[`axe_${tier}`] = true;
      const result = resolveDig({ state: s, gacha: 'farm', toolKind: 'axe', dateKey: DAY, rand: () => roll });
      expect('error' in result).toBe(false); if ('error' in result) continue;
      const amount = result.drops.filter(drop => drop.material === 'wheat').reduce((sum, drop) => sum + drop.amount, 0);
      expect(amount).toBeGreaterThanOrEqual(3); expect(amount).toBeLessThanOrEqual(6);
      // Existing equipped boots may refund the mining ticket; farming must not change that rule.
      expect(result.state.tickets).toBeGreaterThanOrEqual(999); expect(result.state.tickets).toBeLessThanOrEqual(1000);
    }
  });
  it('retains destroyed dragon parts on death and restores exactly five hearts on retry', () => {
    let s = ready('the_end'); const a = s.adventure!;
    a.dragon!.crystals[0] = 0; a.hp = 1; a.dragon!.intentIndex = 0;
    // A claw is not guaranteed at index zero in every phase: attack until defeated.
    for (let i = 0; i < 20 && !s.adventure!.fallen; i++) s = step(s, { kind: 'dragon', action: { kind: 'attack' } }, 'the_end');
    expect(s.adventure!.fallen).toBe(true); expect(s.adventure!.dragon!.crystals[0]).toBe(0);
    const before = s.tickets;
    s = step(s, { kind: 'retry' }, 'the_end'); s = step(s, { kind: 'enter' }, 'the_end');
    expect(s.adventure!.hp).toBe(10); expect(s.adventure!.dragon!.hp).toBe(10); expect(s.adventure!.hands).toBe(4);
    expect(s.tickets).toBe(before - 1); expect(s.adventure!.dragon!.crystals[0]).toBe(0);
    s = step(s, { kind: 'dragon', action: { kind: 'guard' } }, 'the_end'); expect(s.tickets).toBe(before - 1);
  });
  it('persists a pending ultimate, blocks other battles and only consumes it once', () => {
    let s = ready('the_end'); s.adventure!.gauge = 3;
    s = step(s, { kind: 'dragon', action: { kind: 'beginSkill' } }, 'the_end');
    const pending = s.adventure!.dragon!.skills!.pending!, hp = s.adventure!.hp;
    s = normalizeMiningState(JSON.parse(JSON.stringify(s)));
    expect(act(s, { kind: 'enter' }, 'fortress').error).toBeTruthy();
    expect(ensureAdventure(s, '2026-10-19').adventure!.hp).toBe(hp);
    const command: AdventureCommand = { revision: s.adventure!.revision, day: DAY, location: 'the_end', kind: 'dragon', action: { kind: 'releaseSkill', token: pending.token, score: 0 } };
    const result = transitionAdventure(s, command); expect(result.error).toBeUndefined();
    expect(result.state.adventure!.dragon!.skills!.casts).toBe(1);
    expect(transitionAdventure(result.state, command).state).toBe(result.state);
  });
  it('does not replay an old trophy or reset a completed dragon fight', () => {
    const s = releaseFixture(); s.crafted.elytra = true;
    // Legacy accounts may have a trophy without a persisted old battle.
    const result = step(s, { kind: 'enter' }, 'the_end');
    expect(result.adventure!.dragon!.status).toBe('won'); expect(result.tickets).toBe(s.tickets);
  });
});
