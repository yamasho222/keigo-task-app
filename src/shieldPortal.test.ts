import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { actOnBlaze, blazeFullArmor, blazeIncomingDamage, createBlazeRun, type BlazeArmorTier } from './blazePrototypeEngine';
import { actOnEnderman, createEndermanRun, endermanIncomingDamage } from './endermanPrototypeEngine';
import { emptyEndQuest, applyEndQuestOnVisit, insertPortalEye, prepareEndSearch } from './endChapter';
import { equipHeld, refreshUnlocks, tryCraft } from './miningProgress';
import { MINING_RECIPES, craftGridForRecipe, craftRecipeTabOf } from './miningRecipes';
import { normalizeMiningState } from './miningTypes';
import { rebaseMiningWrite } from './miningCommit';
import { journeyLabStepSeed } from './endJourneyLabState';
import { portalEyeSlots } from './endJourneyProgress';
import { EndPortalPanel } from './EndPortalPanel';

describe('partial guard with armor, held shield and water', () => {
  it('rounds only once, after armor and guard, without passive shield protection', () => {
    const armor = blazeFullArmor('iron'), loadout = { sword: 'diamond' as const, armor };
    expect(blazeIncomingDamage(loadout, 'burst')).toBe(14);
    expect(blazeIncomingDamage(loadout, 'burst', true)).toBe(7);
    expect(blazeIncomingDamage(loadout, 'burst', true, true)).toBe(3);
    expect(blazeIncomingDamage(loadout, 'burst', false, true)).toBe(14);
    const diamond = { ...loadout, armor: blazeFullArmor('diamond') };
    // ceil(4 × .75 × .2) = 1: the shield is applied to remaining, not raw damage.
    expect(blazeIncomingDamage(loadout, 'ember', true)).toBe(2);
    expect(blazeIncomingDamage(loadout, 'ember', true, true)).toBe(1);
    expect(blazeIncomingDamage(diamond, 'burst', true, true)).toBe(3);
    const run = { ...createEndermanRun({ loadout: diamond }), intent: 'approach' as const };
    expect(endermanIncomingDamage(run)).toBe(10);
    expect(endermanIncomingDamage(run, true)).toBe(5);
    expect(endermanIncomingDamage({ ...run, item: 'shield' }, true)).toBe(2);
    expect(endermanIncomingDamage({ ...run, item: 'shield' })).toBe(10);
    expect(endermanIncomingDamage({ ...run, item: 'water' })).toBe(1);
    expect(endermanIncomingDamage({ ...run, item: 'water' }, true)).toBe(1);
  });
  it('checks all 625 mixed armor sets and every attack/guard combination against an independent formula', () => {
    const tiers: BlazeArmorTier[] = ['none', 'gold', 'iron', 'diamond', 'netherite'];
    const rates = { none: 0, gold: 20, iron: 25, diamond: 40, netherite: 55 };
    for (const helmet of tiers) for (const chest of tiers) for (const leggings of tiers) for (const boots of tiers) {
      const loadout = { sword: 'diamond' as const, armor: { helmet, chest, leggings, boots } };
      const remainingArmor = 2400 - (rates[helmet] * 5 + rates[chest] * 8 + rates[leggings] * 7 + rates[boots] * 4);
      for (const guarding of [false, true]) for (const shield of [false, true]) {
        const cut = guarding ? shield ? 2 : 5 : 10;
        for (const [intent, raw] of [['ember', 4], ['burst', 18], ['charge', 0]] as const)
          expect(blazeIncomingDamage(loadout, intent, guarding, shield)).toBe(Math.ceil(raw * remainingArmor * cut / 24000));
      }
      for (const item of ['none', 'stone', 'shield', 'water'] as const) for (const guarding of [false, true]) {
        const run = createEndermanRun({ loadout, item });
        const cut = guarding ? item === 'shield' ? 2 : 5 : 10;
        for (const [intent, raw] of [['approach', 16], ['ambush', 18], ['warp', 0], ['opening', 0]] as const)
          expect(endermanIncomingDamage({ ...run, intent }, guarding)).toBe(Math.ceil(raw * remainingArmor * cut / (item === 'water' ? 240000 : 24000)));
      }
    }
  });
  it.each(['none', 'shield'] as const)('guard actually receives the calculated damage with %s held', item => {
    const before = createBlazeRun({ item }); before.enemies[0].intent = 'burst';
    const copy = structuredClone(before), result = actOnBlaze(before, { kind: 'guard' });
    expect(before).toEqual(copy);
    expect(result.state.hp).toBe(20 - blazeIncomingDamage(before.loadout, 'burst', true, item === 'shield'));
    expect(result.events.some(e => e.kind === 'counter')).toBe(true);
    expect(result.state.gauge).toBe(0);
  });
  it.each(['none', 'shield', 'water'] as const)('Enderman guard applies the calculated %s damage, without gaining charge', item => {
    const before = { ...createEndermanRun({ item }), intent: 'approach' as const, gauge: 2 };
    const snapshot = structuredClone(before), result = actOnEnderman(before, { kind: 'guard' });
    expect(before).toEqual(snapshot);
    expect(result.state.hp).toBe(before.hp - endermanIncomingDamage(before, true));
    expect(result.state).toMatchObject({ gauge: 2, enemyHp: 36, turn: 1, handsLeft: 3, tickets: 3, intent: 'warp' });
    expect(result.events.find(e => e.kind === 'counter')?.amount).toBe(endermanIncomingDamage(before, true));
  });
});

describe('held item changes cost exactly one action, never a counter or intent reroll', () => {
  it.each([0, 1, 2, 3])('Blaze funds an equip change with %i prepaid actions', handsLeft => {
    const before = { ...createBlazeRun(), hp: 9, gauge: 2, handsLeft, tickets: handsLeft ? 0 : 1 };
    before.enemies[0].intent = 'burst';
    const snapshot = structuredClone(before), result = actOnBlaze(before, { kind: 'equip', item: 'shield' });
    expect(before).toEqual(snapshot); expect(result.error).toBeUndefined(); expect(result.events).toEqual([]);
    expect(result.state).toMatchObject({ item: 'shield', hp: 9, gauge: 2, turn: 1, handsLeft: handsLeft ? handsLeft - 1 : 3, tickets: 0 });
    expect(result.state.enemies).toEqual(before.enemies);
    expect(actOnBlaze(result.state, { kind: 'equip', item: 'shield' }).state).toBe(result.state);
  });
  it.each([0, 1, 2, 3])('Enderman funds an equip change with %i prepaid actions', handsLeft => {
    const before = { ...createEndermanRun({ item: 'water' }), intent: 'ambush' as const, hp: 9, gauge: 2, handsLeft, tickets: handsLeft ? 0 : 1 };
    const snapshot = structuredClone(before), result = actOnEnderman(before, { kind: 'equip', item: 'shield' });
    expect(before).toEqual(snapshot); expect(result.error).toBeUndefined(); expect(result.events).toEqual([]);
    expect(result.state).toMatchObject({ item: 'shield', hp: 9, gauge: 2, turn: 1, handsLeft: handsLeft ? handsLeft - 1 : 3, tickets: 0, intent: 'ambush', enemyHp: 36 });
    expect(actOnEnderman(result.state, { kind: 'equip', item: 'shield' }).state).toBe(result.state);
    // Switching removed the bucket's attack bonus and passive protection.
    expect(endermanIncomingDamage(result.state)).toBe(14);
  });
  it('rejects unpaid or invalid changes atomically in both engines', () => {
    const b = { ...createBlazeRun(), tickets: 0, handsLeft: 0 };
    const e = { ...createEndermanRun(), tickets: 0, handsLeft: 0 };
    expect(actOnBlaze(b, { kind: 'equip', item: 'shield' })).toMatchObject({ state: b, events: [] });
    expect(actOnBlaze(b, { kind: 'equip', item: 'shield' }).error).toBeTruthy();
    expect(actOnEnderman(e, { kind: 'equip', item: 'shield' }).error).toBeTruthy();
    expect(actOnBlaze(b, { kind: 'equip', item: 'water' } as never).error).toBeTruthy();
    expect(actOnBlaze(b, { kind: 'equip', item: 'none' }).state).toBe(b);
    expect(actOnEnderman(e, { kind: 'equip', item: 'none' }).state).toBe(e);
  });
  it('still lets a special cancel the counter with and without the shield', () => {
    for (const item of ['none', 'shield'] as const) {
      const b = { ...createBlazeRun({ item }), gauge: 3 }; b.enemies[0].intent = 'burst';
      expect(actOnBlaze(b, { kind: 'ultimate', enemyId: 0 }).state.hp).toBe(20);
      const e = { ...createEndermanRun({ item }), gauge: 3, intent: 'ambush' as const };
      expect(actOnEnderman(e, { kind: 'ultimate' }).state.hp).toBe(20);
    }
  });
});

describe('crafting and held-slot persistence', () => {
  const recipe = MINING_RECIPES.find(r => r.id === 'shield_craft')!;
  it('crafts one shield from six planks and one iron, with a workbench, without tickets or HP changes', () => {
    const before = journeyLabStepSeed('craft'), snapshot = structuredClone(before);
    const result = tryCraft(before, recipe);
    expect(before).toEqual(snapshot); expect(result.error).toBeUndefined();
    expect(result.state.materials).toMatchObject({ shield: 1, plank: 0, iron_ingot: 0, blaze_rod: 6, ender_pearl: 12 });
    expect(result.state.tickets).toBe(before.tickets); expect(result.state.playerHp).toBe(before.playerHp);
    expect(craftRecipeTabOf(recipe)).toBe('armor');
    expect(craftGridForRecipe(recipe)?.filter(i => i === 'plank')).toHaveLength(6);
    expect(craftGridForRecipe(recipe)?.filter(i => i === 'iron_ingot')).toHaveLength(1);
    const equipped = equipHeld(result.state, 'shield');
    const loaded = refreshUnlocks(normalizeMiningState(JSON.parse(JSON.stringify(equipped))));
    expect(loaded.equipped.held).toBe('shield'); expect(loaded.materials.shield).toBe(1);
    expect(equipHeld(before, 'shield')).toBe(before);
  });
  it('rejects missing workbench, planks or iron without partial cost', () => {
    const base = journeyLabStepSeed('craft');
    for (const s of [{ ...base, crafted: {} }, { ...base, materials: { ...base.materials, plank: 5 } }, { ...base, materials: { ...base.materials, iron_ingot: 0 } }]) {
      const snapshot = structuredClone(s), result = tryCraft(s, recipe);
      expect(result.error).toBeTruthy(); expect(result.state).toBe(s); expect(s).toEqual(snapshot);
    }
  });
});

describe('five search stops and twelve individually saved portal frames', () => {
  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])('migrates %i old inserted eyes without giving or consuming inventory', eyes => {
    const base = journeyLabStepSeed('portal');
    const s = { ...base, endQuest: { ...emptyEndQuest(), routeVersion: 2, eyes, foundPortal: true } };
    const migrated = prepareEndSearch(s);
    expect(migrated.materials).toBe(s.materials); expect(migrated.tickets).toBe(s.tickets);
    expect(migrated.endQuest?.eyeSlots).toEqual(Array.from({ length: eyes }, (_, i) => i));
    expect(prepareEndSearch(migrated)).toBe(migrated);
  });
  it('preserves an old completed three-stop route, while a new three-stop route must continue to five', () => {
    const s = journeyLabStepSeed('search');
    const visited = ['wood', 'farm', 'ranch'] as const;
    const old = prepareEndSearch({ ...s, endQuest: { ...emptyEndQuest(), routeVersion: 2, visited: [...visited] } });
    expect(old.endQuest?.foundPortal).toBe(true);
    let fresh = equipHeld(s, 'ender_eye');
    for (let i = 0; i < 5; i++) {
      expect(fresh.endQuest?.foundPortal).toBe(false);
      fresh = applyEndQuestOnVisit(fresh, fresh.endQuest!.mark!, () => 0).state;
    }
    expect(fresh.endQuest?.foundPortal).toBe(true);
  });
  it('fills the tapped frame, remembers arbitrary order across reloads, and blocks duplicate/invalid slots atomically', () => {
    let s = journeyLabStepSeed('portal');
    const order = [11, 4, 7, 0, 8, 2, 3, 9, 6, 5, 10, 1];
    for (const [n, slot] of order.entries()) {
      const before = s, snapshot = structuredClone(s), result = insertPortalEye(s, slot);
      expect(result.inserted).toBe(true); expect(before).toEqual(snapshot);
      s = refreshUnlocks(normalizeMiningState(JSON.parse(JSON.stringify(result.state))));
      expect(s.endQuest?.eyes).toBe(n + 1); expect(s.endQuest?.eyeSlots).toEqual(order.slice(0, n + 1));
      expect(s.endQuest?.lastEyeSlot).toBe(slot); expect(s.materials.ender_eye ?? 0).toBe(11 - n);
      if (n < 11) for (const bad of [slot, -1, 12, 1.5, NaN]) {
        const rejected = insertPortalEye(s, bad);
        expect(rejected.inserted).toBe(false); expect(rejected.state).toBe(s); expect(rejected.error).toBeTruthy();
      }
    }
    expect(s.endQuest?.linked).toBe(true); expect(insertPortalEye(s, 0).inserted).toBe(false);
  });
  it('does not double-charge a stale insertion, even when it targeted another frame', () => {
    const before = journeyLabStepSeed('portal');
    const first = insertPortalEye(before, 8).state, stale = insertPortalEye(before, 2).state;
    expect(rebaseMiningWrite(first, before, stale)).toBe(first);
    expect(portalEyeSlots(first.endQuest!)).toEqual([8]);
  });
  it('sanitizes corrupt duplicate frame positions while retaining the saved eye count', () => {
    const base = journeyLabStepSeed('portal');
    // Keep a deliberately malformed string from stored JSON at runtime.
    const loaded = prepareEndSearch(normalizeMiningState({ ...base, endQuest: { ...base.endQuest!, eyes: 4, eyeSlots: [9, 9, -1, 99, 2.5, '3' as unknown as number, 2] } }));
    expect(loaded.endQuest?.eyes).toBe(4); expect(loaded.endQuest?.eyeSlots).toEqual([9, 2, 0, 1]);
  });
  it('renders the actual selected filled image and disables just that frame, not a different empty one', () => {
    const mining = insertPortalEye(journeyLabStepSeed('portal'), 8).state;
    const html = renderToStaticMarkup(createElement(EndPortalPanel, { mining, shaking: false, insertPulse: 1, onInsert() {}, onUnlockTheEnd() {} }));
    expect(html).toMatch(/aria-label="枠9、アイがはまっている" disabled=""/);
    expect(html).toContain('aria-label="アイをはめる 枠1"');
    expect(html).toContain('/mining/End_Portal_Frame_Filled.webp');
    expect(html).toContain('ひかる わくを タップ！');
  });
});
