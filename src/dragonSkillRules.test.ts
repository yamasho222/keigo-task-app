import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DragonSkillGame } from './DragonSkillGame';
import { AIM_CENTERS, AIM_COUNT, BURST_TAP_CAP, SKILL_KINDS, TRACE_CHECKPOINTS, advanceTrace, aimCursor, aimScore, aimTotalScore, burstScore, enableDragonSkills, gaugeScore, isUltimateAction, playableSkill, repelTargets, repelScore, skillAt, skillBonus, skillGaugePosition, skillOffers, traceScore } from './dragonSkillRules';
import { dragonCampaignFixture } from './dragonCampaignFixtures';
import { isDragonCampaign, refreshCampaignDay, stepDragonCampaign, type CampaignAction, type DragonCampaign } from './dragonCampaignEngine';
import { buildCampaignPlayback } from './dragonCampaignPlayback';
import { dragonBalanceEquipment, simulateDragonCampaign } from './dragonCampaignBalance';
import { DRAGON_LAB_KEY, loadDragonCampaign, saveDragonCampaign } from './dragonCampaignStorage';

function fixture(): DragonCampaign { return enableDragonSkills(dragonCampaignFixture('ultimate', '2026-10-17', true)); }
function act(state: DragonCampaign, action: CampaignAction) {
  const before = JSON.stringify(state), result = stepDragonCampaign(state, action);
  expect(JSON.stringify(state)).toBe(before); expect(result.error).toBeUndefined(); expect(isDragonCampaign(result.state)).toBe(true);
  return result;
}
function ready(state = fixture(), mode: typeof SKILL_KINDS[number] = 'burst') {
  const begun = act(state, { kind: 'beginSkill' }).state;
  return act(begun, { kind: 'chooseSkill', token: begun.skills!.pending!.token, mode }).state;
}
const release = (state: DragonCampaign, score: number) => act(state, { kind: 'releaseSkill', token: state.skills!.pending!.token, score });

describe('four six-second skills, common bounded scoring', () => {
  it('accelerates towards MAX, returns fast and then slows near zero', () => {
    expect(skillGaugePosition(0)).toBe(0); expect(skillGaugePosition(1200)).toBe(1); expect(skillGaugePosition(2400)).toBe(0);
    for (const t of [100, 400, 800, 1100]) expect(skillGaugePosition(t)).toBeCloseTo(skillGaugePosition(2400 - t));
    expect(skillGaugePosition(1100) - skillGaugePosition(1000)).toBeGreaterThan(skillGaugePosition(200) - skillGaugePosition(100));
    expect(skillGaugePosition(1300) - skillGaugePosition(1400)).toBeGreaterThan(skillGaugePosition(2200) - skillGaugePosition(2300));
    expect(skillGaugePosition(2700)).toBeCloseTo(skillGaugePosition(300));
  });
  it('gives a forgiving top band, while position still matters below it', () => {
    expect(gaugeScore(0)).toBe(0); expect(gaugeScore(.45)).toBe(50); expect(gaugeScore(.9)).toBe(100); expect(gaugeScore(1)).toBe(100);
    expect(BURST_TAP_CAP).toBe(31); expect(burstScore(0)).toBe(0); expect(burstScore(16)).toBe(52); expect(burstScore(24)).toBe(77); expect(burstScore(30)).toBe(97); expect(burstScore(31)).toBe(100); expect(burstScore(1000)).toBe(100);
    expect(skillBonus('diamond', 0)).toBe(12); expect(skillBonus('diamond', 50)).toBe(22); expect(skillBonus('diamond', 100)).toBe(32);
    expect(skillBonus('netherite', 0)).toBe(18); expect(skillBonus('netherite', 50)).toBe(33); expect(skillBonus('netherite', 100)).toBe(48);
  });
  it('raises only the burst tap cap, retaining six seconds, bounded scoring and saved damage values', () => {
    let previous = 0;
    for (let taps = 0; taps <= 100; taps++) {
      const score = burstScore(taps); expect(score).toBeGreaterThanOrEqual(previous); expect(score).toBeLessThanOrEqual(100); previous = score;
    }
    expect(burstScore(-1)).toBe(0); expect(burstScore(NaN)).toBe(0); expect(burstScore(Infinity)).toBe(0);
    const html = renderToStaticMarkup(createElement(DragonSkillGame, { kind: 'burst', reduced: false, onDone: () => undefined }));
    expect(html).toContain('連打0/31回'); expect(html).toContain('残り6秒');
    expect(skillBonus('diamond', 100)).toBe(32); expect(skillBonus('netherite', 100)).toBe(48);
  });
  it('scores one timed aim by proximity with no three-shot averaging', () => {
    expect(AIM_COUNT).toBe(1); expect(AIM_CENTERS).toEqual([.5]);
    expect(aimTotalScore([100])).toBe(100); expect(aimTotalScore([60])).toBe(60); expect(aimTotalScore([0])).toBe(0);
    expect(aimTotalScore([])).toBe(0); expect(aimTotalScore([NaN])).toBe(0); expect(aimTotalScore([Infinity])).toBe(0);
    expect(aimTotalScore([101])).toBe(100); expect(aimTotalScore([-1])).toBe(0);
    const html = renderToStaticMarkup(createElement(DragonSkillGame, { kind: 'aim', reduced: false, onDone: () => undefined }));
    expect(html).toContain('ねらった回数0/1'); expect(html).not.toContain('ねらった回数0/3');
    for (const center of AIM_CENTERS) { expect(aimScore(center, center)).toBe(100); expect(aimScore(center + .05, center)).toBe(100); expect(aimScore(center + .35, center)).toBe(0); }
    expect(aimCursor(0)).toBe(0); expect(aimCursor(800)).toBe(1); expect(aimCursor(1600)).toBe(0);
    expect(aimScore(.5, .5)).toBeGreaterThan(aimScore(.7, .5));
  });
  it('awards trace coverage, not speed, re-tapping the start or teleporting', () => {
    let progress = 0;
    for (let i = 0; i < TRACE_CHECKPOINTS.length; i++) progress = advanceTrace(progress, TRACE_CHECKPOINTS[Math.max(0, i - 1)], TRACE_CHECKPOINTS[i]);
    expect(traceScore(progress)).toBe(100);
    expect(advanceTrace(0, TRACE_CHECKPOINTS[0], TRACE_CHECKPOINTS.at(-1)!)).toBe(0);
    let repeated = advanceTrace(0, TRACE_CHECKPOINTS[0], TRACE_CHECKPOINTS[0]);
    for (let i = 0; i < 100; i++) repeated = advanceTrace(repeated, TRACE_CHECKPOINTS[0], TRACE_CHECKPOINTS[0]);
    expect(traceScore(repeated)).toBeLessThan(10);
    expect(advanceTrace(0, { x: NaN, y: 0 }, TRACE_CHECKPOINTS[0])).toBe(0);
  });
  it('offers every unlocked game independent of cast history or last selection', () => {
    for (let casts = 0; casts < 30; casts++) for (const last of [null, ...SKILL_KINDS]) {
      const offers = skillOffers(casts, last); expect(offers).toEqual(['repel', 'aim', 'burst', 'gauge']);
    }
    expect(SKILL_KINDS).toEqual(['burst', 'gauge', 'repel', 'aim']);
    expect(skillAt(4)).toBe('burst'); expect(playableSkill('trace')).toBe('repel');
  });
  it('spawns ten forgiving return targets with stable ids and bounded scoring', () => {
    expect(repelTargets(-1)).toEqual([]); expect(repelTargets(0).map(t => t.id)).toEqual([0]);
    expect(repelTargets(550).map(t => t.id)).toEqual([0, 1]);
    expect(repelTargets(1100).map(t => t.id)).not.toContain(0);
    expect(repelTargets(6000)).toEqual([]);
    expect(repelScore(0)).toBe(0); expect(repelScore(7)).toBe(70); expect(repelScore(100)).toBe(100);
  });
});

describe('one persisted ultimate transaction, no double payment or replay', () => {
  it('keeps old trial progress intact when enabling skills', () => {
    const s = dragonCampaignFixture('wings', '2026-10-17', true), enabled = enableDragonSkills(s);
    expect(enabled).toEqual({ ...s, skills: { version: 1, casts: 0, last: null, pending: null } }); expect(enableDragonSkills(enabled)).toBe(enabled);
  });
  it('does not consume actions while choosing or playing; release spends exactly one action', () => {
    const s = fixture(); s.hands = 2;
    const pending = ready(s);
    for (const key of ['tickets', 'hands', 'gauge', 'hp', 'bodyHp', 'turns', 'intentIndex', 'landingTurns'] as const) expect(pending[key]).toBe(s[key]);
    const result = release(pending, 50);
    expect(result.state.hands).toBe(1); expect(result.state.tickets).toBe(s.tickets); expect(result.state.turns).toBe(s.turns + 1);
    expect(result.state.skills!.pending).toBeNull(); expect(result.state.skills!.casts).toBe(1);
    const duplicate = stepDragonCampaign(result.state, { kind: 'releaseSkill', token: pending.skills!.pending!.token, score: 100 });
    expect(duplicate.state).toBe(result.state); expect(duplicate.error).toBeTruthy();
  });
  it('buys four actions only once if none were prepaid, including on a resumed game', () => {
    const s = ready(); const loaded: DragonCampaign = JSON.parse(JSON.stringify(s));
    const result = release(loaded, 0);
    expect(result.state.tickets).toBe(s.tickets - 1); expect(result.state.hands).toBe(3); expect(result.state.gauge).toBe(0);
    expect(result.events.filter(e => e.kind === 'ticket')).toHaveLength(1);
  });
  it('locks selection, food, pause, old direct ultimate, and re-choosing while a game is active', () => {
    const s = ready();
    const attempts: CampaignAction[] = [{ kind: 'attack' }, { kind: 'ultimate' }, { kind: 'heal' }, { kind: 'pause' }, { kind: 'select', target: 'body' }, { kind: 'cancelSkill' }, { kind: 'beginSkill' }, { kind: 'chooseSkill', token: s.skills!.pending!.token, mode: 'gauge' }];
    for (const action of attempts) { const result = stepDragonCampaign(s, action); expect(result.error).toBeTruthy(); expect(result.state).toBe(s); }
    expect(refreshCampaignDay(s, '2026-10-18')).toBe(s);
    expect(stepDragonCampaign(fixture(), { kind: 'ultimate' }).error).toBeTruthy();
  });
  it('can cancel a legacy unselected pending save without changing the next cast', () => {
    const s = fixture(), begun = act(s, { kind: 'beginSkill' }).state;
    begun.skills!.pending!.mode = null;
    const cancelled = act(begun, { kind: 'cancelSkill' }).state;
    expect(cancelled.tickets).toBe(s.tickets); expect(cancelled.hands).toBe(s.hands); expect(cancelled.skills!.casts).toBe(0);
    expect(skillOffers(cancelled.skills!.casts, cancelled.skills!.last)).toEqual(skillOffers(s.skills!.casts, s.skills!.last));
  });
  it('preserves guaranteed basic damage and does not multiply skill bonus by landing or wing focus', () => {
    const s = fixture(); const none = release(ready(s), 0), best = release(ready(s), 100);
    expect(none.events.find(e => e.kind === 'hit')?.amount).toBe(61); // weapon20 x2 + guarantee12 + allies9
    expect(best.events.find(e => e.kind === 'hit')?.amount).toBe(81);
    s.equipment.sword = 'netherite';
    expect(release(ready(s), 100).events.find(e => e.kind === 'hit')?.amount).toBe(105);
    const timeline = buildCampaignPlayback(s, best.state, { kind: 'releaseSkill', token: 'x', score: 100 }, best.events);
    expect(timeline.frames.some(f => f.stage === 'strike')).toBe(true); expect(isUltimateAction({ kind: 'releaseSkill', token: 'x', score: 100 })).toBe(true);
  });
  it('adds a separate weighted contribution from every ordinary companion', () => {
    const s = enableDragonSkills(dragonCampaignFixture('wings', '2026-10-17', true)); s.selected = 'body';
    const result = act(s, { kind: 'attack' }), helper = result.events.find(e => e.kind === 'companion')!;
    expect(helper.allies).toHaveLength(3); expect(result.events.find(e => e.kind === 'hit')?.amount).toBe(4 + helper.amount);
    s.equipment.buddies = [];
    expect(act(s, { kind: 'attack' }).events.find(e => e.kind === 'hit')?.amount).toBe(4);
  });
  it('rejects malformed results and invalid pending saves', () => {
    const s = ready();
    for (const score of [-1, 101, .5, NaN, Infinity]) expect(stepDragonCampaign(s, { kind: 'releaseSkill', token: s.skills!.pending!.token, score }).error).toBeTruthy();
    expect(stepDragonCampaign(s, { kind: 'releaseSkill', token: 'stale', score: 100 }).error).toBeTruthy();
    for (const skills of [null, {}, { ...s.skills, casts: -1 }, { ...s.skills, last: 'numbers' }, { ...s.skills, pending: { ...s.skills!.pending, target: 'wing:0' } }, { ...s.skills, pending: { ...s.skills!.pending, mode: 'numbers' } }]) expect(isDragonCampaign({ ...s, skills })).toBe(false);
  });
  it('roundtrips an in-progress game, preserving token, target and mode; stale tabs cannot resolve twice', () => {
    const data = new Map<string, string>(); const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } };
    const s = ready(); expect(saveDragonCampaign(storage, s, null).error).toBeUndefined();
    const loaded = loadDragonCampaign(storage).state!; expect(loaded).toEqual(s);
    const result = release(loaded, 0).state;
    expect(saveDragonCampaign(storage, result, s.revision).error).toBeUndefined();
    expect(saveDragonCampaign(storage, release(s, 100).state, s.revision).error).toBeTruthy();
    expect(JSON.parse(data.get(DRAGON_LAB_KEY)!)).toEqual(result);
  });
  it('resolves old trace and unselected saves without losing progression or allowing a new choice', () => {
    const old = ready(); old.skills!.pending!.mode = 'trace'; old.skills!.last = 'trace';
    expect(isDragonCampaign(old)).toBe(true);
    expect(release(JSON.parse(JSON.stringify(old)), 0).state.skills!.casts).toBe(1);
    old.skills!.pending!.mode = null;
    old.unlockedSkills = ['burst'];
    const wrong = stepDragonCampaign(old, { kind: 'chooseSkill', token: old.skills!.pending!.token, mode: 'aim' });
    expect(wrong.state).toBe(old); expect(wrong.error).toBeTruthy();
    const selected = act(old, { kind: 'chooseSkill', token: old.skills!.pending!.token, mode: 'burst' });
    expect(release(selected.state, 0).state.skills!.pending).toBeNull();
  });
  it('persists explicitly selected games over eight casts, counting only completed casts', () => {
    let s = enableDragonSkills(dragonCampaignFixture('wings', '2026-10-17', true)); s.selected = 'body'; s.equipment.buddies = [];
    for (let i = 0; i < 8; i++) {
      s.gauge = 3;
      const pending = ready(s, SKILL_KINDS[i % 4]); expect(pending.skills!.pending!.mode).toBe(SKILL_KINDS[i % 4]);
      expect(pending.skills!.casts).toBe(i);
      s = release(JSON.parse(JSON.stringify(pending)), 0).state;
      expect(s.skills!.casts).toBe(i + 1);
    }
    expect(s.tickets).toBe(58); expect(s.turns).toBe(8);
  });
  it.each([0, 25, 50, 75, 100])('matches the unmodified %s-point diamond and netherite damage', score => {
    for (const sword of ['diamond', 'netherite'] as const) {
      const s = enableDragonSkills(dragonCampaignFixture('wings', '2026-10-17', true)); s.selected = 'body'; s.gauge = 3;
      s.equipment.sword = sword; s.equipment.buddies = [];
      const hit = release(ready(s), score).events.find(event => event.kind === 'hit')!.amount;
      expect(hit).toBe(sword === 'diamond' ? 20 + score / 5 : 30 + Math.round(score * .3));
    }
  });
  it('does not invent ally damage when the sword already defeats a target', () => {
    const s = enableDragonSkills(dragonCampaignFixture('start', '2026-10-17', true)); s.status = 'battle'; s.selected = 'crystal:0';
    const result = act(s, { kind: 'attack' });
    expect(result.events.find(event => event.kind === 'hit')?.amount).toBe(4);
    expect(result.events.some(event => event.kind === 'companion')).toBe(false);
  });
});

describe('skill screens and complete-battle balance', () => {
  it.each(SKILL_KINDS)('renders %s with pictures, a timeout indicator and an early-release escape', kind => {
    const html = renderToStaticMarkup(createElement(DragonSkillGame, { kind, onDone: () => undefined, reduced: false }));
    expect(html).toContain('残り6秒'); expect(html).toContain('このまま はなつ'); expect(html).toContain('<svg'); expect(html).not.toContain('じゅんばん');
  });
  it('shows an interrupted game as release-only rather than allowing a free retry', () => {
    const html = renderToStaticMarkup(createElement(DragonSkillGame, { kind: 'gauge', onDone: () => undefined, reduced: true, resumed: true }));
    expect(html).toContain('つづきの ひっさつ'); expect(html).not.toContain('必殺のパワー');
    expect(html).not.toContain('どっちで ひっさつ');
  });
  it('waits for the child to start, and gives practice a no-action exit', () => {
    const html = renderToStaticMarkup(createElement(DragonSkillGame, { kind: 'gauge', onDone: () => undefined, reduced: false, practice: true }));
    expect(html).toContain('ミニゲームをはじめる'); expect(html).toContain('>もどる</button>');
    expect(html).not.toContain('>とめる！</button>');
  });
  it.each([0, 50, 100])('finishes on a fixed %s-point skill policy without invalid states', score => {
    const report = simulateDragonCampaign(dragonBalanceEquipment('mixed', 1), 5, true, score);
    expect(report.won).toBe(true); expect(report.invalidStates).toBe(0); expect(report.beds).toBeLessThanOrEqual(3);
    console.info('DRAGON_SKILL_BALANCE', score, JSON.stringify(report));
  });
});
