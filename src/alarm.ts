export type AlarmSoundType =
  | "party" | "fart" | "boing" | "duck" | "robot" | "fanfare"
  | "siren" | "bell" | "urgent";

export interface AlarmSettings {
  durationSec: number;
  soundEnabled: boolean;
  soundType: AlarmSoundType;
}

export const ALARM_DURATION_PRESETS = [10, 30, 60, 120, 180] as const;

export const ALARM_SOUND_OPTIONS: {
  id: AlarmSoundType;
  label: string;
  emoji: string;
  desc: string;
}[] = [
  { id: "party",   label: "パーティ！",   emoji: "🎉", desc: "ブーブーパーッ！" },
  { id: "fart",    label: "おなら",       emoji: "💨", desc: "デフォルメおなら" },
  { id: "boing",   label: "ぼよん！",     emoji: "🦘", desc: "とびはねる音" },
  { id: "duck",    label: "あひる",       emoji: "🦆", desc: "がーがー！" },
  { id: "robot",   label: "ロボット",     emoji: "🤖", desc: "ピコピコ話す" },
  { id: "fanfare", label: "ファンファーレ", emoji: "🏆", desc: "できた！の音" },
  { id: "siren",   label: "サイレン",     emoji: "🚨", desc: "いちばん大きい！" },
  { id: "bell",    label: "ベル",         emoji: "🔔", desc: "リンリン" },
  { id: "urgent",  label: "もうすぐ！",   emoji: "⏰", desc: "はやい連打・大きめ" },
];

const ALARM_SETTINGS_KEY = "keigo-alarm-settings-v1";

const DEFAULT_SETTINGS: AlarmSettings = {
  durationSec: 30,
  soundEnabled: true,
  soundType: "party",
};

let alarmActive = false;
let soundBlocked = false;
let alarmLoudMode = false;
let activeSoundType: AlarmSoundType = DEFAULT_SETTINGS.soundType;
let stopTimeout: ReturnType<typeof setTimeout> | null = null;
let beepInterval: ReturnType<typeof setInterval> | null = null;
let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let onSoundBlockedChange: ((blocked: boolean) => void) | null = null;

const LOUD_VOLUME_SCALE = 1.35;
const LOUD_INTERVAL_FACTOR = 0.55;

export interface AlarmStartOptions {
  /** ゲームタイマー終了など、できるだけ大きく鳴らす */
  loud?: boolean;
}

function alarmVol(base: number) {
  const scaled = base * (alarmLoudMode ? LOUD_VOLUME_SCALE : 1);
  return Math.min(1, scaled);
}

function getOutputNode(ctx: AudioContext): AudioNode {
  if (!masterGain || masterGain.context !== ctx) {
    masterGain = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-28, ctx.currentTime);
    compressor.knee.setValueAtTime(24, ctx.currentTime);
    compressor.ratio.setValueAtTime(8, ctx.currentTime);
    compressor.attack.setValueAtTime(0.002, ctx.currentTime);
    compressor.release.setValueAtTime(0.2, ctx.currentTime);
    masterGain.connect(compressor);
    compressor.connect(ctx.destination);
  }
  masterGain.gain.setValueAtTime(alarmLoudMode ? 1 : 0.92, ctx.currentTime);
  return masterGain;
}

function isValidSoundType(v: unknown): v is AlarmSoundType {
  return ALARM_SOUND_OPTIONS.some((o) => o.id === v);
}

export function loadAlarmSettings(): AlarmSettings {
  try {
    const raw = localStorage.getItem(ALARM_SETTINGS_KEY);
    if (raw) {
      const data = JSON.parse(raw) as Partial<AlarmSettings> & { vibrationEnabled?: boolean };
      return {
        durationSec: clampDuration(data.durationSec ?? DEFAULT_SETTINGS.durationSec),
        soundEnabled: data.soundEnabled ?? true,
        soundType: isValidSoundType(data.soundType) ? data.soundType : DEFAULT_SETTINGS.soundType,
      };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

export function saveAlarmSettings(settings: AlarmSettings) {
  localStorage.setItem(ALARM_SETTINGS_KEY, JSON.stringify(settings));
}

export function isAlarmActive() {
  return alarmActive;
}

export function isSoundBlocked() {
  return soundBlocked;
}

export function setSoundBlockedListener(cb: ((blocked: boolean) => void) | null) {
  onSoundBlockedChange = cb;
}

function setSoundBlocked(blocked: boolean) {
  soundBlocked = blocked;
  onSoundBlockedChange?.(blocked);
}

function clampDuration(sec: number) {
  return Math.min(180, Math.max(5, Math.round(sec)));
}

function getAudioContext() {
  const Ctx = window.AudioContext
    ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx || audioCtx.state === "closed") audioCtx = new Ctx();
  return audioCtx;
}

export async function unlockAudio(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;
  try {
    await ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.02);
    const ok = ctx.state === "running";
    if (ok) setSoundBlocked(false);
    return ok;
  } catch {
    return false;
  }
}

async function ensureAudioRunning(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    const ok = ctx.state === "running";
    setSoundBlocked(!ok);
    return ok;
  } catch {
    setSoundBlocked(true);
    return false;
  }
}

function tone(
  ctx: AudioContext, t: number, freq: number, wave: OscillatorType,
  vol: number, dur: number, delay = 0,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = wave;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(getOutputNode(ctx));
  const s = t + delay;
  gain.gain.setValueAtTime(0.0001, s);
  gain.gain.exponentialRampToValueAtTime(Math.max(alarmVol(vol), 0.0001), s + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, s + dur);
  osc.start(s);
  osc.stop(s + dur + 0.02);
}

function sweep(
  ctx: AudioContext, t: number, f0: number, f1: number,
  wave: OscillatorType, vol: number, dur: number,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(Math.max(f0, 1), t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  osc.connect(gain);
  gain.connect(getOutputNode(ctx));
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(alarmVol(vol), 0.0001), t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function boingSpring(ctx: AudioContext, t: number, delay = 0) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  const s = t + delay;
  osc.frequency.setValueAtTime(180, s);
  osc.frequency.exponentialRampToValueAtTime(920, s + 0.12);
  osc.frequency.exponentialRampToValueAtTime(220, s + 0.42);
  osc.connect(gain);
  gain.connect(getOutputNode(ctx));
  gain.gain.setValueAtTime(0.0001, s);
  gain.gain.exponentialRampToValueAtTime(Math.max(alarmVol(0.85), 0.0001), s + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, s + 0.45);
  osc.start(s);
  osc.stop(s + 0.48);
}

function noiseBurst(ctx: AudioContext, t: number, dur: number, vol: number, lowHz = 380, delay = 0) {
  const s = t + delay;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = lowHz;
  const gain = ctx.createGain();
  src.connect(filt);
  filt.connect(gain);
  gain.connect(getOutputNode(ctx));
  gain.gain.setValueAtTime(alarmVol(vol), s);
  gain.gain.exponentialRampToValueAtTime(0.0001, s + dur);
  src.start(s);
  src.stop(s + dur + 0.01);
}

function playFart(ctx: AudioContext, t: number) {
  const playOne = (offset: number, vol: number) => {
    noiseBurst(ctx, t, 0.22, vol * 0.9, 320, offset);
    sweep(ctx, t + offset, 140, 55, "sawtooth", vol * 0.7, 0.2);
  };
  playOne(0, 0.9);
  playOne(0.38, 0.65);
}

function playParty(ctx: AudioContext, t: number) {
  const notes = [523, 659, 784, 1046, 784, 1046];
  notes.forEach((f, i) => tone(ctx, t, f, "square", 0.75, 0.14, i * 0.1));
  sweep(ctx, t + 0.65, 600, 1200, "sawtooth", 0.6, 0.18);
}

function playDuck(ctx: AudioContext, t: number) {
  [0, 0.14, 0.28, 0.48, 0.62].forEach((d, i) =>
    tone(ctx, t, i % 2 === 0 ? 380 : 420, "square", 0.7, 0.09, d),
  );
}

function playRobot(ctx: AudioContext, t: number) {
  [[0, 280], [0.1, 420], [0.2, 280], [0.3, 420], [0.42, 350], [0.52, 500]].forEach(([d, f]) =>
    tone(ctx, t, f, "square", 0.72, 0.08, d),
  );
}

function playFanfare(ctx: AudioContext, t: number) {
  [523, 659, 784, 1046, 1318].forEach((f, i) =>
    tone(ctx, t, f, "triangle", 0.8, 0.22, i * 0.11),
  );
  tone(ctx, t, 1568, "square", 0.65, 0.35, 0.62);
}

function playAlarmSound(type: AlarmSoundType) {
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== "running") return;
  const t = ctx.currentTime;

  switch (type) {
    case "party":
      playParty(ctx, t);
      break;
    case "fart":
      playFart(ctx, t);
      break;
    case "boing":
      boingSpring(ctx, t);
      boingSpring(ctx, t, 0.55);
      break;
    case "duck":
      playDuck(ctx, t);
      break;
    case "robot":
      playRobot(ctx, t);
      break;
    case "fanfare":
      playFanfare(ctx, t);
      break;
    case "siren":
      sweep(ctx, t, 520, 1500, "sawtooth", 0.82, 0.45);
      sweep(ctx, t + 0.5, 1500, 520, "sawtooth", 0.82, 0.45);
      break;
    case "bell":
      [0, 0.18, 0.36].forEach((d) => tone(ctx, t, 880, "sine", 0.85, 0.28, d));
      tone(ctx, t, 1320, "sine", 0.6, 0.22, 0.55);
      break;
    case "urgent":
      [0, 0.1, 0.2, 0.3, 0.4, 0.5].forEach((d) => tone(ctx, t, 1680, "square", 0.85, 0.08, d));
      break;
  }

  if (alarmLoudMode) {
    [0, 0.07, 0.14].forEach((d) => tone(ctx, t, 960, "square", 0.95, 0.1, d));
  }
}

function soundIntervalMs(type: AlarmSoundType) {
  const base = (() => {
  switch (type) {
    case "fart":    return 1300;
    case "party":   return 950;
    case "boing":   return 1200;
    case "duck":    return 850;
    case "robot":   return 780;
    case "fanfare": return 1500;
    case "urgent":  return 620;
    case "bell":    return 900;
    case "siren":   return 1050;
  }
  })();
  return alarmLoudMode
    ? Math.max(380, Math.round(base * LOUD_INTERVAL_FACTOR))
    : base;
}

function startSoundLoop(type: AlarmSoundType) {
  activeSoundType = type;
  void (async () => {
    const ok = await ensureAudioRunning();
    if (!ok) return;
    playAlarmSound(type);
    beepInterval = setInterval(() => {
      if (!alarmActive) return;
      void (async () => {
        if (await ensureAudioRunning()) playAlarmSound(activeSoundType);
      })();
    }, soundIntervalMs(type));
  })();
}

export async function previewAlarmSound(type: AlarmSoundType) {
  const ok = await unlockAudio();
  if (!ok) return false;
  playAlarmSound(type);
  return true;
}

export async function retryAlarmSound() {
  if (!alarmActive) return false;
  const ok = await unlockAudio();
  if (!ok) return false;
  if (!beepInterval) {
    playAlarmSound(activeSoundType);
    beepInterval = setInterval(() => {
      if (!alarmActive) return;
      if (audioCtx?.state === "running") playAlarmSound(activeSoundType);
    }, soundIntervalMs(activeSoundType));
  }
  return true;
}

export function startAlarm(
  settings: AlarmSettings,
  onStop?: () => void,
  options?: AlarmStartOptions,
) {
  stopAlarm();
  alarmActive = true;
  alarmLoudMode = options?.loud ?? false;
  activeSoundType = settings.soundType;

  if (settings.soundEnabled) startSoundLoop(settings.soundType);

  if (alarmLoudMode && typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate([400, 120, 400, 120, 400]);
  }

  stopTimeout = setTimeout(() => {
    stopAlarm();
    onStop?.();
  }, settings.durationSec * 1000);
}

export function stopAlarm() {
  alarmActive = false;
  alarmLoudMode = false;
  setSoundBlocked(false);
  if (stopTimeout) { clearTimeout(stopTimeout); stopTimeout = null; }
  if (beepInterval) { clearInterval(beepInterval); beepInterval = null; }
}
