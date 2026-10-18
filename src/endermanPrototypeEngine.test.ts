import { describe, expect, it } from 'vitest';
import { blazeFullArmor, type BlazeArmorSlot, type BlazeArmorTier } from './blazePrototypeEngine';
import { actOnEnderman, createEndermanRun, endermanAttackDamage, endermanIncomingDamage, type EndermanAction, type EndermanRun } from './endermanPrototypeEngine';

function step(run: EndermanRun, kind: 'strike' | 'guard' | 'ultimate' | 'eat' | 'return') { return actOnEnderman(run, { kind }).state; }
function rejected(run: EndermanRun, action: EndermanAction) {
  const snapshot = structuredClone(run), result = actOnEnderman(run, action);
  expect(result.error).toBeTruthy(); expect(result.state).toBe(run); expect(result.events).toEqual([]); expect(run).toEqual(snapshot);
}

describe('enderman equipment and damage', () => {
  it('starts one visible 36HP enemy, the same four-action ticket and two breads, without water', () => {
    expect(createEndermanRun()).toMatchObject({ hp: 20, enemyHp: 36, enemyMaxHp: 36, tickets: 4, handsLeft: 0, bread: 2, gauge: 0, intent: 'warp', item: 'none', pearls: 0 });
    expect(createEndermanRun({ startHp: 'half' }).hp).toBe(10);
  });
  it.each([['diamond', 4, 7], ['netherite', 6, 9]] as const)('%s sword adds water before the ultimate multiplier', (sword, normal, wet) => {
    const run = createEndermanRun({ loadout: { sword, armor: blazeFullArmor('iron') } });
    expect(endermanAttackDamage(run)).toBe(normal); expect(endermanAttackDamage(run, true)).toBe(normal * 2);
    run.item = 'water'; expect(endermanAttackDamage(run)).toBe(wet); expect(endermanAttackDamage(run, true)).toBe(wet * 2);
    run.item = 'stone'; expect(endermanAttackDamage(run)).toBe(normal);
  });
  it.each([['none', 16, 18, 2, 2], ['gold', 13, 15, 2, 2], ['iron', 12, 14, 2, 2], ['diamond', 10, 11, 1, 2], ['netherite', 8, 9, 1, 1]] as const)('uses the %s armor set and rounds water once', (tier, normal, ambush, wetNormal, wetAmbush) => {
    const run = createEndermanRun({ loadout: { sword: 'diamond', armor: blazeFullArmor(tier) } });
    expect(endermanIncomingDamage({ ...run, intent: 'approach' })).toBe(normal);
    expect(endermanIncomingDamage({ ...run, intent: 'ambush' })).toBe(ambush);
    expect(endermanIncomingDamage({ ...run, item: 'water', intent: 'approach' })).toBe(wetNormal);
    expect(endermanIncomingDamage({ ...run, item: 'water', intent: 'ambush' })).toBe(wetAmbush);
    for (const intent of ['warp', 'opening'] as const) expect(endermanIncomingDamage({ ...run, intent })).toBe(0);
  });
  it('weights all 625 armor combinations and makes every upgrade no worse', () => {
    const tiers: BlazeArmorTier[] = ['none', 'gold', 'iron', 'diamond', 'netherite'];
    const slots: BlazeArmorSlot[] = ['helmet', 'chest', 'leggings', 'boots'];
    for (const helmet of tiers) for (const chest of tiers) for (const leggings of tiers) for (const boots of tiers) {
      const run = createEndermanRun({ loadout: { sword: 'diamond', armor: { helmet, chest, leggings, boots } } });
      for (const intent of ['approach', 'ambush'] as const) for (const item of ['none', 'water'] as const) {
        const damage = endermanIncomingDamage({ ...run, intent, item });
        expect(damage).toBeGreaterThanOrEqual(1); expect(damage).toBeLessThanOrEqual(18);
        for (const slot of slots) {
          const tier = tiers[tiers.indexOf(run.loadout.armor[slot]) + 1]; if (!tier) continue;
          const upgraded = { ...run, intent, item, loadout: { ...run.loadout, armor: { ...run.loadout.armor, [slot]: tier } } };
          expect(endermanIncomingDamage(upgraded)).toBeLessThanOrEqual(damage);
        }
      }
    }
    const iron = createEndermanRun();
    expect(endermanIncomingDamage({ ...iron, intent: 'approach', loadout: { ...iron.loadout, armor: { ...iron.loadout.armor, chest: 'diamond' } } })).toBe(12);
  });
  it('does not share mutable armor or logs with options or another run', () => {
    const armor = blazeFullArmor('iron'), first = createEndermanRun({ loadout: { sword: 'diamond', armor } });
    const second = createEndermanRun({ loadout: { sword: 'diamond', armor } });
    armor.chest = 'none'; first.log.push('changed'); expect(first.loadout.armor.chest).toBe('iron'); expect(second.log).toHaveLength(1);
    const before = structuredClone(first); step(first, 'strike'); expect(first).toEqual(before);
  });
});

describe('warp, defense, water and special interaction', () => {
  it('only a telegraphed dry normal attack misses; spends one hand but gains charge, and cannot miss twice in succession', () => {
    const result = actOnEnderman(createEndermanRun(), { kind: 'strike' });
    expect(result.state).toMatchObject({ enemyHp: 36, hp: 20, tickets: 3, handsLeft: 3, gauge: 1, misses: 1, intent: 'ambush' });
    expect(result.events).toEqual([{ kind: 'miss', amount: 0 }]);
    const next = step(result.state, 'strike'); expect(next).toMatchObject({ enemyHp: 32, gauge: 2, intent: 'opening', hp: 6 });
    expect(next.misses).toBe(1);
  });
  it('guarding a warp creates a guaranteed, counter-free opening without damaging the enemy or building gauge', () => {
    const guarded = step(createEndermanRun(), 'guard');
    expect(guarded).toMatchObject({ intent: 'opening', hp: 20, enemyHp: 36, gauge: 0, handsLeft: 3 });
    const hit = step(guarded, 'strike'); expect(hit).toMatchObject({ enemyHp: 32, hp: 20, intent: 'approach', gauge: 1 });
  });
  it.each(['warp', 'ambush', 'approach', 'opening'] as const)('ultimate catches %s, stops the counter, then gives an opening', intent => {
    const before = { ...createEndermanRun(), intent, gauge: 3 };
    const result = actOnEnderman(before, { kind: 'ultimate' });
    expect(result.state).toMatchObject({ enemyHp: 28, hp: 20, gauge: 0, intent: 'opening', misses: 0 });
    expect(result.events.map(e => e.kind)).toEqual(['hit', 'pin']);
  });
  it('water prevents the dodge and gives +3 damage with a visible splash event', () => {
    const result = actOnEnderman(createEndermanRun({ item: 'water' }), { kind: 'strike' });
    expect(result.state).toMatchObject({ enemyHp: 29, hp: 20, misses: 0, intent: 'opening', gauge: 1 });
    expect(result.events.map(e => e.kind)).toEqual(['hit', 'splash']);
  });
  it('equipping spends one action each, without healing, intent reroll or an enemy reset', () => {
    const original = { ...step(createEndermanRun(), 'strike'), hp: 7 };
    let run = original;
    let changes = 0;
    for (const item of ['water', 'stone', 'none', 'water'] as const) {
      run = actOnEnderman(run, { kind: 'equip', item }).state;
      changes++;
      expect({ ...run, item: original.item, log: original.log, turn: original.turn, tickets: original.tickets, handsLeft: original.handsLeft }).toEqual(original);
      expect(run.turn).toBe(original.turn + changes);
      expect(run.tickets * 4 + run.handsLeft).toBe(original.tickets * 4 + original.handsLeft - changes);
    }
    expect(step(run, 'strike')).toMatchObject({ enemyHp: 29, hp: 5, intent: 'opening' });
  });
  it('eating never rerolls the telegraph, charges light, or uses a hand/ticket', () => {
    const before = { ...step(createEndermanRun(), 'strike'), hp: 5 };
    const next = step(before, 'eat');
    expect(next).toMatchObject({ hp: 15, bread: 1, tickets: 3, handsLeft: 3, turn: 1, gauge: 1, intent: 'ambush', enemyHp: 36 });
    expect(step(next, 'eat')).toMatchObject({ hp: 20, bread: 0 }); rejected(step(next, 'eat'), { kind: 'eat' });
  });
});

describe('ticket boundaries, outcomes and balance', () => {
  it('shares four paid hands across guard, attack, misses and ultimate; the fifth buys the next ticket', () => {
    let run = createEndermanRun();
    for (let i = 1; i <= 4; i++) { run = step(run, 'guard'); expect(run.tickets).toBe(3); expect(run.handsLeft).toBe(4 - i); }
    run = step(run, 'guard'); expect(run).toMatchObject({ tickets: 2, handsLeft: 3, hp: 14, turn: 5 });
  });
  it('allows the final prepaid action without a ticket then prevents infinite free guard/eat', () => {
    const before = { ...createEndermanRun(), tickets: 0, handsLeft: 1, hp: 10 };
    const next = step(before, 'guard'); expect(next).toMatchObject({ tickets: 0, handsLeft: 0 });
    for (const kind of ['strike', 'guard', 'eat'] as const) rejected(next, { kind });
    expect(step(next, 'return').phase).toBe('returned');
  });
  it.each([1, 2, 3])('forfeits %i unused prepaid hands on confirmed return but keeps unused tickets', handsLeft => {
    const run = { ...createEndermanRun(), handsLeft, tickets: 2 };
    expect(step(run, 'return')).toMatchObject({ phase: 'returned', tickets: 2, handsLeft: 0, pearls: 0 });
  });
  it('only grants a pearl on a kill, clamps overkill, skips the counter and pays once', () => {
    const run = { ...createEndermanRun(), enemyHp: 1, intent: 'approach' as const };
    const result = actOnEnderman(run, { kind: 'strike' });
    expect(result.state).toMatchObject({ enemyHp: 0, phase: 'won', hp: 20, handsLeft: 0, pearls: 1 });
    expect(result.events).toEqual([{ kind: 'hit', amount: 1 }, { kind: 'kill', amount: 1 }]);
    rejected(result.state, { kind: 'strike' }); rejected(result.state, { kind: 'equip', item: 'water' });
  });
  it('loss grants no pearl and clears prepaid actions without refunding tickets', () => {
    const run = { ...createEndermanRun(), hp: 1, intent: 'approach' as const };
    const result = actOnEnderman(run, { kind: 'strike' });
    expect(result.state).toMatchObject({ hp: 0, phase: 'lost', tickets: 3, handsLeft: 0, pearls: 0 });
    rejected(result.state, { kind: 'eat' }); rejected(result.state, { kind: 'return' });
  });
  it.each([{ kind: 'ultimate' }, { kind: 'eat' }, { kind: 'other' }, { kind: 'equip', item: 'invalid' }] as unknown as EndermanAction[])('rejects invalid/unavailable %j without mutation', action => rejected(createEndermanRun(), action));
  it.each(['diamond', 'netherite'] as const)('wins with water + %s sword, and stronger swords save tickets', sword => {
    let run = createEndermanRun({ item: 'water', loadout: { sword, armor: blazeFullArmor('iron') } });
    for (let i = 0; i < 16 && run.phase === 'battle'; i++) run = step(run, run.gauge === 3 ? 'ultimate' : 'strike');
    expect(run).toMatchObject({ phase: 'won', hp: 18, pearls: 1, misses: 0, bread: 2 });
    expect(run.turn).toBe(sword === 'diamond' ? 5 : 4); expect(run.tickets).toBe(sword === 'diamond' ? 2 : 3);
  });
  it('dry iron armor cannot survive accepting a heavy hit then relying on unshielded guard alone', () => {
    let run = createEndermanRun();
    for (let i = 0; i < 16 && run.phase === 'battle'; i++) {
      const mustGuard = run.intent === 'approach' || (run.intent === 'ambush' && run.hp <= endermanIncomingDamage(run));
      run = step(run, run.gauge === 3 ? 'ultimate' : mustGuard ? 'guard' : 'strike');
    }
    expect(run).toMatchObject({ phase: 'lost', hp: 0, pearls: 0 });
    expect(run.turn).toBeLessThanOrEqual(16);
  });
  it('cannot win by guarding forever, and the dry reckless strategy is dangerous', () => {
    let guarded = createEndermanRun(), reckless = createEndermanRun();
    for (let i = 0; i < 16; i++) guarded = step(guarded, 'guard');
    expect(guarded).toMatchObject({ enemyHp: 36, phase: 'lost', handsLeft: 0, gauge: 0, hp: 0 });
    for (let i = 0; i < 16 && reckless.phase === 'battle'; i++) reckless = step(reckless, reckless.gauge === 3 ? 'ultimate' : 'strike');
    expect(reckless.phase).toBe('lost'); expect(reckless.pearls).toBe(0);
  });
  it('can still win dry with iron armor, a shield, two breads and careful guard/special timing', () => {
    let run = createEndermanRun({ item: 'shield' });
    for (let i = 0; i < 40 && run.phase === 'battle'; i++) {
      const mustGuard = run.intent === 'approach' || (run.intent === 'ambush' && run.hp <= endermanIncomingDamage(run));
      const kind = run.bread > 0 && run.hp <= 10 ? 'eat' : run.gauge === 3 ? 'ultimate' : mustGuard ? 'guard' : 'strike';
      const next = step(run, kind);
      if (next === run) break;
      run = next;
    }
    expect(run.phase).toBe('won'); expect(run.pearls).toBe(1);
    expect(run.hp).toBeGreaterThan(0); expect(run.turn).toBeLessThanOrEqual(16);
  });
  it.each(Array.from({ length: 12 }, (_, batch) => batch))('preserves resources, immutability, one-time loot and bounded HP across varied sessions: batch %i', batch => {
    const choices: EndermanAction[] = [{ kind: 'strike' }, { kind: 'guard' }, { kind: 'ultimate' }, { kind: 'eat' }, { kind: 'equip', item: 'water' }, { kind: 'equip', item: 'stone' }, { kind: 'equip', item: 'none' }, { kind: 'return' }];
    for (let seed = batch * 20 + 1; seed <= (batch + 1) * 20; seed++) {
      let rng = seed;
      const random = () => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng; };
      let run = createEndermanRun({ startHp: seed % 2 ? 'full' : 'half', item: seed % 3 ? 'none' : 'water', loadout: { sword: seed % 2 ? 'diamond' : 'netherite', armor: blazeFullArmor(seed % 3 ? 'iron' : 'diamond') } });
      for (let i = 0; i < 50; i++) {
        const action = choices[(random() >>> 16) % choices.length], before = structuredClone(run), result = actOnEnderman(run, action);
        expect(run).toEqual(before);
        if (result.error) { expect(result.state).toBe(run); expect(result.events).toEqual([]); }
        run = result.state;
        expect(run.hp).toBeGreaterThanOrEqual(0); expect(run.hp).toBeLessThanOrEqual(20);
        expect(run.enemyHp).toBeGreaterThanOrEqual(0); expect(run.enemyHp).toBeLessThanOrEqual(before.enemyHp);
        expect(run.tickets).toBeGreaterThanOrEqual(0); expect(run.tickets).toBeLessThanOrEqual(before.tickets);
        expect(run.handsLeft).toBeGreaterThanOrEqual(0); expect(run.handsLeft).toBeLessThanOrEqual(3);
        expect(run.bread).toBeGreaterThanOrEqual(0); expect(run.bread).toBeLessThanOrEqual(before.bread);
        expect(run.gauge).toBeGreaterThanOrEqual(0); expect(run.gauge).toBeLessThanOrEqual(3);
        expect(run.pearls).toBe(run.phase === 'won' ? 1 : 0);
        expect(result.events.filter(e => e.kind === 'hit').reduce((sum, e) => sum + e.amount, 0)).toBe(before.enemyHp - run.enemyHp);
        if (run.phase !== 'battle') expect(run.handsLeft).toBe(0);
      }
    }
  });
});
