import { describe, expect, it } from 'vitest';
import { actOnBlaze, createBlazeRun, type BlazeAction } from './blazePrototypeEngine';
import { buildBlazePlayback } from './blazePrototypePlayback';

describe('child-readable battle playback', () => {
  const strike: BlazeAction = { kind: 'strike', target: { enemyId: 0, part: 'body' } };
  it('shows ticket → action → enemy HP → counter → player HP without mutating the engine state', () => {
    const before = createBlazeRun();
    before.enemies[0].intent = 'burst';
    const original = structuredClone(before);
    const result = actOnBlaze(before, strike);
    const after = structuredClone(result.state);
    const { frames } = buildBlazePlayback(before, result.state, strike, result.events);
    expect(frames.map(f => f.stage)).toEqual(['ticket', 'strike', 'impact', 'counter', 'hurt']);
    expect(frames[0].shown.handsLeft).toBe(4);
    expect(frames[1].shown.handsLeft).toBe(3);
    expect(frames[1].shown.enemies[0].hp).toBe(28);
    expect(frames[2].shown.enemies[0].hp).toBe(24);
    expect(frames[2].shown.hp).toBe(20);
    expect(frames[3].shown.hp).toBe(20);
    expect(frames[4].shown.hp).toBe(result.state.hp);
    expect(frames.every(f => f.shown.enemies[0].intent === 'burst')).toBe(true);
    expect(before).toEqual(original);
    expect(result.state).toEqual(after);
  });
  it('does not pretend another ticket was bought for a prepaid action', () => {
    const before = createBlazeRun(); before.handsLeft = 1; before.tickets = 0;
    const result = actOnBlaze(before, strike);
    const { frames } = buildBlazePlayback(before, result.state, strike, result.events);
    expect(frames[0].stage).toBe('strike');
    expect(frames.every(f => f.shown.tickets === 0 && f.shown.handsLeft === 0)).toBe(true);
  });
  it('keeps old telegraph while guarding and only reduces hearts at impact', () => {
    const before = createBlazeRun(); before.enemies[0].intent = 'burst';
    const action: BlazeAction = { kind: 'guard' };
    const result = actOnBlaze(before, action);
    const { frames } = buildBlazePlayback(before, result.state, action, result.events);
    expect(frames.some(f => f.stage === 'guard')).toBe(true);
    expect(frames.every(f => f.shown.enemies[0].intent === 'burst')).toBe(true);
    expect(frames.filter(f => f.stage !== 'hurt').every(f => f.shown.hp === before.hp)).toBe(true);
    expect(frames.find(f => f.stage === 'hurt')?.shown.hp).toBe(result.state.hp);
    expect(result.state.hp).toBeLessThan(before.hp);
    expect(result.state.enemies[0].intent).toBe('ember');
  });
  it('finishes a killing attack without a phantom counter or early reward', () => {
    const before = createBlazeRun(); before.enemies[0].hp = 4;
    const result = actOnBlaze(before, strike);
    const playback = buildBlazePlayback(before, result.state, strike, result.events);
    expect(playback.frames.some(f => f.stage === 'counter')).toBe(false);
    expect(playback.frames.every(f => f.shown.phase === 'battle' && f.shown.securedRods === 0)).toBe(true);
    expect(result.state.phase).toBe('won');
    expect(result.state.securedRods).toBe(1);
  });
  it('shows bread disappearing before hearts recover, without advancing the enemy', () => {
    const before = createBlazeRun(); before.hp = 5;
    const action: BlazeAction = { kind: 'eat' };
    const result = actOnBlaze(before, action);
    const { frames } = buildBlazePlayback(before, result.state, action, result.events);
    expect(frames[0].shown.bread).toBe(1);
    expect(frames[0].shown.hp).toBe(5);
    expect(frames[1].shown.hp).toBe(15);
    expect(frames.every(f => f.shown.tickets === before.tickets && f.shown.turn === before.turn && f.shown.handsLeft === before.handsLeft)).toBe(true);
    expect(frames[1].shown.enemies).toEqual(before.enemies);
  });
  it('defers defeat until after the player takes the hit', () => {
    const before = createBlazeRun(); before.hp = 1; before.enemies[0].intent = 'burst';
    const result = actOnBlaze(before, strike);
    const { frames } = buildBlazePlayback(before, result.state, strike, result.events);
    expect(result.state.phase).toBe('lost');
    expect(frames.every(f => f.shown.phase === 'battle')).toBe(true);
    expect(frames.at(-1)!.shown.hp).toBe(0);
  });
  it('never shows health damage for an ultimate that interrupts the enemy', () => {
    const before = createBlazeRun(); before.gauge = 3; before.enemies[0].intent = 'burst';
    const action: BlazeAction = { kind: 'ultimate', enemyId: 0 };
    const result = actOnBlaze(before, action);
    const { frames } = buildBlazePlayback(before, result.state, action, result.events);
    expect(frames.every(f => f.shown.hp === before.hp)).toBe(true);
    expect(frames.find(f => f.stage === 'impact')!.shown.gauge).toBe(0);
    expect(result.events.some(e => e.kind === 'counter')).toBe(false);
  });
  it('winds up a special before the unique strike and impact, spending only one prepaid action', () => {
    const before = createBlazeRun(); before.gauge = 3; before.handsLeft = 3;
    const action: BlazeAction = { kind: 'ultimate', enemyId: 0 };
    const result = actOnBlaze(before, action);
    const playback = buildBlazePlayback(before, result.state, action, result.events);
    expect(playback.frames.map(frame => frame.stage)).toEqual(['focus', 'strike', 'impact', 'counter', 'hurt']);
    expect(playback.frames.every(frame => frame.shown.handsLeft === 2 && frame.shown.tickets === before.tickets)).toBe(true);
    expect(playback.frames[0].shown.enemies[0].hp).toBe(28);
    expect(playback.frames[1].shown.enemies[0].hp).toBe(28);
    expect(playback.frames[2].shown.enemies[0].hp).toBe(20);
    expect(playback.frames.map(frame => frame.at)).toEqual([0, 560, 900, 1410, 1810]);
  });
});
