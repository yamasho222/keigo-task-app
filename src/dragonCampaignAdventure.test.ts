import { describe, expect, it } from 'vitest';
import { maxHp } from './campaignEquipment';
import { dragonAdventureCue, dragonFocusTarget, dragonTechnique, enableDragonAdventure } from './dragonCampaignAdventure';
import { dragonCampaignFixture, recoverDragonTestHp } from './dragonCampaignFixtures';
import { campaignIntent, isDragonCampaign, stepDragonCampaign, type CampaignAction, type DragonCampaign } from './dragonCampaignEngine';
import { buildCampaignPlayback } from './dragonCampaignPlayback';
import { dragonBalanceEquipment, simulateDragonCampaign } from './dragonCampaignBalance';
import { DRAGON_LAB_KEY, loadDragonCampaign, saveDragonCampaign } from './dragonCampaignStorage';

function act(s: DragonCampaign, action: CampaignAction) {
  const frozen = JSON.stringify(s), result = stepDragonCampaign(s, action);
  expect(JSON.stringify(s)).toBe(frozen); expect(result.error).toBeUndefined();
  expect(isDragonCampaign(result.state)).toBe(true);
  return result;
}
const fixture = (kind: Parameters<typeof dragonCampaignFixture>[0]) => dragonCampaignFixture(kind, '2026-10-17', true);

describe('Dragon adventure: preserve progress, reward reading the battlefield', () => {
  it('upgrades an old trial in memory without resetting or pretending a revision was saved', () => {
    const old = dragonCampaignFixture('inner', '2026-10-17'); old.hp = 7; old.tickets = 13; old.hands = 2; old.gauge = 2;
    const updated = enableDragonAdventure(old);
    expect(updated).toEqual({ ...old, adventure: { version: 1, beat: 0, pattern: 0, counter: false, pressure: 0 } });
    expect(enableDragonAdventure(updated)).toBe(updated); expect(old.adventure).toBeUndefined();
    expect(isDragonCampaign(updated)).toBe(true);
  });
  it('makes only the lit wing vulnerable, never makes the other attack miss', () => {
    const s = fixture('wings');
    expect(dragonFocusTarget(s)).toBe('wing:0');
    const lit = act(s, { kind: 'attack' }); expect(lit.events.find(e => e.kind === 'hit')?.amount).toBe(8);
    s.selected = 'wing:1'; const normal = act(s, { kind: 'attack' });
    expect(normal.events.find(e => e.kind === 'hit')?.amount).toBe(4);
    const next = act(lit.state, { kind: 'attack' }).state;
    expect(dragonFocusTarget(next)).toBe('wing:1');
    expect(dragonFocusTarget(act(next, { kind: 'pause' }).state)).toBe('wing:1');
  });
  it('crystal ultimate pierces a barrier, but normal hits do not', () => {
    const s = fixture('inner'); s.intentIndex = 0; s.gauge = 3;
    const plain = act(s, { kind: 'attack' }); expect(plain.events.find(e => e.kind === 'hit')?.amount).toBe(2);
    const special = act(s, { kind: 'ultimate' }); expect(special.events.find(e => e.kind === 'hit')?.amount).toBe(17);
    expect(dragonTechnique(s)).toBe('shatter');
  });
  it('part breaks change when ultimate becomes available', () => {
    const crystal = fixture('start'); crystal.status = 'battle'; crystal.selected = 'crystal:0';
    expect(act(crystal, { kind: 'attack' }).state.gauge).toBe(2);
    const wing = fixture('wings'); wing.wings[0] = 8;
    const result = act(wing, { kind: 'attack' }); expect(result.state.gauge).toBe(3); expect(result.state.landingTurns).toBe(2);
  });
  it('a survived heavy guard earns a single counterattack, but guarding forever never deals damage', () => {
    const s = fixture('rage'); s.intentIndex = 3;
    const guarded = act(s, { kind: 'guard' });
    expect(guarded.state.adventure?.counter).toBe(true); expect(guarded.state.landingTurns).toBe(2);
    expect(guarded.state.hp).toBeLessThan(s.hp); expect(guarded.state.bodyHp).toBe(s.bodyHp);
    const next = act(guarded.state, { kind: 'attack' });
    expect(next.events.find(e => e.kind === 'hit')?.amount).toBe(12); // opening x2 + base counter, not x4
    expect(next.state.adventure?.counter).toBe(false);
    expect(act(next.state, { kind: 'attack' }).events.find(e => e.kind === 'hit')?.amount).toBe(8);
    const again = act(guarded.state, { kind: 'guard' }); expect(again.state.bodyHp).toBe(s.bodyHp);
    expect(again.state.adventure?.counter).toBe(false);
  });
  it('ordinary guards and lethal heavy guards never award a counter', () => {
    const s = fixture('wings'); s.selected = 'body';
    expect(act(s, { kind: 'guard' }).state.adventure?.counter).toBe(false);
    s.intentIndex = 3; s.hp = 1;
    expect(act(s, { kind: 'guard' }).state.adventure?.counter).toBe(false);
  });
  it('food, selections, reload and pause cannot spend or duplicate a pending counter', () => {
    const s = fixture('rage'); s.intentIndex = 3;
    let next = act(s, { kind: 'guard' }).state; next.hp = 5;
    next = act(next, { kind: 'heal' }).state;
    expect(next.adventure?.counter).toBe(true);
    next = act(next, { kind: 'pause' }).state; next = JSON.parse(JSON.stringify(next));
    next = act(next, { kind: 'resume' }).state;
    expect(next.adventure?.counter).toBe(true);
    const special = { ...next, gauge: 3 };
    expect(act(special, { kind: 'ultimate' }).state.adventure?.counter).toBe(false);
  });
  it('two pressure hits break a charge, not two arbitrary attacks', () => {
    const s = fixture('rage'); s.intentIndex = 1;
    const first = act(s, { kind: 'attack' }); expect(first.state.adventure?.pressure).toBe(1);
    const second = act(first.state, { kind: 'attack' });
    expect(second.state.landingTurns).toBe(2); expect(second.state.adventure?.pressure).toBe(0);
    expect(second.events.some(e => e.kind === 'interrupt')).toBe(true);
    expect(second.events.some(e => e.kind === 'counter')).toBe(false);
    const skipped = act(first.state, { kind: 'guard' }); expect(skipped.state.landingTurns).toBe(0);
  });
  it('the final sealing ultimate creates an opening only at the last charge', () => {
    const s = fixture('rage'); s.gauge = 3;
    expect(dragonTechnique(s)).toBe('seal');
    expect(act(s, { kind: 'ultimate' }).state.landingTurns).toBe(2);
    s.intentIndex = 1;
    expect(act(s, { kind: 'ultimate' }).state.landingTurns).toBe(0);
  });
  it('lets a held ultimate return an orb for 64, versus a normal 32', () => {
    const s = fixture('orb'); s.gauge = 3;
    const result = act(s, { kind: 'ultimate' });
    expect(result.events.find(e => e.kind === 'orbReflect')?.amount).toBe(64);
    expect(result.events.some(e => e.kind === 'counter')).toBe(false);
    const timeline = buildCampaignPlayback(s, result.state, { kind: 'ultimate' }, result.events);
    expect(timeline.frames.find(f => f.stage === 'impact')?.shown.bodyHp).toBe(800);
    expect(timeline.frames.find(f => f.stage === 'reflected')?.shown.bodyHp).toBe(736);
  });
  it('changes enemy patterns at boundaries without changing an already displayed forecast', () => {
    const s = fixture('start'); s.status = 'battle'; s.intentIndex = 3;
    const next = act(s, { kind: 'attack' }).state;
    expect(next.adventure?.pattern).toBe(1); expect(campaignIntent(next)).toBe('charge');
    expect(campaignIntent(act(next, { kind: 'select', target: 'crystal:0' }).state)).toBe('charge');
    expect(campaignIntent(act({ ...next, hp: 1 }, { kind: 'heal' }).state)).toBe('charge');
  });
  it('validates new fields instead of loading broken tactical records', () => {
    const good = fixture('rage');
    for (const adventure of [null, {}, { ...good.adventure, counter: 1 }, { ...good.adventure, beat: -1 }, { ...good.adventure, pressure: 2 }, { ...good.adventure, pattern: 2 }]) {
      expect(isDragonCampaign({ ...good, adventure })).toBe(false);
    }
    expect(dragonAdventureCue(good)).toBeTruthy();
  });
});

describe('DEV full HP recovery', () => {
  it.each(['start', 'inner', 'wings', 'orb', 'rage', 'lost'] as const)('changes only player HP and trial metadata in %s', kind => {
    const s = fixture(kind); s.hp = kind === 'lost' ? 0 : 1; s.foodToday = 2;
    const before = JSON.stringify(s), next = recoverDragonTestHp(s);
    expect(JSON.stringify(s)).toBe(before); expect(next.hp).toBe(maxHp(s.equipment)); expect(isDragonCampaign(next)).toBe(true);
    expect(next).toEqual({ ...s, hp: maxHp(s.equipment), status: kind === 'lost' ? 'paused' : s.status, revision: s.revision + 1, log: [...s.log, '試験用：自分のHPだけ全回復。'].slice(-12) });
  });
  it('is a no-op at full HP or victory and preserves defeated penalties', () => {
    const s = fixture('wings'); expect(recoverDragonTestHp(s)).toBe(s);
    const won = act(fixture('victory'), { kind: 'attack' }).state;
    expect(recoverDragonTestHp(won)).toBe(won);
    const lost = fixture('lost'); const recovered = recoverDragonTestHp(lost);
    expect(recovered.hands).toBe(lost.hands); expect(recovered.gauge).toBe(lost.gauge); expect(recovered.defeats).toBe(lost.defeats);
    expect(act(recovered, { kind: 'resume' }).state.status).toBe('battle');
  });
  it('roundtrips tactical state and rejects stale-tab full-heal writes', () => {
    const data = new Map<string, string>(); const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } };
    const s = fixture('rage'); s.hp = 1;
    expect(saveDragonCampaign(storage, s, null).error).toBeUndefined();
    const next = recoverDragonTestHp(s); expect(saveDragonCampaign(storage, next, s.revision).error).toBeUndefined();
    expect(loadDragonCampaign(storage).state).toEqual(next);
    expect(saveDragonCampaign(storage, next, s.revision).error).toBeTruthy(); expect(JSON.parse(data.get(DRAGON_LAB_KEY)!)).toEqual(next);
  });
});

describe('full adventure balance with real actions', () => {
  it('reports representative equipment budgets without imposing a calendar lock', () => {
    const rows = ([['iron', 0], ['mixed', 1], ['diamond', 3], ['netherite', 3]] as const).map(([tier, rank]) => {
      const report = simulateDragonCampaign(dragonBalanceEquipment(tier, rank), 5, true);
      expect(report.won).toBe(true); expect(report.invalidStates).toBe(0);
      return { tier, rank, ...report };
    });
    console.info('DRAGON_ADVENTURE_LOADOUTS', JSON.stringify(rows));
  });
  it.each(['power', 'ultimate', 'break'] as const)('finishes with %s and valid persisted states in all phases', kind => {
    const report = simulateDragonCampaign(dragonBalanceEquipment('mixed', 3, kind), 5, true);
    expect(report.won).toBe(true); expect(report.invalidStates).toBe(0);
    expect(Object.values(report.phaseActions).every(count => count > 0)).toBe(true);
    expect(report.beds).toBeLessThanOrEqual(3); expect(report.bread).toBeLessThanOrEqual(report.days * 2);
    console.info('DRAGON_ADVENTURE_BALANCE', kind, JSON.stringify(report));
  });
  it('keeps arbitrary legal and rejected action sequences serializable without negative resources', () => {
    let seed = 170626;
    for (const kind of ['inner', 'wings', 'orb', 'rage'] as const) {
      let state = fixture(kind);
      for (let step = 0; step < 250; step++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        if (state.status === 'won') break;
        if (state.status === 'lost') state = recoverDragonTestHp(state);
        if (state.status === 'paused') state = act(state, { kind: 'resume' }).state;
        if (step % 9 === 0) state = recoverDragonTestHp(state);
        const targets: DragonCampaign['selected'][] = ['body', 'orb', 'crystal:4', 'wing:0', 'wing:1'];
        const action: CampaignAction = seed % 7 === 6 ? { kind: 'select', target: targets[seed % targets.length] }
          : { kind: (['attack', 'attack', 'ultimate', 'guard', 'bed', 'heal'] as const)[seed % 7] };
        const before = JSON.stringify(state); const result = stepDragonCampaign(state, action);
        expect(JSON.stringify(state)).toBe(before);
        if (result.error) { expect(result.state).toBe(state); expect(result.events).toEqual([]); }
        state = result.state;
        expect(isDragonCampaign(JSON.parse(JSON.stringify(state)))).toBe(true);
      }
    }
  });
});
