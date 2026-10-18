import { describe, expect, it } from 'vitest';
import { enableDragonCritical, nextDragonCritical } from './dragonCriticalRules';
import { createDragonCampaign, isDragonCampaign, refreshCampaignDay, stepDragonCampaign, type DragonCampaign } from './dragonCampaignEngine';
import { enableDragonAdventure } from './dragonCampaignAdventure';
import { enableDragonSkills } from './dragonSkillRules';
import { buildCampaignPlayback } from './dragonCampaignPlayback';
import { dragonBalanceEquipment, simulateDragonCampaign } from './dragonCampaignBalance';

function battle(hit = true): DragonCampaign {
  const state = enableDragonCritical(createDragonCampaign('2026-10-18'));
  state.status = 'battle'; state.phase = 'wings'; state.crystals.fill(0); state.finalEntryHp = 1200;
  state.supplies.materials.bread = 2; state.supplies.materials.spare_bed = 3;
  let seed = 1;
  while (nextDragonCritical({ version: 1, seed }).hit !== hit) seed++;
  state.critical!.seed = seed;
  return state;
}
const damage = (s: DragonCampaign) => stepDragonCampaign(s, { kind: 'attack' });
const hitAmount = (s: DragonCampaign) => damage(s).events.find(event => event.kind === 'hit')!.amount;

describe('persisted Dragon normal-attack criticals', () => {
  it('has a stable independent 10% stream over 100,000 draws', () => {
    let state = { version: 1 as const, seed: 123456 }, count = 0;
    for (let i = 0; i < 100000; i++) { const roll = nextDragonCritical(state); state = roll.state; count += Number(roll.hit); }
    expect(count / 100000).toBeGreaterThan(.098); expect(count / 100000).toBeLessThan(.102);
  });
  it('upgrades old isolated trial saves without changing progress or reseeding', () => {
    const old = createDragonCampaign('2026-10-18'); const upgraded = enableDragonCritical(old);
    expect(upgraded.critical).toBeDefined(); expect(old.critical).toBeUndefined();
    expect(enableDragonCritical(upgraded)).toBe(upgraded);
    const { critical: _critical, ...unchanged } = upgraded; void _critical;
    expect(unchanged).toEqual(old); expect(isDragonCampaign(old)).toBe(true); expect(isDragonCampaign(upgraded)).toBe(true);
  });
  it('doubles only the base sword on a normal hit; one ticket still buys four actions', () => {
    const before = battle(), result = damage(before);
    expect(result.events.find(event => event.kind === 'critical')?.amount).toBe(4);
    expect(result.events.find(event => event.kind === 'hit')?.amount).toBe(8);
    expect(result.state.tickets).toBe(before.tickets - 1); expect(result.state.hands).toBe(3);
    expect(result.state.turns).toBe(1); expect(result.events.filter(event => event.kind === 'counter')).toHaveLength(1);
    expect(before.critical).not.toEqual(result.state.critical); expect(isDragonCampaign(result.state)).toBe(true);
  });
  it('does not change a missed critical into extra damage', () => { expect(hitAmount(battle(false))).toBe(4); });
  it('keeps bonus damage additive with landing and riposte (4+4+4+4), never 8x', () => {
    const before = enableDragonAdventure(battle()); before.landingTurns = 2; before.adventure!.counter = true;
    expect(hitAmount(before)).toBe(16);
  });
  it('keeps focused-wing damage additive and caps overkill', () => {
    const before = enableDragonAdventure(battle()); before.selected = 'wing:0';
    expect(hitAmount(before)).toBe(12);
    before.wings[0] = 3; expect(hitAmount(before)).toBe(3);
  });
  it('halves protected crystal damage AFTER critical calculation', () => {
    const before = battle(); before.phase = 'crystals'; before.finalEntryHp = null; before.crystals.fill(28); before.crystals[0] = 4; before.crystals[1] = before.crystals[2] = before.crystals[3] = 20;
    before.selected = 'crystal:4';
    expect(hitAmount(before)).toBe(4);
  });
  it('leaves all buddies unmultiplied and presents their rolled total later', () => {
    const before = enableDragonSkills(battle()), result = damage(before);
    const helper = result.events.find(event => event.kind === 'companion')!;
    expect(helper.allies).toHaveLength(3);
    expect(result.events.find(event => event.kind === 'hit')?.amount).toBe(8 + helper.amount);
    const playback = buildCampaignPlayback(before, result.state, { kind: 'attack' }, result.events);
    expect(playback.frames.find(frame => frame.stage === 'impact')?.shown.bodyHp).toBe(1192);
    expect(playback.frames.filter(frame => frame.stage === 'assistImpact').at(-1)?.shown.bodyHp).toBe(1192 - helper.amount);
  });
  it('does not invent a buddy hit after the sword already destroyed a part', () => {
    const before = enableDragonSkills(battle()); before.selected = 'wing:0'; before.wings[0] = 8;
    expect(damage(before).events.some(event => event.kind === 'companion')).toBe(false);
  });
  it('reflects a critical-destroyed orb once and cancels its enemy attack', () => {
    const before = battle(); before.phase = 'orb'; before.bodyHp = 800; before.checkpointHp = 800; before.orbHp = 8; before.orbTurns = 1; before.selected = 'orb';
    const result = damage(before);
    expect(result.events.filter(event => event.kind === 'orbReflect')).toHaveLength(1);
    expect(result.events.some(event => event.kind === 'counter')).toBe(false);
    expect(result.state.bodyHp).toBe(768);
  });
  it('replays the identical outcome after save/reload, including the next roll', () => {
    const before = battle(); const frozen = JSON.stringify(before), result = damage(before);
    expect(JSON.stringify(before)).toBe(frozen);
    expect(damage(JSON.parse(frozen))).toEqual(result);
    expect(damage(JSON.parse(JSON.stringify(result.state)))).toEqual(damage(result.state));
  });
  it.each(['guard', 'heal', 'pause', 'ultimate', 'bed'] as const)('%s never advances the critical stream', kind => {
    const before = battle(); before.gauge = 3; before.hp = 10; before.landingTurns = 2;
    const result = stepDragonCampaign(before, { kind });
    expect(result.error).toBeUndefined(); expect(result.state.critical).toEqual(before.critical);
    expect(result.events.some(event => event.kind === 'critical')).toBe(false);
  });
  it('rejects an invalid attack without consuming a draw or a ticket', () => {
    const before = battle(); before.tickets = 0;
    const result = damage(before); expect(result.error).toBeTruthy(); expect(result.state).toBe(before); expect(result.events).toEqual([]);
  });
  it('day recovery and target selection preserve the stream', () => {
    const before = battle();
    expect(refreshCampaignDay(before, '2026-10-19').critical).toEqual(before.critical);
    expect(stepDragonCampaign(before, { kind: 'select', target: 'wing:0' }).state.critical).toEqual(before.critical);
  });
  it('a scored ultimate does not crit or advance the stream', () => {
    let before = enableDragonSkills(battle()); before.gauge = 3;
    before = stepDragonCampaign(before, { kind: 'beginSkill' }).state;
    before = stepDragonCampaign(before, { kind: 'chooseSkill', token: before.skills!.pending!.token, mode: 'burst' }).state;
    const result = stepDragonCampaign(before, { kind: 'releaseSkill', token: before.skills!.pending!.token, score: 100 });
    expect(result.error).toBeUndefined(); expect(result.state.critical).toEqual(before.critical);
    expect(result.events.some(event => event.kind === 'critical')).toBe(false);
  });
  it('finishes representative complete campaigns without inflating HP to cancel criticals', () => {
    const rows = ([['mixed', 0], ['diamond', 3], ['netherite', 3]] as const).map(([tier, rank]) => {
      const equipment = dragonBalanceEquipment(tier, rank);
      const baseline = simulateDragonCampaign(equipment, 5, true, 50);
      const runs = [1, 101, 99991, 0x9e3779b9, 0xffffffff].map(seed => simulateDragonCampaign(equipment, 5, true, 50, true, seed));
      for (const run of runs) { expect(run.won).toBe(true); expect(run.invalidStates).toBe(0); expect(run.beds).toBeLessThanOrEqual(3); expect(run.bread).toBeLessThanOrEqual(run.days * 2); }
      return { tier, rank, beforeTickets: baseline.tickets, afterTickets: runs.map(run => run.tickets), afterDays: runs.map(run => run.days) };
    });
    console.info('DRAGON_CRITICAL_BALANCE', JSON.stringify(rows));
  });
  it.each([null, { version: 2, seed: 0 }, { version: 1, seed: -1 }, { version: 1, seed: 1.5 }, { version: 1, seed: 0x100000000 }])('rejects corrupt optional stream %j', critical => {
    expect(isDragonCampaign({ ...battle(), critical })).toBe(false);
  });
});
