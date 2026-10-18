import { describe, expect, it } from 'vitest';
import { createDragonCampaign, stepDragonCampaign } from './dragonCampaignEngine';
import { buildCampaignPlayback } from './dragonCampaignPlayback';
import { enableDragonSkills } from './dragonSkillRules';
import { dragonCampaignFixture } from './dragonCampaignFixtures';

describe('Dragon campaign presentation snapshots', () => {
  it('does not remove enemy HP or show the new intent before actual impact', () => {
    const before = createDragonCampaign('2026-10-17'); before.status = 'battle'; before.selected = 'crystal:0';
    const result = stepDragonCampaign(before, { kind: 'attack' }), playback = buildCampaignPlayback(before, result.state, { kind: 'attack' }, result.events);
    expect(playback.frames.find(f => f.stage === 'strike')?.shown.crystals[0]).toBe(4);
    expect(playback.frames.find(f => f.stage === 'impact')?.shown.crystals[0]).toBe(0);
    expect(playback.frames.every(f => f.shown.intentIndex === before.intentIndex)).toBe(true);
    expect(playback.duration).toBeGreaterThan(playback.frames.at(-1)!.at);
  });
  it('shows counter before hurt and has shorter reduced-motion timing', () => {
    const before = createDragonCampaign('2026-10-17'); before.status = 'battle';
    const result = stepDragonCampaign(before, { kind: 'attack' });
    const normal = buildCampaignPlayback(before, result.state, { kind: 'attack' }, result.events);
    const reduced = buildCampaignPlayback(before, result.state, { kind: 'attack' }, result.events, true);
    const counter = normal.frames.find(f => f.stage === 'counter')!, hurt = normal.frames.find(f => f.stage === 'hurt')!;
    expect(counter.shown.hp).toBe(before.hp); expect(hurt.shown.hp).toBe(result.state.hp); expect(counter.at).toBeLessThan(hurt.at);
    expect(reduced.duration).toBeLessThan(normal.duration);
  });
  it('separates enemy charge, flight and damage; heavy attacks get more travel time', () => {
    const before = createDragonCampaign('2026-10-18'); before.status = 'battle'; before.intentIndex = 2;
    const result = stepDragonCampaign(before, { kind: 'guard' });
    const playback = buildCampaignPlayback(before, result.state, { kind: 'guard' }, result.events);
    const windup = playback.frames.find(frame => frame.stage === 'enemyWindup')!, strike = playback.frames.find(frame => frame.stage === 'counter')!, hurt = playback.frames.find(frame => frame.stage === 'hurt')!;
    expect(windup.shown.hp).toBe(before.hp); expect(strike.shown.hp).toBe(before.hp);
    expect(strike.at - windup.at).toBe(500); expect(hurt.at - strike.at).toBe(600);
    expect(hurt.shown.hp).toBe(result.state.hp); expect(playback.duration).toBeGreaterThan(hurt.at + 500);
  });
  it('does not remove reflected body HP before the returned orb arrives', () => {
    const before = createDragonCampaign('2026-10-17'); before.status = 'battle'; before.phase = 'orb'; before.crystals.fill(0);
    before.finalEntryHp = 1200; before.bodyHp = 800; before.checkpointHp = 800; before.orbHp = 4; before.orbTurns = 1; before.selected = 'orb';
    const result = stepDragonCampaign(before, { kind: 'attack' });
    const playback = buildCampaignPlayback(before, result.state, { kind: 'attack' }, result.events);
    expect(playback.frames.find(f => f.stage === 'impact')?.shown.bodyHp).toBe(800);
    expect(playback.frames.find(f => f.stage === 'reflect')?.shown.bodyHp).toBe(800);
    expect(playback.frames.find(f => f.stage === 'reflected')?.shown.bodyHp).toBe(768);
  });
  it('visibly separates sword and ally damage, then lets the enemy react once', () => {
    const before = enableDragonSkills(dragonCampaignFixture('wings', '2026-10-17', true)); before.selected = 'body';
    const result = stepDragonCampaign(before, { kind: 'attack' });
    const timeline = buildCampaignPlayback(before, result.state, { kind: 'attack' }, result.events);
    const own = timeline.frames.find(frame => frame.stage === 'impact')!, intro = timeline.frames.find(frame => frame.stage === 'assist')!, ally = timeline.frames.filter(frame => frame.stage === 'assistImpact').at(-1)!, counter = timeline.frames.find(frame => frame.stage === 'counter')!;
    expect(own.shown.bodyHp).toBe(before.bodyHp - 4); expect(intro.shown.bodyHp).toBe(own.shown.bodyHp);
    expect(ally.shown.bodyHp).toBe(before.bodyHp - 4 - result.events.find(event => event.kind === 'companion')!.amount); expect(own.at).toBeLessThan(intro.at); expect(intro.at).toBeLessThan(ally.at); expect(ally.at).toBeLessThan(counter.at);
    expect(result.state.turns).toBe(1); expect(result.state.hands).toBe(3);
    expect(timeline.frames.filter(frame => frame.stage === 'counter')).toHaveLength(1);
  });
  it('shows ally finishing damage before part destruction or victory', () => {
    const before = enableDragonSkills(dragonCampaignFixture('victory', '2026-10-17', true)); before.bodyHp = 5;
    const result = stepDragonCampaign(before, { kind: 'attack' });
    const timeline = buildCampaignPlayback(before, result.state, { kind: 'attack' }, result.events);
    expect(result.state.status).toBe('won');
    expect(timeline.frames.find(frame => frame.stage === 'impact')?.shown.bodyHp).toBe(1);
    expect(timeline.frames.find(frame => frame.stage === 'assistImpact')?.shown.bodyHp).toBe(0);
    expect(timeline.frames.find(frame => frame.stage === 'assistImpact')!.at).toBeLessThan(timeline.frames.find(frame => frame.stage === 'victory')!.at);
    expect(timeline.frames.every((frame, i, list) => !i || frame.at >= list[i - 1].at)).toBe(true);
  });
  it('separates a scored ultimate into sword and three allies after a persisted release', () => {
    const original = enableDragonSkills(dragonCampaignFixture('ultimate', '2026-10-17', true));
    const begun = stepDragonCampaign(original, { kind: 'beginSkill' }).state;
    const before = stepDragonCampaign(begun, { kind: 'chooseSkill', token: begun.skills!.pending!.token, mode: 'burst' }).state;
    const action = { kind: 'releaseSkill' as const, token: before.skills!.pending!.token, score: 100 };
    const result = stepDragonCampaign(before, action);
    expect(result.events.find(event => event.kind === 'companion')?.amount).toBe(9);
    const timeline = buildCampaignPlayback(before, result.state, action, result.events);
    expect(timeline.frames.find(frame => frame.stage === 'impact')?.shown.bodyHp).toBe(328);
    expect(timeline.frames.find(frame => frame.stage === 'assist')?.shown.bodyHp).toBe(328);
    expect(timeline.frames.find(frame => frame.stage === 'assistImpact')?.shown.bodyHp).toBe(319);
    expect(timeline.frames.find(frame => frame.stage === 'assist')!.at).toBeGreaterThan(timeline.frames.find(frame => frame.stage === 'impact')!.at);
    expect(timeline.duration).toBeGreaterThan(timeline.frames.find(frame => frame.stage === 'assistImpact')!.at + 500);
  });
});
