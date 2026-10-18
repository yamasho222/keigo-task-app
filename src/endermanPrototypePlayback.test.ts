import { describe, expect, it } from 'vitest';
import { actOnEnderman, createEndermanRun, type EndermanAction } from './endermanPrototypeEngine';
import { buildEndermanPlayback } from './endermanPrototypePlayback';

describe('enderman staged presentation', () => {
  it('shows ticket purchase then miss and light; enemy HP stays unchanged until impact', () => {
    const before = createEndermanRun(), action: EndermanAction = { kind: 'strike' };
    const result = actOnEnderman(before, action), playback = buildEndermanPlayback(before, result.state, action, result.events);
    expect(playback.frames.map(f => f.stage)).toEqual(['ticket', 'strike', 'impact', 'counter', 'hurt']);
    expect(playback.frames[0].shown).toMatchObject({ tickets: 3, handsLeft: 4, gauge: 0 });
    expect(playback.frames[1].shown).toMatchObject({ handsLeft: 3, gauge: 0 });
    expect(playback.frames[2].shown).toMatchObject({ enemyHp: 36, gauge: 1, intent: 'warp', misses: 1 });
    expect(result.state.intent).toBe('ambush');
  });
  it('keeps old intent and HP visible until the counter actually lands', () => {
    const before = { ...createEndermanRun({ item: 'water' }), intent: 'ambush' as const, tickets: 0, handsLeft: 1 };
    const action: EndermanAction = { kind: 'strike' }, result = actOnEnderman(before, action);
    const playback = buildEndermanPlayback(before, result.state, action, result.events);
    expect(playback.frames.map(f => f.stage)).not.toContain('ticket');
    const impact = playback.frames.find(f => f.stage === 'impact')!.shown;
    expect(impact).toMatchObject({ enemyHp: 29, hp: 20, intent: 'ambush', handsLeft: 0 });
    expect(playback.frames.find(f => f.stage === 'hurt')!.shown.hp).toBe(18);
    expect(result.state.intent).toBe('opening');
  });
  it('ultimate has a separate focus stage, never shows early rewards and skips counter on kill', () => {
    const before = { ...createEndermanRun(), gauge: 3, enemyHp: 1 }, action: EndermanAction = { kind: 'ultimate' };
    const result = actOnEnderman(before, action), playback = buildEndermanPlayback(before, result.state, action, result.events);
    expect(playback.frames.map(f => f.stage)).toEqual(['ticket', 'focus', 'strike', 'impact']);
    expect(playback.frames.every(f => f.shown.phase === 'battle' && f.shown.pearls === 0)).toBe(true);
    expect(playback.frames.find(f => f.stage === 'impact')!.shown).toMatchObject({ enemyHp: 0, handsLeft: 3 });
    expect(result.state).toMatchObject({ phase: 'won', handsLeft: 0, pearls: 1 });
    expect(playback.duration).toBeGreaterThan(playback.frames.at(-1)!.at);
  });
  it('eat shows bread first then HP without an enemy action', () => {
    const before = { ...createEndermanRun(), hp: 1 }, action: EndermanAction = { kind: 'eat' };
    const result = actOnEnderman(before, action), playback = buildEndermanPlayback(before, result.state, action, result.events);
    expect(playback.frames.map(f => f.stage)).toEqual(['eat', 'heal']);
    expect(playback.frames[0].shown).toMatchObject({ hp: 1, bread: 1, tickets: 4, handsLeft: 0 });
    expect(playback.frames[1].shown).toMatchObject({ hp: 11, intent: 'warp', turn: 0 });
  });
  it.each([{ kind: 'return' }, { kind: 'equip', item: 'water' }] as const)('%j has no attack playback', action => {
    const before = createEndermanRun(), result = actOnEnderman(before, action);
    expect(buildEndermanPlayback(before, result.state, action, result.events).frames).toEqual([]);
  });
});
