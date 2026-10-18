import type { DragonSkillKind } from './dragonSkillRules';

/** Independent, bounded procedural skill audio; stopped when dialog is closed/muted. */
export function createDragonSkillAudio() {
  let context: AudioContext | null = null, output: GainNode | null = null;
  const active = new Set<AudioScheduledSourceNode>();
  let drone: { source: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  function unlock() {
    try {
      context ??= new AudioContext();
      if (context.state === 'closed') return null;
      if (!output) {
        output = context.createGain(); output.gain.value = .22;
        const limiter = context.createDynamicsCompressor(); limiter.threshold.value = -20; limiter.ratio.value = 10;
        output.connect(limiter).connect(context.destination);
      }
      if (context.state === 'suspended') void context.resume().catch(() => undefined);
      return context;
    } catch { return null; }
  }
  function tone(frequency: number, end: number, duration: number, level: number, delay = 0, wave: OscillatorType = 'sine') {
    try {
      const ctx = unlock(); if (!ctx || !output || active.size >= 24) return;
      const oscillator = ctx.createOscillator(), gain = ctx.createGain(), now = ctx.currentTime + delay;
      oscillator.type = wave; oscillator.frequency.setValueAtTime(frequency, now); oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
      gain.gain.setValueAtTime(.001, now); gain.gain.exponentialRampToValueAtTime(level, now + .012); gain.gain.exponentialRampToValueAtTime(.001, now + duration);
      oscillator.connect(gain).connect(output); active.add(oscillator);
      oscillator.onended = () => { active.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(now); oscillator.stop(now + duration + .02);
    } catch { /* Device/voice failure must not interrupt an input or a damage transaction. */ }
  }
  function noise(duration: number, power: number) {
    try {
      const ctx = unlock(); if (!ctx || !output || active.size >= 24) return;
      const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate), samples = buffer.getChannelData(0);
      // Low-passed, short noise adds texture rather than another high-pitched note.
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = 500 + power * 1300;
      gain.gain.setValueAtTime(.001, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.2 + power * .16, ctx.currentTime + .012); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + duration);
      source.connect(filter).connect(gain).connect(output); active.add(source);
      source.onended = () => { active.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
      source.start(); source.stop(ctx.currentTime + duration + .02);
    } catch { /* Audio support is never required for an action. */ }
  }
  function endCharge() {
    if (!drone) return;
    const old = drone; drone = null;
    try { old.source.stop(); } catch { /* Ended */ }
    active.delete(old.source); old.source.disconnect(); old.gain.disconnect(); old.filter.disconnect();
  }
  function stop() { endCharge(); for (const source of active) { try { source.stop(); } catch { /* Ended */ } } active.clear(); }
  return {
    unlock,
    charge(rawPower: number) {
      const power = Number.isFinite(rawPower) ? Math.max(0, Math.min(1, rawPower)) : 0;
      try {
        const ctx = unlock(); if (!ctx || !output) return;
        if (!drone) {
          if (active.size >= 24) return;
          const source = ctx.createOscillator(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();
          source.type = 'sawtooth'; source.frequency.value = 44; filter.type = 'lowpass'; filter.frequency.value = 100; gain.gain.value = .001;
          source.connect(filter).connect(gain).connect(output); active.add(source);
          source.onended = () => { active.delete(source); source.disconnect(); gain.disconnect(); filter.disconnect(); if (drone?.source === source) drone = null; };
          source.start(); source.stop(ctx.currentTime + 7); drone = { source, gain, filter };
        }
        drone.source.frequency.setTargetAtTime(44 + power * 34, ctx.currentTime, .09);
        drone.filter.frequency.setTargetAtTime(100 + power * 900, ctx.currentTime, .08);
        drone.gain.gain.setTargetAtTime(.04 + power * .18, ctx.currentTime, .08);
      } catch { endCharge(); }
    },
    endCharge,
    tap(kind: DragonSkillKind, power: number) {
      tone(65 + power * 100, 38, .16, .3, 0, 'triangle');
      tone((kind === 'repel' ? 330 : 180) + power * 440, 140 + power * 300, .19, .10);
      if (kind === 'burst') noise(.12, power);
    },
    shot(score: number) {
      tone(110, 42, .28, .45, 0, 'triangle');
      [0, 1, 2].slice(0, score >= 85 ? 3 : score >= 40 ? 2 : 1).forEach(i => tone(440 * (1 + i * .25), 445 * (1 + i * .25), .3, .15, i * .045));
    },
    release(kind: DragonSkillKind) {
      endCharge();
      const root = { burst: 82, gauge: 110, repel: 146, aim: 196 }[kind];
      tone(48, 25, .7, .65, .05, 'triangle');
      [1, 1.5, 2, 3].forEach((ratio, i) => tone(root * ratio, root * ratio * 1.4, .48, .15, i * .06, 'triangle'));
      if (kind === 'burst') noise(.5, 1);
    },
    stop,
    dispose() { stop(); if (context && context.state !== 'closed') void context.close().catch(() => undefined); context = null; output = null; },
  };
}
