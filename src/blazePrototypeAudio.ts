export type BlazeAudioCue = 'slash' | 'guard' | 'ultimate' | 'heal' | 'enemy' | 'enemyUltimate' | 'impact' | 'break' | 'bed' | 'victory' | 'critical';

/** Procedural, original effects. No audio downloads or production sound changes. */
export function createBlazeAudio() {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  const active = new Set<AudioScheduledSourceNode>();

  function unlock() {
    try {
      context ??= new AudioContext();
      if (context.state === 'closed') return null;
      if (!master) {
        master = context.createGain();
        master.gain.value = 0.55;
        const limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -18;
        limiter.knee.value = 12;
        limiter.ratio.value = 8;
        master.connect(limiter).connect(context.destination);
      }
      if (context.state === 'suspended') void context.resume().catch(() => undefined);
      return context;
    } catch { return null; }
  }

  function track(source: AudioScheduledSourceNode, nodes: AudioNode[], at: number, length: number) {
    active.add(source);
    source.onended = () => { active.delete(source); source.disconnect(); nodes.forEach(node => node.disconnect()); };
    source.start(at);
    source.stop(at + length + 0.02);
  }

  function envelope(ctx: AudioContext, at: number, length: number, peak: number) {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(peak, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, at + length);
    gain.connect(master!);
    return gain;
  }

  function tone(ctx: AudioContext, at: number, frequency: number, end: number, length: number, peak: number, type: OscillatorType = 'triangle') {
    const source = ctx.createOscillator();
    const gain = envelope(ctx, at, length, peak);
    source.type = type;
    source.frequency.setValueAtTime(frequency, at);
    source.frequency.exponentialRampToValueAtTime(end, at + length);
    source.connect(gain);
    track(source, [gain], at, length);
  }

  function scrape(ctx: AudioContext, at: number, cutoff: number, length: number, peak: number) {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * (length + 0.02)), ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter();
    const gain = envelope(ctx, at, length, peak);
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, at);
    filter.frequency.exponentialRampToValueAtTime(85, at + length);
    source.connect(filter).connect(gain);
    track(source, [filter, gain], at, length);
  }

  function stop() {
    for (const source of active) { try { source.stop(); } catch { /* Already ended. */ } }
    active.clear();
  }

  return {
    // Unlock inside the accepted button event, before delayed playback on mobile.
    unlock,
    play(cue: BlazeAudioCue) {
      try {
        const ctx = unlock();
        if (!ctx) return;
        const at = ctx.currentTime;
        if (cue === 'heal' || cue === 'victory') {
          const notes = cue === 'heal' ? [330, 440, 550] : [294, 392, 490, 588];
          notes.forEach((frequency, i) => tone(ctx, at + i * 0.11, frequency, frequency * 1.005, 0.28, 0.065, 'sine'));
        } else if (cue === 'slash') {
          // Low "zusha": filtered friction and a descending body thump.
          scrape(ctx, at, 520, 0.23, 0.22);
          tone(ctx, at, 92, 37, 0.19, 0.14);
        } else if (cue === 'critical') {
          scrape(ctx, at, 900, .25, .22);
          tone(ctx, at, 110, 32, .33, .18);
          tone(ctx, at + .02, 1320, 440, .18, .035, 'sine');
        } else if (cue === 'ultimate') {
          // Three cuts; the final impact is cued by the actual hit frame.
          [0, 0.085, 0.17].forEach((delay, i) => {
            scrape(ctx, at + delay, 680 + i * 170, 0.13, 0.14);
            tone(ctx, at + delay, 115 + i * 27, 48, 0.12, 0.08);
          });
        } else if (cue === 'impact') {
          scrape(ctx, at, 650, 0.19, 0.13);
          tone(ctx, at, 76, 30, 0.28, 0.19);
        } else if (cue === 'guard') {
          tone(ctx, at, 185, 100, 0.14, 0.1);
          tone(ctx, at, 415, 260, 0.22, 0.045, 'sine');
          scrape(ctx, at, 780, 0.15, 0.1);
        } else if (cue === 'enemy' || cue === 'enemyUltimate') {
          const big = cue === 'enemyUltimate';
          scrape(ctx, at, big ? 1150 : 620, big ? 0.36 : 0.24, big ? 0.19 : 0.13);
          tone(ctx, at, big ? 64 : 140, big ? 30 : 65, big ? 0.36 : 0.24, big ? 0.16 : 0.075);
          if (big) scrape(ctx, at + 0.1, 800, 0.22, 0.08);
        } else if (cue === 'break') {
          [0, 0.065, 0.13].forEach((delay, i) => {
            scrape(ctx, at + delay, 900 - i * 200, 0.12, 0.075);
            tone(ctx, at + delay, 340 - i * 65, 100, 0.15, 0.04, 'sine');
          });
        } else if (cue === 'bed') {
          scrape(ctx, at, 460, 0.48, 0.22);
          tone(ctx, at, 65, 28, 0.46, 0.17);
        }
      } catch {
        // A blocked or unavailable audio device must never stop a battle.
      }
    },
    stop,
    dispose() {
      stop();
      if (context && context.state !== 'closed') void context.close().catch(() => undefined);
      context = null;
      master = null;
    },
  };
}
