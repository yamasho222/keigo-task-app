import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDragonSkillAudio } from './dragonSkillAudio';
import { SKILL_KINDS } from './dragonSkillRules';

const param = () => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() });
const node = () => { const n = { connect: vi.fn(), disconnect: vi.fn() }; n.connect.mockImplementation(() => n); return n; };
const voice = () => ({ ...node(), frequency: param(), type: 'sine', start: vi.fn(), stop: vi.fn(), onended: null as (() => void) | null });
const contexts: AudioFake[] = [];
class AudioFake {
  state = 'running'; currentTime = 2; sampleRate = 24000; destination = node(); sources: ReturnType<typeof voice>[] = []; buffers: ReturnType<typeof voice>[] = [];
  constructor() { contexts.push(this); }
  createGain = () => ({ ...node(), gain: param() });
  createDynamicsCompressor = () => ({ ...node(), threshold: param(), ratio: param() });
  createOscillator = () => { const source = voice(); this.sources.push(source); return source; };
  createBuffer = (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) });
  createBiquadFilter = () => ({ ...node(), frequency: param(), type: 'lowpass' });
  createBufferSource = () => { const source = voice(); this.buffers.push(source); return source; };
  resume = vi.fn(() => Promise.resolve());
  close = vi.fn(() => { this.state = 'closed'; return Promise.resolve(); });
}
beforeEach(() => { contexts.length = 0; vi.stubGlobal('AudioContext', AudioFake); });
afterEach(() => vi.unstubAllGlobals());

describe('bounded skill audio', () => {
  it.each(SKILL_KINDS)('uses a distinct %s release chord with bounded scheduled lifetime', kind => {
    const audio = createDragonSkillAudio(); audio.unlock(); audio.tap(kind, .5); audio.release(kind);
    expect(contexts).toHaveLength(1); const ctx = contexts[0]; expect(ctx.sources).toHaveLength(7);
    expect(ctx.sources.every(source => source.stop.mock.calls[0][0] < ctx.currentTime + .9)).toBe(true);
    const root = { burst: 82, gauge: 110, repel: 146, aim: 196 }[kind];
    expect(ctx.sources[3].frequency.setValueAtTime).toHaveBeenCalledWith(root, 2);
    audio.dispose(); expect(ctx.close).toHaveBeenCalledOnce();
  });
  it('rewards accurate shots with extra notes without replaying a battle hit', () => {
    const audio = createDragonSkillAudio(); audio.shot(0); expect(contexts[0].sources).toHaveLength(2);
    audio.shot(100); expect(contexts[0].sources).toHaveLength(6); audio.dispose();
  });
  it('caps simultaneous voices and frees them on natural end or mute', () => {
    const audio = createDragonSkillAudio(); for (let i = 0; i < 100; i++) audio.tap('burst', 1);
    const ctx = contexts[0]; expect(ctx.sources.length + ctx.buffers.length).toBe(24);
    ctx.sources[0].onended?.(); expect(ctx.sources[0].disconnect).toHaveBeenCalledOnce();
    audio.shot(100); expect(ctx.sources.length + ctx.buffers.length).toBe(25);
    audio.stop(); expect(ctx.sources.slice(1).every(source => source.stop.mock.calls.some(args => args.length === 0))).toBe(true);
    audio.dispose(); audio.dispose(); expect(ctx.close).toHaveBeenCalledOnce();
  });
  it('reuses one bounded charge drone, then stops it on release, mute and disposal', () => {
    const audio = createDragonSkillAudio(); audio.charge(0); audio.charge(1);
    const ctx = contexts[0], drone = ctx.sources[0]; expect(ctx.sources).toHaveLength(1);
    expect(drone.frequency.setTargetAtTime).toHaveBeenLastCalledWith(78, 2, .09);
    expect(drone.stop).toHaveBeenCalledWith(9);
    audio.release('burst'); expect(drone.stop).toHaveBeenCalledWith(); expect(ctx.buffers).toHaveLength(1);
    audio.charge(.5); const muted = ctx.sources.at(-1)!; audio.stop(); expect(muted.stop).toHaveBeenCalledWith();
    audio.dispose(); expect(ctx.close).toHaveBeenCalledOnce();
  });
  it('survives unavailable devices, closed contexts, and voice allocation errors', () => {
    vi.stubGlobal('AudioContext', class { constructor() { throw new Error('device'); } });
    const audio = createDragonSkillAudio(); expect(() => audio.release('gauge')).not.toThrow(); audio.dispose();
    vi.stubGlobal('AudioContext', AudioFake); audio.unlock(); contexts[0].state = 'closed'; expect(() => audio.shot(100)).not.toThrow(); audio.dispose();
    audio.unlock(); contexts[1].createOscillator = () => { throw new Error('quota'); };
    expect(() => audio.tap('burst', 1)).not.toThrow(); audio.dispose();
  });
  it('does not turn a rejected resume into an unhandled rejection', async () => {
    const audio = createDragonSkillAudio(); audio.unlock(); const ctx = contexts[0]; ctx.state = 'suspended'; ctx.resume.mockRejectedValue(new Error('blocked'));
    expect(() => audio.release('aim')).not.toThrow(); await Promise.resolve(); audio.dispose();
  });
});
