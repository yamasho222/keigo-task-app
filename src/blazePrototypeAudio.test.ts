import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlazeAudio, type BlazeAudioCue } from './blazePrototypeAudio';

const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
const node = () => { const result = { connect: vi.fn(), disconnect: vi.fn() }; result.connect.mockImplementation(() => result); return result; };
const source = () => ({ ...node(), start: vi.fn(), stop: vi.fn(), onended: null as (() => void) | null, frequency: param(), type: 'triangle', buffer: null });
const contexts: AudioContextStub[] = [];
class AudioContextStub {
  currentTime = 4;
  sampleRate = 8000;
  state = 'running';
  destination = node();
  sources: ReturnType<typeof source>[] = [];
  filters: ReturnType<typeof this.createBiquadFilter>[] = [];
  constructor() { contexts.push(this); }
  resume = vi.fn(() => Promise.resolve());
  close = vi.fn(() => { this.state = 'closed'; return Promise.resolve(); });
  createGain = () => ({ ...node(), gain: param() });
  createDynamicsCompressor = () => ({ ...node(), threshold: param(), knee: param(), ratio: param() });
  createBiquadFilter = () => { const filter = { ...node(), type: 'lowpass', frequency: param() }; this.filters.push(filter); return filter; };
  createBuffer = (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) });
  createBufferSource = () => { const result = source(); this.sources.push(result); return result; };
  createOscillator = this.createBufferSource;
}

describe('original procedural battle audio', () => {
  beforeEach(() => { contexts.length = 0; vi.stubGlobal('AudioContext', AudioContextStub); });
  afterEach(() => vi.unstubAllGlobals());

  it('lazily creates and reuses a context, allowing gesture-time unlock before delayed cues', () => {
    const audio = createBlazeAudio(); expect(contexts).toHaveLength(0);
    audio.unlock(); expect(contexts).toHaveLength(1); expect(contexts[0].sources).toHaveLength(0);
    audio.play('slash'); audio.play('impact'); expect(contexts).toHaveLength(1);
    audio.dispose();
  });

  it('keeps normal cuts low and schedules three cuts before the separately cued impact', () => {
    const audio = createBlazeAudio(); audio.play('slash');
    const ctx = contexts[0];
    expect(ctx.filters[0].frequency.setValueAtTime).toHaveBeenCalledWith(520, 4);
    expect(ctx.sources).toHaveLength(2);
    const offset = ctx.sources.length;
    audio.play('ultimate');
    const attacks = ctx.sources.slice(offset);
    expect(attacks).toHaveLength(6);
    expect(attacks.map(item => item.start.mock.calls[0][0])).toEqual([4, 4, 4.085, 4.085, 4.17, 4.17]);
    expect(attacks.every(item => item.stop.mock.calls[0][0] < 4.34)).toBe(true);
    audio.play('impact'); expect(ctx.sources).toHaveLength(10);
    audio.dispose();
  });

  it.each(['enemy', 'enemyUltimate', 'impact', 'guard', 'heal', 'break', 'bed', 'victory', 'critical'] satisfies BlazeAudioCue[])('generates %s without loading an audio file', cue => {
    const audio = createBlazeAudio(); audio.play(cue);
    const ctx = contexts[0]; expect(ctx.sources.length).toBeGreaterThan(0);
    expect(ctx.sources.every(item => item.start.mock.calls[0][0] >= ctx.currentTime)).toBe(true);
    expect(ctx.sources.every(item => item.stop.mock.calls[0][0] < ctx.currentTime + 1)).toBe(true);
    audio.dispose(); expect(ctx.close).toHaveBeenCalledOnce();
    expect(ctx.sources.every(item => item.stop.mock.calls.some(args => args.length === 0))).toBe(true);
  });

  it('releases ended voices and cancels pending celebration notes on reset/dispose', () => {
    const audio = createBlazeAudio(); audio.play('victory');
    const ctx = contexts[0], ended = ctx.sources[0]; ended.onended?.();
    expect(ended.disconnect).toHaveBeenCalledOnce();
    audio.stop(); expect(ended.stop).toHaveBeenCalledOnce();
    expect(ctx.sources.slice(1).every(item => item.stop.mock.calls.some(args => args.length === 0))).toBe(true);
    audio.dispose(); audio.dispose(); expect(ctx.close).toHaveBeenCalledOnce();
  });

  it('does not break gameplay when WebAudio is unavailable or the device rejects resume', async () => {
    vi.stubGlobal('AudioContext', class { constructor() { throw new Error('unavailable'); } });
    const audio = createBlazeAudio(); expect(() => audio.play('bed')).not.toThrow(); expect(() => audio.dispose()).not.toThrow();
    vi.stubGlobal('AudioContext', AudioContextStub);
    audio.unlock(); const ctx = contexts[0]; ctx.state = 'suspended'; ctx.resume.mockRejectedValue(new Error('blocked'));
    expect(() => audio.play('slash')).not.toThrow();
    await Promise.resolve(); audio.dispose();
  });
});
