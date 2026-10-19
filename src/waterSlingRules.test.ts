import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DragonSkillGame } from './DragonSkillGame';
import { WATER_BALL_RADIUS, WATER_BOARD, WATER_FLIGHT_MS, WATER_GUIDE_TAIL, WATER_ORIGIN, WATER_SPEED, advanceWaterSling, createWaterBubbles, createWaterSling, launchWaterSling, waterDirection, waterGuide, waterPopped, waterPosition, waterPullPosition, waterShotPath, waterSlingScore } from './waterSlingRules';
import { actOnBlaze, createBlazeRun } from './blazePrototypeEngine';
import { enableBattleSkills } from './battleSkillRules';
const WATER_BUBBLES = [64, 124, 184, 244].flatMap((y, row) => [65, 160, 255].map((x, col) => ({ id: row * 3 + col, x, y, radius: 22 })));

describe('water sling direction and deliberately short reflection guide', () => {
  it('fires opposite the pull, independent of pull length', () => {
    expect(waterDirection({ x: 0, y: 0 }, { x: -20, y: 20 })).toEqual(waterDirection({ x: 0, y: 0 }, { x: -80, y: 80 }));
    expect(waterDirection(WATER_ORIGIN, { x: 160, y: 340 })).toEqual({ x: 0, y: -1 });
    expect(waterDirection(WATER_ORIGIN, { x: 190, y: 340 })!.x).toBeLessThan(0);
    expect(waterDirection(WATER_ORIGIN, { x: 130, y: 340 })!.x).toBeGreaterThan(0);
  });
  it('rejects taps, tiny pulls and invalid coordinates without spending a shot', () => {
    for (const p of [WATER_ORIGIN, { x: 161, y: 312 }, { x: NaN, y: 1 }, { x: 0, y: Infinity }]) expect(waterDirection(WATER_ORIGIN, p)).toBeNull();
    for (const p of [{ x: 0, y: 0 }, { x: NaN, y: 1 }, { x: Infinity, y: 0 }, { x: Number.MAX_VALUE, y: Number.MAX_VALUE }]) {
      const s = createWaterSling(); expect(launchWaterSling(s, p)).toBe(s); expect(waterGuide(p)).toEqual([]);
    }
    expect(waterDirection({ x: Number.MAX_VALUE, y: 0 }, { x: -Number.MAX_VALUE, y: 0 })).toBeNull();
  });
  it.each([{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: -1 }, { x: 148, y: -298 }])('shows the first wall then at most 32 logical pixels for %j', direction => {
    const guide = waterGuide(direction); expect(guide).toHaveLength(3); expect(guide[0]).toEqual(WATER_ORIGIN);
    expect(Math.hypot(guide[2].x - guide[1].x, guide[2].y - guide[1].y)).toBeLessThanOrEqual(WATER_GUIDE_TAIL + 1e-7);
    expect([12, 308].some(x => Math.abs(guide[1].x - x) < 1e-6) || [12, 348].some(y => Math.abs(guide[1].y - y) < 1e-6)).toBe(true);
    for (const p of guide) { expect(p.x).toBeGreaterThanOrEqual(12 - 1e-6); expect(p.x).toBeLessThanOrEqual(308 + 1e-6); expect(p.y).toBeGreaterThanOrEqual(12 - 1e-6); expect(p.y).toBeLessThanOrEqual(348 + 1e-6); }
  });
  it('uses exactly the same first bounce for preview and actual flight', () => {
    for (let i = 0; i < 360; i++) {
      const direction = { x: Math.cos(i * Math.PI / 180), y: Math.sin(i * Math.PI / 180) };
      const guide = waterGuide(direction), path = waterShotPath(direction);
      expect(guide[1].x).toBeCloseTo(path[0].to.x, 6); expect(guide[1].y).toBeCloseTo(path[0].to.y, 6);
    }
  });
});
describe('water piercing, wall bounces and single-shot completion', () => {
  it('randomizes complete safe layouts once per seed without moving during flight', () => {
    const invalid: number[] = [];
    for (let seed = 1; seed <= 1000; seed++) {
      const bubbles = createWaterBubbles(seed);
      if (bubbles.length !== 12 || new Set(bubbles.map(b => b.id)).size !== 12 || bubbles.some(a => a.x < 40 || a.x > 280 || a.y < 58 || a.y > 262 || Math.hypot(a.x - 160, a.y - 310) < 48 || bubbles.some(b => a.id !== b.id && Math.hypot(a.x - b.x, a.y - b.y) < 48))) invalid.push(seed);
    }
    expect(invalid).toEqual([]); expect(createWaterBubbles(41)).toEqual(createWaterBubbles(41)); expect(createWaterBubbles(42)).not.toEqual(createWaterBubbles(41));
    const s = createWaterSling(41), next = advanceWaterSling(launchWaterSling(s, { x: 1, y: -1 }), 600);
    expect(next.bubbles).toBe(s.bubbles);
  });
  it('moves the pulled ball toward the finger but keeps it within the board', () => {
    expect(waterPullPosition({ x: 20, y: -10 })).toEqual({ x: 180, y: 300 });
    expect(waterPullPosition({ x: 0, y: 10000 })).toEqual({ x: 160, y: 338 });
    expect(waterPullPosition({ x: 10000, y: 0 })).toEqual({ x: 218, y: 310 });
    expect(waterPullPosition({ x: NaN, y: 0 })).toEqual(WATER_ORIGIN);
    expect(waterPullPosition({ x: Number.MAX_VALUE, y: Number.MAX_VALUE })).toEqual(WATER_ORIGIN);
  });
  it('has twelve stationary non-overlapping bubbles and a generous collision radius', () => {
    expect(WATER_BUBBLES).toHaveLength(12); expect(new Set(WATER_BUBBLES.map(b => b.id)).size).toBe(12);
    for (const a of WATER_BUBBLES) for (const b of WATER_BUBBLES) if (a.id !== b.id) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.radius + b.radius);
    expect(WATER_BALL_RADIUS).toBe(9);
  });
  it('pierces all four center bubbles, never turns at a bubble or scores it twice', () => {
    const path = waterShotPath({ x: 0, y: -1 });
    expect(waterPopped(path, 0, WATER_BUBBLES)).toEqual([]);
    expect(waterPopped(path, 500, WATER_BUBBLES)).toEqual([1, 4, 7, 10]);
    expect(waterPopped(path, WATER_FLIGHT_MS, WATER_BUBBLES)).toEqual([1, 4, 7, 10]);
    expect(waterPopped(path, WATER_FLIGHT_MS, WATER_BUBBLES, [1, 1, 4])).toEqual([1, 4, 7, 10]);
    expect(path[0].to).toEqual({ x: 160, y: 12 });
  });
  it('has identical collision outcomes at 120fps, 30fps or one large time step', () => {
    const path = waterShotPath({ x: .7, y: -1 });
    for (const step of [8, 33, WATER_FLIGHT_MS]) {
      let hits: number[] = []; for (let t = 0; t < WATER_FLIGHT_MS; t += step) hits = waterPopped(path, t, WATER_BUBBLES, hits);
      expect(waterPopped(path, WATER_FLIGHT_MS, WATER_BUBBLES, hits)).toEqual(waterPopped(path, WATER_FLIGHT_MS, WATER_BUBBLES));
    }
  });
  it('keeps all trajectories finite, bounded and at fixed speed through corners', () => {
    const invalid: { angle: number; t?: number }[] = [];
    for (let i = 0; i < 720; i++) {
      const path = waterShotPath({ x: Math.cos(i * Math.PI / 360), y: Math.sin(i * Math.PI / 360) });
      if (path.length >= 32 || Math.abs(path.at(-1)!.end - WATER_SPEED * WATER_FLIGHT_MS / 1000) > 1e-5) invalid.push({ angle: i });
      for (let t = 0; t <= WATER_FLIGHT_MS; t += 37) {
        const p = waterPosition(path, t);
        if (!Number.isFinite(p.x + p.y) || p.x < WATER_BOARD.inset - 1e-6 || p.x > 308 + 1e-6 || p.y < 12 - 1e-6 || p.y > 348 + 1e-6) invalid.push({ angle: i, t });
      }
    }
    expect(invalid).toEqual([]);
  });
  it('allows aiming indefinitely and rejects firing during flight or after the only shot', () => {
    let s = { ...createWaterSling(), bubbles: WATER_BUBBLES }; const original = structuredClone(s);
    expect(advanceWaterSling(s, 1e9)).toBe(s);
    s = launchWaterSling(s, { x: 0, y: -1 }); expect(s.shots).toBe(1);
    expect(launchWaterSling(s, { x: 1, y: 0 })).toBe(s);
    s = advanceWaterSling(s, 2000); expect(s.phase).toBe('flight');
    s = advanceWaterSling(s, 4999); expect(s.phase).toBe('flight');
    s = advanceWaterSling(s, WATER_FLIGHT_MS); expect(s.elapsed).toBe(5000); expect(s.popped).toEqual([1, 4, 7, 10]); expect(s.phase).toBe('done');
    expect(launchWaterSling(s, { x: 1, y: 0 })).toBe(s); expect({ ...createWaterSling(), bubbles: WATER_BUBBLES }).toEqual(original);
  });
  it('finishes early if the final remaining bubble pops', () => {
    const last = launchWaterSling({ ...createWaterSling(), bubbles: WATER_BUBBLES, popped: WATER_BUBBLES.filter(b => b.id !== 10).map(b => b.id) }, { x: 0, y: -1 });
    expect(advanceWaterSling(last, 100).phase).toBe('done');
  });
  it('never rewinds time or mutates the previous snapshot', () => {
    const s = advanceWaterSling(launchWaterSling(createWaterSling(), { x: 1, y: -1 }), 600), before = structuredClone(s);
    expect(advanceWaterSling(s, 20).elapsed).toBe(600); expect(advanceWaterSling(s, NaN)).toBe(s); expect(s).toEqual(before);
  });
  it.each([[0, 0], [6, 50], [9, 75], [12, 100]])('%i bubbles gives %i points, never speed or combo bonuses', (count, score) => {
    const hits = WATER_BUBBLES.slice(0, count).map(b => b.id);
    expect(waterSlingScore(hits)).toBe(score); expect(waterSlingScore([...hits, ...hits, -1, 99])).toBe(score);
  });
});
describe('shared skill integration and interruption safeguards', () => {
  it('shows one shot and no six-second timer, with a picture demo and keyboard fallback', () => {
    const html = renderToStaticMarkup(createElement(DragonSkillGame, { kind: 'repel', reduced: false, sound: false, onDone() {} }));
    expect(html).toContain('のこり1球'); expect(html).toContain('ひっぱって、はなす'); expect(html).toContain('ws-hand-demo'); expect(html).toContain('スペースで発射');
    expect(html).not.toContain('残り6秒'); expect(html).not.toContain('dm-repel-ball'); expect(html).not.toContain('<canvas');
    expect(html.match(/class="ws-bubble"/g)).toHaveLength(12);
    expect(html).toContain('このまま はなつ');
  });
  it('does not offer a fresh game when a saved cast is resumed or stale', () => {
    for (const props of [{ resumed: true }, { blocked: true }]) {
      const html = renderToStaticMarkup(createElement(DragonSkillGame, { kind: 'repel', reduced: true, onDone() {}, ...props }));
      expect(html).not.toContain('ws-field'); expect(html).not.toContain('ミニゲームをはじめる');
      expect(html).toContain(props.resumed ? 'つづきの ひっさつ' : 'きろくを よみなおす');
    }
  });
  it('preserves real action cost, damage range, water protection and one-time cast resolution', () => {
    const before = enableBattleSkills(createBlazeRun(), ['repel']); before.gauge = 3;
    const pending = actOnBlaze(before, { kind: 'beginSkill' }).state;
    expect(pending.tickets).toBe(before.tickets); expect(pending.handsLeft).toBe(before.handsLeft);
    const action = { kind: 'releaseSkill', token: pending.skills!.pending!.token, score: waterSlingScore(WATER_BUBBLES.map(b => b.id)) } as const;
    const result = actOnBlaze(pending, action);
    expect(result.error).toBeUndefined(); expect(result.state.tickets).toBe(before.tickets - 1); expect(result.state.handsLeft).toBe(3);
    expect(result.state.enemies[0].hp).toBe(before.enemies[0].hp - 16); expect(result.state.effects?.water).toBe(2);
    expect(actOnBlaze(result.state, action).error).toBeTruthy();
  });
  it('handles capture cancellation and stops frames, audio and delayed commits when unmounted', () => {
    const source = readFileSync(new URL('./WaterSlingGame.tsx', import.meta.url), 'utf8');
    for (const contract of ['onPointerCancel={dropGesture}', 'onLostPointerCapture={dropGesture}', 'releasePointerCapture', 'cancelAnimationFrame(frame)', 'clearTimeout(resultTimer.current)', 'audio.current?.dispose()', 'if (finished.current || blockedRef.current || !alive.current) return', "document.visibilityState === 'hidden'", 'if (alive.current && !blockedRef.current) callback.current(score)']) expect(source).toContain(contract);
  });
});
