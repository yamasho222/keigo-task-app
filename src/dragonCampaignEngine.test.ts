import { describe, expect, it } from 'vitest';
import { defaultEquipment, fullArmor, maxHp } from './campaignEquipment';
import {
  CAMPAIGN_ACTIONS, campaignCounterDamage, campaignIntent, createDragonCampaign, isDragonCampaign,
  refreshCampaignDay, stepDragonCampaign, type CampaignAction, type CampaignPhase, type DragonCampaign,
} from './dragonCampaignEngine';

function battle(): DragonCampaign {
  const s = createDragonCampaign('2026-10-17');
  s.status = 'battle'; s.supplies.materials.bread = 20; s.supplies.materials.spare_bed = 5;
  return s;
}
function final(phase: CampaignPhase = 'wings'): DragonCampaign {
  const s = battle(); s.crystals.fill(0); s.finalEntryHp = 1200; s.phase = phase;
  s.bodyHp = phase === 'rage' ? 400 : phase === 'orb' ? 800 : 1200; s.checkpointHp = s.bodyHp;
  return s;
}
const act = (s: DragonCampaign, action: CampaignAction) => {
  const before = JSON.stringify(s), result = stepDragonCampaign(s, action);
  expect(JSON.stringify(s)).toBe(before);
  expect(result.error).toBeUndefined(); expect(isDragonCampaign(result.state)).toBe(true);
  return result;
};
const rejected = (s: DragonCampaign, action: CampaignAction) => {
  const before = JSON.stringify(s), result = stepDragonCampaign(s, action);
  expect(result.error).toBeTruthy(); expect(result.state).toBe(s); expect(result.events).toEqual([]); expect(JSON.stringify(s)).toBe(before);
};

describe('Dragon campaign tickets, turn rules and allies', () => {
  it('starts with body selected, new armor and separate inventory', () => {
    const s = createDragonCampaign('2026-10-17');
    expect(isDragonCampaign(s)).toBe(true); expect(s.selected).toBe('body'); expect(s.bodyHp).toBe(1200);
    expect(s.equipment.armor.chest).toBe('diamond'); expect(s.hands).toBe(0);
  });
  it('buys exactly four actions, not one ticket per attack', () => {
    let s = final(); s.intentIndex = 2; s.equipment.armor = fullArmor('netherite');
    for (let i = 0; i < 4; i++) s = act(s, { kind: 'attack' }).state;
    expect(s.tickets).toBe(59); expect(s.hands).toBe(0);
    s = act(s, { kind: 'guard' }).state; expect(s.tickets).toBe(58); expect(s.hands).toBe(3);
  });
  it('adds companion power on ultimate only, without multiplying it in the opening', () => {
    const base = final(); base.intentIndex = 2;
    expect(act(base, { kind: 'attack' }).events.find(e => e.kind === 'hit')?.amount).toBe(4);
    expect(act(base, { kind: 'attack' }).events.some(e => e.kind === 'companion')).toBe(false);
    base.gauge = 3;
    expect(act(base, { kind: 'ultimate' }).events.find(e => e.kind === 'hit')?.amount).toBe(17);
    base.landingTurns = 2;
    const result = act(base, { kind: 'ultimate' });
    expect(result.events.find(e => e.kind === 'hit')?.amount).toBe(25);
    expect(result.events.find(e => e.kind === 'companion')?.amount).toBe(9);
    expect(result.state.landingTurns).toBe(1);
  });
  it('requires three normal attacks, and guard/healing do not charge the ultimate', () => {
    let s = final(); s.intentIndex = 2; s.hp = 10; s.equipment.armor = fullArmor('netherite');
    s = act(s, { kind: 'heal' }).state; expect(s.gauge).toBe(0);
    s = act(s, { kind: 'guard' }).state; expect(s.gauge).toBe(0);
    rejected(s, { kind: 'ultimate' });
    for (let i = 0; i < 3; i++) s = act(s, { kind: 'attack' }).state;
    expect(s.gauge).toBe(3);
    s = act(s, { kind: 'ultimate' }).state; expect(s.gauge).toBe(0);
  });
  it('rejects invalid targets/commands without buying a ticket', () => {
    const s = battle();
    rejected(s, { kind: 'select', target: 'crystal:99' });
    rejected(s, { kind: 'unknown' } as unknown as CampaignAction);
    s.selected = 'orb'; rejected(s, { kind: 'attack' });
    s.selected = 'body'; s.tickets = 0; rejected(s, { kind: 'guard' });
  });
});

describe('crystals, landing windows and final phases', () => {
  it('shows healing from living crystals without secretly changing the initial target', () => {
    const s = battle(), result = act(s, { kind: 'attack' });
    expect(result.state.bodyHp).toBe(1200); expect(result.state.selected).toBe('body');
    expect(result.events.find(e => e.kind === 'crystalHeal')?.amount).toBe(4);
  });
  it('does not let crystal healing undo a confirmed body checkpoint or corrupt a save', () => {
    const s = battle(); s.bodyHp = 1139; s.checkpointHp = 1140;
    const result = act(s, { kind: 'attack' });
    expect(result.state.bodyHp).toBe(1140); expect(result.events.find(e => e.kind === 'crystalHeal')?.amount).toBe(5);
    expect(result.state.checkpointHp).toBe(1140);
  });
  it('awards two safe actions after every pair, not after the first crystal', () => {
    let s = battle(); s.selected = 'crystal:0';
    let result = act(s, { kind: 'attack' }); expect(result.state.crystals[0]).toBe(0); expect(result.state.landingTurns).toBe(0);
    s = result.state; s.selected = 'crystal:1'; s.crystals[1] = 4;
    result = act(s, { kind: 'attack' }); expect(result.state.landingTurns).toBe(2); expect(result.state.selected).toBe('body');
    expect(result.events.some(e => e.kind === 'counter')).toBe(false);
    s = result.state; s.hp = 10; s = act(s, { kind: 'heal' }).state;
    expect(s.landingTurns).toBe(2); expect(s.safePreparation).toBe(false);
    s = act(s, { kind: 'attack' }).state; expect(s.landingTurns).toBe(1);
    s = act(s, { kind: 'attack' }).state; expect(s.landingTurns).toBe(0); expect(s.safePreparation).toBe(true);
  });
  it('halves protected inner crystals and opens them only after a real breath', () => {
    const s = battle(); s.selected = 'crystal:4'; s.intentIndex = 1;
    expect(act(s, { kind: 'attack' }).state.crystals[4]).toBe(26);
    s.intentIndex = 2;
    const result = act(s, { kind: 'guard' }); expect(result.state.barrierTurns).toBe(2);
    expect(act(result.state, { kind: 'attack' }).state.crystals[4]).toBe(24);
    s.gauge = 3;
    expect(act(s, { kind: 'ultimate' }).state.barrierTurns).toBe(0);
  });
  it('interrupts the whole prepared attack, not just the harmless charge step', () => {
    const s = final('rage'); s.intentIndex = 1; s.gauge = 3;
    const result = act(s, { kind: 'ultimate' }); expect(campaignIntent(result.state)).toBe('opening');
    expect(result.state.hp).toBe(s.hp); expect(result.events.some(e => e.kind === 'interrupt')).toBe(true);
  });
  it('snapshots final-entry HP once and never refills HP at transition', () => {
    const s = battle(); s.crystals.fill(0); s.crystals[7] = 4; s.barrierTurns = 2; s.bodyHp = 1000; s.selected = 'crystal:7';
    let result = act(s, { kind: 'attack' });
    expect(result.state.phase).toBe('wings'); expect(result.state.finalEntryHp).toBe(1000); expect(result.state.bodyHp).toBe(1000);
    const next = result.state; next.bodyHp = 670; next.checkpointHp = 720; next.selected = 'body'; next.landingTurns = 0; next.intentIndex = 3;
    result = act(next, { kind: 'attack' }); expect(result.state.phase).toBe('orb'); expect(result.state.bodyHp).toBe(666);
    expect(result.state.finalEntryHp).toBe(1000); expect(result.events.some(e => e.kind === 'counter')).toBe(false);
  });
  it('makes wings optional, while breaking one provides a window', () => {
    const s = final(); s.selected = 'wing:0'; s.wings[0] = 4;
    const result = act(s, { kind: 'attack' }); expect(result.state.wings[0]).toBe(0); expect(result.state.landingTurns).toBe(2);
    const skip = final(); skip.bodyHp = 804; skip.checkpointHp = 840;
    expect(act(skip, { kind: 'attack' }).state.phase).toBe('orb');
  });
  it('keeps a newly earned two-action landing when a second part breaks during a landing', () => {
    const s = final(); s.landingTurns = 1; s.wings = [0, 4]; s.selected = 'wing:1';
    const result = act(s, { kind: 'attack' });
    expect(result.state.landingTurns).toBe(2); expect(campaignIntent(result.state)).toBe('opening');
    expect(result.state.safePreparation).toBe(false); expect(result.state.safePending).toBe(true);
  });
  it('reflects an orb within two paid actions, and eating does not advance it', () => {
    const s = final('orb'); s.intentIndex = 1;
    let next = act(s, { kind: 'attack' }).state;
    expect(next.orbHp).toBe(8); expect(next.orbTurns).toBe(2);
    next.selected = 'orb'; next.hp = 10;
    next = act(next, { kind: 'heal' }).state; expect(next.orbTurns).toBe(2);
    next = act(next, { kind: 'attack' }).state; expect(next.orbHp).toBe(4); expect(next.orbTurns).toBe(1);
    const before = next.bodyHp, result = act(next, { kind: 'attack' });
    expect(result.state.bodyHp).toBe(before - 32); expect(result.state.orbHp).toBe(0);
    expect(result.events.some(e => e.kind === 'counter')).toBe(false);
  });
  it('lets an unbroken orb explode once and then disappear', () => {
    const s = final('orb'); s.orbHp = 8; s.orbTurns = 1; s.hp = 20;
    const result = act(s, { kind: 'guard' }); expect(result.state.orbHp).toBe(0);
    expect(result.events.find(e => e.kind === 'counter')?.intent).toBe('orbFire');
  });
});

describe('supplies, defeat, pause and calendar recovery', () => {
  it('heals without tickets or enemy actions, at most twice per day', () => {
    const s = battle(); s.tickets = 0; s.hp = 1;
    let next = act(s, { kind: 'heal' }).state;
    expect(next.hp).toBe(11); expect(next.hands).toBe(0); expect(next.turns).toBe(0); expect(next.intentIndex).toBe(s.intentIndex);
    next = act(next, { kind: 'heal' }).state; expect(next.hp).toBe(maxHp(next.equipment));
    next.hp = 1; rejected(next, { kind: 'heal' });
    const tomorrow = refreshCampaignDay(next, '2026-10-18'); expect(tomorrow.foodToday).toBe(0); expect(tomorrow.hp).toBe(maxHp(next.equipment));
    tomorrow.hp = 1; expect(refreshCampaignDay(tomorrow, '2026-10-18')).toBe(tomorrow);
    expect(refreshCampaignDay(tomorrow, '2026-10-17')).toBe(tomorrow);
    expect(refreshCampaignDay(tomorrow, '2026-02-31')).toBe(tomorrow);
  });
  it('uses at most three real beds, fixed damage without ally or enchant bonuses', () => {
    let s = final('rage'); s.equipment.attack = { kind: 'ultimate', rank: 3 }; s.gauge = 3;
    for (let i = 0; i < 3; i++) {
      const result = act(s, { kind: 'bed' }); expect(result.events.find(e => e.kind === 'bed')?.amount).toBe(60);
      expect(result.events.some(e => e.kind === 'companion')).toBe(false); expect(result.state.gauge).toBe(3); s = result.state;
    }
    expect(s.supplies.materials.spare_bed).toBe(2); rejected(s, { kind: 'bed' });
    const flying = battle(); rejected(flying, { kind: 'bed' });
  });
  it('preserves HP, intent, gauge and prepaid hands across pause/resume', () => {
    const s = final(); s.gauge = 2; s.hands = 3; s.landingTurns = 2;
    const paused = act(s, { kind: 'pause' }).state, resumed = act(paused, { kind: 'resume' }).state;
    for (const key of ['hp', 'bodyHp', 'intentIndex', 'gauge', 'hands', 'landingTurns', 'tickets'] as const) expect(resumed[key]).toEqual(s[key]);
    expect(resumed.status).toBe('battle');
  });
  it('loses only unfinished body progress, keeps broken parts, and includes four actions in retry', () => {
    const s = final(); s.bodyHp = 1150; s.checkpointHp = 1200; s.wings = [0, 20]; s.hp = 1; s.hands = 2; s.gauge = 2;
    const lost = act(s, { kind: 'attack' }).state;
    expect(lost.status).toBe('lost'); expect(lost.bodyHp).toBe(1200); expect(lost.wings).toEqual([0, 48]);
    expect(lost.hands).toBe(0); expect(lost.gauge).toBe(0); expect(lost.crystals).toEqual(Array(8).fill(0));
    const retried = act(lost, { kind: 'retry' }).state;
    expect(retried.hp).toBe(10); expect(retried.hands).toBe(CAMPAIGN_ACTIONS); expect(retried.tickets).toBe(lost.tickets - 1);
    expect(act(retried, { kind: 'guard' }).state.tickets).toBe(retried.tickets);
  });
  it('never heals by switching maximum-HP enchantments or buying stars', () => {
    const s = battle(); s.status = 'paused'; s.hp = 7;
    const equipment = structuredClone(s.equipment); equipment.defense.kind = 'health';
    const changed = act(s, { kind: 'equip', equipment }).state; expect(changed.hp).toBe(7);
  });
  it('blocks switching enchant types mid-segment, but allows a paid equipment swap', () => {
    const s = final(); s.status = 'paused'; s.safePreparation = false;
    let eq = structuredClone(s.equipment); eq.attack.kind = 'break'; rejected(s, { kind: 'equip', equipment: eq });
    eq = structuredClone(s.equipment); eq.shield = false;
    const changed = act(s, { kind: 'equip', equipment: eq }).state; expect(changed.tickets).toBe(s.tickets - 1); expect(changed.hands).toBe(3); expect(changed.intentIndex).toBe(s.intentIndex);
  });
  it('never awards the victory reward twice or counters after the killing blow', () => {
    const s = final('rage'); s.bodyHp = 4; s.checkpointHp = 60; s.hp = 1; s.intentIndex = 3;
    const result = act(s, { kind: 'attack' }); expect(result.state.status).toBe('won'); expect(result.state.supplies.owned.elytra).toBe(true);
    expect(result.events.some(e => e.kind === 'counter')).toBe(false); expect(result.events.filter(e => e.kind === 'victory')).toHaveLength(1);
    rejected(result.state, { kind: 'attack' });
  });
  it('gives guard a meaningful cost without charging the gauge', () => {
    const s = final('rage'); s.intentIndex = 3;
    const unguarded = campaignCounterDamage(s), result = act(s, { kind: 'guard' });
    expect(s.hp - result.state.hp).toBeLessThan(unguarded); expect(result.state.hands).toBe(3); expect(result.state.gauge).toBe(0);
  });
});

describe('save invariants and full actual-engine campaign', () => {
  it('rejects incompatible, malformed and inconsistent saves', () => {
    const good = createDragonCampaign('2026-10-17'); expect(isDragonCampaign(JSON.parse(JSON.stringify(good)))).toBe(true);
    for (const bad of [null, {}, { ...good, version: 0 }, { ...good, hp: NaN }, { ...good, hands: 5 }, { ...good, foodToday: 3 }, { ...good, crystals: [] }, { ...good, bodyHp: 0 }, { ...good, phase: 'rage' }, { ...good, orbHp: 8 }]) expect(isDragonCampaign(bad)).toBe(false);
    const eq = defaultEquipment(); eq.armor = fullArmor('netherite');
    const s = createDragonCampaign('2026-10-17', { equipment: eq }); expect(isDragonCampaign(s)).toBe(true);
  });
  it('completes every phase using only valid public actions and valid serializable state', () => {
    let s = battle(); s.tickets = 500; s.supplies.materials.bread = 100;
    const visited = new Set<CampaignPhase>(); let day = 17;
    for (let step = 0; step < 1500 && s.status !== 'won'; step++) {
      visited.add(s.phase);
      if (s.status === 'lost') { s = refreshCampaignDay(s, `2026-10-${String(++day).padStart(2, '0')}`); s = act(s, { kind: 'retry' }).state; continue; }
      if (step > 0 && step % 20 === 0) { const d = new Date(Date.UTC(2026, 9, 17 + Math.floor(step / 20))); s = refreshCampaignDay(s, d.toISOString().slice(0, 10)); }
      if (s.hp <= 10 && s.foodToday < 2) { s = act(s, { kind: 'heal' }).state; continue; }
      let target = 'body';
      if (s.landingTurns === 0 && s.phase === 'crystals') target = `crystal:${s.crystals.findIndex(h => h > 0)}`;
      if (s.landingTurns === 0 && s.phase === 'wings' && s.wings.some(h => h > 0)) target = `wing:${s.wings.findIndex(h => h > 0)}`;
      if (s.orbHp > 0) target = 'orb';
      if (s.selected !== target) s = act(s, { kind: 'select', target: target as DragonCampaign['selected'] }).state;
      const intent = campaignIntent(s);
      const kind = s.gauge === 3 ? 'ultimate' : ['breath', 'storm', 'orbFire'].includes(intent) ? 'guard' : 'attack';
      s = act(s, { kind }).state;
    }
    expect(s.status).toBe('won'); expect(visited).toEqual(new Set(['crystals', 'wings', 'orb', 'rage'])); expect(s.rewardClaimed).toBe(true);
  });
});
