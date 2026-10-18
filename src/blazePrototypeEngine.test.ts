import { describe, expect, it } from 'vitest';
import {
  actOnBlaze, BLAZE_ACTIONS_PER_TICKET, BLAZE_ARMOR_COST, blazeArmorReductionRate, blazeAttackDamage,
  blazeFullArmor, blazeIncomingDamage, createBlazeRun,
  type BlazeAction, type BlazeArmorSlot, type BlazeArmorTier, type BlazeLoadout, type BlazeRun,
} from './blazePrototypeEngine';

const body = (enemyId = 0): BlazeAction => ({ kind: 'strike', target: { enemyId, part: 'body' } });
const guard: BlazeAction = { kind: 'guard' };
const ultimate: BlazeAction = { kind: 'ultimate', enemyId: 0 };
const eat: BlazeAction = { kind: 'eat' };
const retreat: BlazeAction = { kind: 'return' };
const slots = Object.keys(BLAZE_ARMOR_COST) as BlazeArmorSlot[];
// Ordered by strength, not material name or crafting progression.
const tiers: BlazeArmorTier[] = ['none', 'gold', 'iron', 'diamond', 'netherite'];
const loadout = (tier: BlazeArmorTier = 'iron'): BlazeLoadout => ({ sword: 'diamond', armor: blazeFullArmor(tier) });

function expectRejected(state: BlazeRun, action: BlazeAction): void {
  const before = structuredClone(state);
  const result = actOnBlaze(state, action);
  expect(result.error).toBeTruthy();
  expect(result.state).toBe(state);
  expect(result.events).toEqual([]);
  expect(state).toEqual(before);
}

describe('armor and sword calculation', () => {
  it.each([
    ['none', 0, 4, 18], ['gold', 0.2, 4, 15], ['iron', 0.25, 3, 14],
    ['diamond', 0.4, 3, 11], ['netherite', 0.55, 2, 9],
  ] as const)('calculates the complete %s set without early rounding', (tier, rate, ember, burst) => {
    const equipment = loadout(tier);
    expect(blazeArmorReductionRate(equipment)).toBe(rate);
    expect(blazeIncomingDamage(equipment, 'ember')).toBe(ember);
    expect(blazeIncomingDamage(equipment, 'burst')).toBe(burst);
    expect(blazeIncomingDamage(equipment, 'charge')).toBe(0);
  });

  it('weights protection by material cost: chest > leggings > helmet > boots', () => {
    expect(BLAZE_ARMOR_COST).toEqual({ helmet: 5, chest: 8, leggings: 7, boots: 4 });
    const rates = (['chest', 'leggings', 'helmet', 'boots'] as const).map((slot) => {
      const equipment = loadout();
      equipment.armor[slot] = 'diamond';
      return blazeArmorReductionRate(equipment);
    });
    expect(rates).toEqual([0.3, 0.29375, 0.28125, 0.275]);
  });

  it('adds mixed pieces and rounds only the final incoming damage', () => {
    const equipment: BlazeLoadout = {
      sword: 'diamond', armor: { helmet: 'gold', chest: 'diamond', leggings: 'iron', boots: 'none' },
    };
    const points = 20 * 5 + 40 * 8 + 25 * 7;
    expect(blazeArmorReductionRate(equipment)).toBe(points / 2400);
    expect(blazeIncomingDamage(equipment, 'burst')).toBe(Math.ceil(18 * (2400 - points) / 2400));
    const mixed = loadout('none');
    mixed.armor.chest = 'diamond';
    mixed.armor.boots = 'netherite';
    expect(blazeIncomingDamage(mixed, 'burst')).toBe(14);
    const exact: BlazeLoadout = {
      sword: 'diamond', armor: { helmet: 'none', chest: 'netherite', leggings: 'gold', boots: 'netherite' },
    };
    // 800/2400 protection leaves exactly 12 damage; no floating-point overshoot.
    expect(blazeArmorReductionRate(exact)).toBe(800 / 2400);
    expect(blazeIncomingDamage(exact, 'burst')).toBe(12);
  });

  it('checks all 1,250 loadouts and every one-piece upgrade', () => {
    for (const sword of ['diamond', 'netherite'] as const) {
      for (const helmet of tiers) for (const chest of tiers) for (const leggings of tiers) for (const boots of tiers) {
        const equipment: BlazeLoadout = { sword, armor: { helmet, chest, leggings, boots } };
        const rate = blazeArmorReductionRate(equipment);
        expect(rate).toBeGreaterThanOrEqual(0);
        expect(rate).toBeLessThanOrEqual(0.55);
        for (const intent of ['ember', 'burst', 'charge'] as const) {
          const raw = intent === 'burst' ? 18 : intent === 'ember' ? 4 : 0;
          const damage = blazeIncomingDamage(equipment, intent);
          const fullRates = { none: 0, gold: 20, iron: 25, diamond: 40, netherite: 55 };
          const points = slots.reduce((sum, slot) => sum + fullRates[equipment.armor[slot]] * BLAZE_ARMOR_COST[slot], 0);
          expect(damage).toBe(Math.ceil(raw * (2400 - points) / 2400));
          expect(Number.isInteger(damage)).toBe(true);
          for (const slot of slots) {
            const nextTier = tiers[tiers.indexOf(equipment.armor[slot]) + 1];
            if (!nextTier) continue;
            const upgraded = { ...equipment, armor: { ...equipment.armor, [slot]: nextTier } };
            expect(blazeIncomingDamage(upgraded, intent)).toBeLessThanOrEqual(damage);
          }
        }
      }
    }
  });

  it.each([['diamond', 4, 8], ['netherite', 6, 12]] as const)('uses %s sword damage independently of armor', (sword, normal, special) => {
    for (const tier of tiers) {
      const equipment = { sword, armor: blazeFullArmor(tier) };
      expect(blazeAttackDamage(equipment)).toBe(normal);
      expect(blazeAttackDamage(equipment, true)).toBe(special);
    }
  });
});

describe('setup and action costs', () => {
  it('starts one 24-HP charging enemy with diamond sword and iron armor', () => {
    expect(createBlazeRun()).toMatchObject({
      hp: 20, maxHp: 20, tickets: 4, handsLeft: 0, bread: 2, gauge: 0, turn: 0,
      phase: 'battle', pendingRods: 0, securedRods: 0, loadout: loadout(),
      enemies: [{ id: 0, hp: 24, maxHp: 24, intent: 'charge', step: 0 }],
    });
    expect(createBlazeRun().enemies).toHaveLength(1);
    expect(createBlazeRun({ startHp: 'half' }).hp).toBe(10);
  });

  it('deep copies options, armor and all independent runs', () => {
    const equipment = loadout('diamond');
    const first = createBlazeRun({ loadout: equipment });
    const second = createBlazeRun({ loadout: equipment });
    equipment.armor.chest = 'none';
    expect(first.loadout.armor.chest).toBe('diamond');
    first.loadout.armor.boots = 'none';
    first.enemies[0].hp = 1;
    first.log.push('changed');
    expect(second.loadout.armor.boots).toBe('diamond');
    expect(second.enemies[0].hp).toBe(24);
    expect(second.log).toHaveLength(1);
  });

  it('buys four hands, counters every hand, and buys again only for the fifth action', () => {
    let state = actOnBlaze(createBlazeRun(), body()).state;
    expect(state).toMatchObject({ tickets: 3, handsLeft: 3, turn: 1, hp: 20, gauge: 1 });
    state = actOnBlaze(state, body()).state;
    expect(state).toMatchObject({ tickets: 3, handsLeft: 2, turn: 2, hp: 6, gauge: 2 });
    state = actOnBlaze(state, body()).state;
    expect(state).toMatchObject({ tickets: 3, handsLeft: 1, turn: 3, hp: 3, gauge: 3 });
    state = actOnBlaze(state, ultimate).state;
    expect(state).toMatchObject({ tickets: 3, handsLeft: 0, turn: 4, hp: 3, gauge: 0 });
    state = actOnBlaze(state, guard).state;
    expect(state).toMatchObject({ tickets: 2, handsLeft: 3, turn: 5, hp: 1 });
  });

  it.each([body(), guard, ultimate])('allows final prepaid action at zero tickets: %j', (action) => {
    const state = createBlazeRun();
    Object.assign(state, { tickets: 0, handsLeft: 1, gauge: 3 });
    const next = actOnBlaze(state, action).state;
    expect(next).toMatchObject({ tickets: 0, handsLeft: 0, turn: 1 });
    expectRejected(next, action);
  });

  it.each([body(99), ultimate, eat, { kind: 'strike' },
    { kind: 'strike', target: { enemyId: 0, part: 'fireball' } },
    { kind: 'unknown' },
  ])('rejects invalid actions without mutation or resources: %j', (action) => {
    expectRejected(createBlazeRun(), action as BlazeAction);
  });

  it('rejects attacks/guard with no living enemy or no paid action', () => {
    const state = createBlazeRun();
    state.enemies[0].hp = 0;
    for (const action of [body(), guard, ultimate]) expectRejected(state, action);
    const empty = createBlazeRun();
    Object.assign(empty, { tickets: 0, handsLeft: 0, gauge: 3 });
    for (const action of [body(), guard, ultimate]) expectRejected(empty, action);
  });

  it.each([body(), guard, eat, ultimate, retreat])('accepts frozen input and clones nested state: %j', (action) => {
    const state = createBlazeRun({ startHp: 'half' });
    state.gauge = 3;
    const before = structuredClone(state);
    Object.freeze(state.loadout.armor);
    Object.freeze(state.loadout);
    state.enemies.forEach(Object.freeze);
    Object.freeze(state.enemies);
    Object.freeze(state.log);
    Object.freeze(state);
    const result = actOnBlaze(state, action);
    expect(result.error).toBeUndefined();
    expect(state).toEqual(before);
    expect(result.state.loadout.armor).not.toBe(state.loadout.armor);
    expect(result.state.enemies[0]).not.toBe(state.enemies[0]);
    expect(result).toEqual(actOnBlaze(state, action));
  });
});

describe('guard and displayed enemy intents', () => {
  it.each([['ember', 'charge', 3], ['charge', 'burst', 0], ['burst', 'ember', 14]] as const)(
    'attacking %s takes shown damage and advances to %s', (intent, next, damage) => {
      const state = createBlazeRun();
      state.enemies[0].intent = intent;
      const result = actOnBlaze(state, body());
      expect(result.state.hp).toBe(20 - damage);
      expect(result.state.enemies[0]).toMatchObject({ hp: 20, intent: next, step: 1 });
      expect(result.events.filter((event) => event.kind === 'counter')).toEqual(
        damage ? [{ kind: 'counter', enemyId: 0, amount: damage }] : [],
      );
    },
  );

  it.each([['ember', 'charge', 3], ['charge', 'burst', 0], ['burst', 'ember', 14]] as const)(
    'guarding %s reduces damage but advances to %s', (intent, next, damage) => {
      const state = createBlazeRun();
      state.enemies[0].intent = intent;
      state.gauge = 2;
      expect(blazeIncomingDamage(state.loadout, intent)).toBe(damage);
      const result = actOnBlaze(state, guard);
      const received = blazeIncomingDamage(state.loadout, intent, true);
      expect(result.state).toMatchObject({ hp: 20 - received, gauge: 2, tickets: 3, handsLeft: 3, turn: 1 });
      expect(result.state.enemies[0]).toMatchObject({ hp: 24, intent: next, step: 1 });
      expect(result.events).toEqual([{ kind: 'guard', enemyId: 0, amount: blazeIncomingDamage(state.loadout, intent) - received }, ...(received ? [{ kind: 'counter', enemyId: 0, amount: received }] : [])]);
    },
  );

  it('guard spam cannot gain health, enemy damage, gauge or free actions', () => {
    let state = createBlazeRun({ startHp: 'half' });
    for (let turn = 1; turn <= 4 * BLAZE_ACTIONS_PER_TICKET; turn += 1) {
      if (state.phase !== 'battle') break;
      const hpBefore = state.hp;
      state = actOnBlaze(state, guard).state;
      expect(state).toMatchObject({ gauge: 0, turn, bread: 2 });
      expect(state.hp).toBeLessThanOrEqual(hpBefore);
      expect(state.enemies[0].hp).toBe(24);
    }
    expect(state).toMatchObject({ hp: 0, handsLeft: 0, phase: 'lost' });
    expectRejected(state, guard);
  });

  it('caps the normal attack gauge at three', () => {
    const state = createBlazeRun();
    state.gauge = 3;
    expect(actOnBlaze(state, body()).state.gauge).toBe(3);
  });
});

describe('bread and ultimate', () => {
  it.each(['iron', 'diamond'] as const)('basic-attack spam is not the winning aggressive policy with %s armor', (tier) => {
    let state = createBlazeRun({ loadout: { sword: 'diamond', armor: blazeFullArmor(tier) } });
    for (let step = 0; step < 8 && state.phase === 'battle'; step += 1) {
      const result = actOnBlaze(state, body());
      expect(result.error).toBeUndefined();
      state = result.state;
    }
    expect(state.phase).toBe('lost');
    expect(state.enemies[0].hp).toBeGreaterThan(0);
    expect(state.gauge).toBe(3);
  });
  it('does not waste bread when no paid or prepaid action remains', () => {
    const state = createBlazeRun({ startHp: 'half' });
    Object.assign(state, { tickets: 0, handsLeft: 0 });
    expectRejected(state, { kind: 'eat' });
  });
  it.each([[2, 12, 10], [15, 20, 5]] as const)('heals %i to %i for %i without changing hands or intent', (hp, next, healed) => {
    const state = createBlazeRun();
    Object.assign(state, { hp, tickets: 0, handsLeft: 1, gauge: 3, turn: 7 });
    const result = actOnBlaze(state, eat);
    expect(result.state).toMatchObject({ hp: next, bread: 1, tickets: 0, handsLeft: 1, gauge: 3, turn: 7 });
    expect(result.state.enemies).toEqual(state.enemies);
    expect(result.events).toEqual([{ kind: 'heal', amount: healed }]);
  });

  it('allows only two loaves and rejects no bread, full health or zero HP', () => {
    let state = createBlazeRun();
    expectRejected(state, eat);
    state.hp = 1;
    state = actOnBlaze(state, eat).state;
    state = actOnBlaze(state, eat).state;
    expect(state).toMatchObject({ hp: 20, bread: 0, tickets: 4, handsLeft: 0, turn: 0 });
    state.hp = 19;
    expectRejected(state, eat);
    state.hp = 0;
    state.bread = 1;
    expectRejected(state, eat);
  });

  it.each(['diamond', 'netherite'] as const)('ultimate with %s cancels counter and resets next intent', (sword) => {
    const state = createBlazeRun({ loadout: { sword, armor: blazeFullArmor('iron') } });
    Object.assign(state, { gauge: 3, tickets: 0, handsLeft: 1 });
    state.enemies[0].intent = 'burst';
    const damage = sword === 'diamond' ? 8 : 12;
    const result = actOnBlaze(state, ultimate);
    expect(result.state).toMatchObject({ hp: 20, gauge: 0, tickets: 0, handsLeft: 0, turn: 1 });
    expect(result.state.enemies[0]).toMatchObject({ hp: 24 - damage, intent: 'ember', step: 1 });
    expect(result.events).toEqual([{ kind: 'ultimate', enemyId: 0, amount: damage }]);
  });

  it('ultimate can buy hands and caps actual damage at remaining HP', () => {
    const state = createBlazeRun();
    state.gauge = 3;
    state.enemies[0].hp = 2;
    const result = actOnBlaze(state, ultimate);
    expect(result.state).toMatchObject({ tickets: 3, handsLeft: 3, phase: 'won', securedRods: 1 });
    expect(result.events).toEqual([{ kind: 'ultimate', enemyId: 0, amount: 2 }, { kind: 'kill', enemyId: 0, amount: 1 }]);
  });
});

describe('end, loot and invariants', () => {
  it('return secures pending loot once without refunds or advancing intent', () => {
    const state = createBlazeRun();
    Object.assign(state, { pendingRods: 1, securedRods: 2, tickets: 0, handsLeft: 1 });
    const result = actOnBlaze(state, retreat);
    expect(result.state).toMatchObject({ phase: 'returned', pendingRods: 0, securedRods: 3, tickets: 0, handsLeft: 0, turn: 0 });
    expect(result.state.enemies).toEqual(state.enemies);
    expect(result.events).toEqual([]);
    expectRejected(result.state, retreat);
  });
  it.each([1, 2, 3])('forfeits %i unused prepaid actions on return without refunding a ticket', (handsLeft) => {
    const state = createBlazeRun(); Object.assign(state, { tickets: 3, handsLeft });
    const result = actOnBlaze(state, retreat);
    expect(result.state).toMatchObject({ tickets: 3, handsLeft: 0, phase: 'returned' });
    expect(state.handsLeft).toBe(handsLeft);
  });

  it('loss clamps HP and drops pending, not secured loot', () => {
    const state = createBlazeRun();
    Object.assign(state, { hp: 2, pendingRods: 1, securedRods: 2 });
    state.enemies[0].intent = 'burst';
    const result = actOnBlaze(state, body());
    expect(result.state).toMatchObject({ hp: 0, phase: 'lost', pendingRods: 0, securedRods: 2, handsLeft: 0 });
    expect(result.events).toContainEqual({ kind: 'counter', enemyId: 0, amount: 14 });
  });

  it('a normal kill grants one rod once, keeps unused hands and prevents final counter', () => {
    const state = createBlazeRun();
    state.hp = 1;
    state.enemies[0].hp = 4;
    state.enemies[0].intent = 'burst';
    const result = actOnBlaze(state, body());
    expect(result.state).toMatchObject({ phase: 'won', hp: 1, securedRods: 1, pendingRods: 0, handsLeft: 3 });
    expect(result.events).toEqual([{ kind: 'slash', enemyId: 0, amount: 4 }, { kind: 'kill', enemyId: 0, amount: 1 }]);
    expectRejected(result.state, body());
    expectRejected(result.state, retreat);
    expect(actOnBlaze(createBlazeRun(), body()).state.securedRods).toBe(0);
  });

  it.each(['won', 'lost', 'returned'] as const)('rejects every action after %s', (phase) => {
    const state = createBlazeRun();
    Object.assign(state, { phase, hp: 10, gauge: 3 });
    for (const action of [body(), guard, ultimate, eat, retreat]) expectRejected(state, action);
  });

  it('retains only eight latest log entries', () => {
    const state = createBlazeRun();
    state.log = Array.from({ length: 8 }, (_, i) => `old ${i}`);
    expect(actOnBlaze(state, body()).state.log).toHaveLength(8);
    expect(actOnBlaze(state, body()).state.log).not.toContain('old 0');
    expect(state.log[0]).toBe('old 0');
  });

  it('preserves resource bounds and input immutability across varied sequences', () => {
    const actions = [body(), body(1), guard, ultimate, eat, retreat];
    let seed = 42;
    for (let trial = 0; trial < 100; trial += 1) {
      let state = createBlazeRun();
      for (let step = 0; step < 30; step += 1) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const before = structuredClone(state);
        const result = actOnBlaze(state, actions[(seed >>> 16) % actions.length]);
        expect(state).toEqual(before);
        state = result.state;
        expect(state.hp).toBeGreaterThanOrEqual(0);
        expect(state.hp).toBeLessThanOrEqual(20);
        expect(state.tickets).toBeGreaterThanOrEqual(0);
        expect(state.tickets).toBeLessThanOrEqual(before.tickets);
        expect(Number.isInteger(state.handsLeft)).toBe(true);
        expect(state.handsLeft).toBeGreaterThanOrEqual(0);
        expect(state.handsLeft).toBeLessThan(BLAZE_ACTIONS_PER_TICKET);
        expect(state.gauge).toBeGreaterThanOrEqual(0);
        expect(state.gauge).toBeLessThanOrEqual(3);
        expect(state.bread).toBeGreaterThanOrEqual(0);
        expect(state.bread).toBeLessThanOrEqual(before.bread);
        expect(state.pendingRods + state.securedRods).toBeLessThanOrEqual(state.enemies[0].hp === 0 ? 1 : 0);
        expect(state.securedRods).toBeGreaterThanOrEqual(before.securedRods);
        if (state.phase === 'lost' || state.phase === 'returned') expect(state.handsLeft).toBe(0);
      }
    }
  });
});
