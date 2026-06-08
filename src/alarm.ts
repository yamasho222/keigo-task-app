export type AlarmSoundType = "beep" | "siren" | "bell" | "chime" | "urgent";

export interface AlarmSettings {
  durationSec: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  soundType: AlarmSoundType;
}

export const ALARM_DURATION_PRESETS = [10, 30, 60, 120, 180] as const;

export const ALARM_SOUND_OPTIONS: {
  id: AlarmSoundType;
  label: string;
  emoji: string;
  desc: string;
}[] = [
  { id: "beep",   label: "ピピピ",     emoji: "📢", desc: "くり返しビープ" },
  { id: "siren",  label: "サイレン",   emoji: "🚨", desc: "うえした交互" },
  { id: "bell",   label: "ベル",       emoji: "🔔", desc: "リンリン" },
  { id: "chime",  label: "チャイム",   emoji: "🎵", desc: "きらきら音" },
  { id: "urgent", label: "もうすぐ！", emoji: "⏰", desc: "はやい連打" },
];

export function isVibrationSupported() {
  return typeof navigator !== "undefined" && "vibrate" in navigator;
}

const ALARM_SETTINGS_KEY = "keigo-alarm-settings-v1";

const DEFAULT_SETTINGS: AlarmSettings = {
  durationSec: 30,
  soundEnabled: true,
  vibrationEnabled: true,
  soundType: "siren",
};

const VIBRATE_PATTERN = [400, 120, 400, 120, 600];

let alarmActive = false;
let soundBlocked = false;
let activeSoundType: AlarmSoundType = DEFAULT_SETTINGS.soundType;
let stopTimeout: ReturnType<typeof setTimeout> | null = null;
let beepInterval: ReturnType<typeof setInterval> | null = null;
let vibrateInterval: ReturnType<typeof setInterval> | null = null;
let audioCtx: AudioContext | null = null;
let onSoundBlockedChange: ((blocked: boolean) => void) | null = null;

function isValidSoundType(v: unknown): v is AlarmSoundType {
  return ALARM_SOUND_OPTIONS.some((o) => o.id === v);
}

export function loadAlarmSettings(): AlarmSettings {
  try {
    const raw = localStorage.getItem(ALARM_SETTINGS_KEY);
    if (raw) {
      const data = JSON.parse(raw) as Partial<AlarmSettings>;
      return {
        durationSec: clampDuration(data.durationSec ?? DEFAULT_SETTINGS.durationSec),
        soundEnabled: data.soundEnabled ?? true,
        vibrationEnabled: data.vibrationEnabled ?? true,
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
  ctx: AudioContext,
  t: number,
  freq: number,
  wave: OscillatorType,
  vol: number,
  dur: number,
  delay = 0,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = wave;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const s = t + delay;
  gain.gain.setValueAtTime(0.0001, s);
  gain.gain.exponentialRampToValueAtTime(vol, s + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, s + dur);
  osc.start(s);
  osc.stop(s + dur + 0.02);
}

function sweep(
  ctx: AudioContext,
  t: number,
  f0: number,
  f1: number,
  wave: OscillatorType,
  vol: number,
  dur: number,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function playAlarmSound(type: AlarmSoundType) {
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== "running") return;
  const t = ctx.currentTime;

  switch (type) {
    case "beep":
      [[0, 1046], [0.22, 1318], [0.5, 1046], [0.72, 1567]].forEach(([d, f]) =>
        tone(ctx, t, f, "square", 0.7, 0.18, d),
      );
      break;
    case "siren":
      sweep(ctx, t, 520, 1400, "sawtooth", 0.75, 0.45);
      sweep(ctx, t, 1400, 520, "sawtooth", 0.75, 0.45, 0.5);
      break;
    case "bell":
      [0, 0.18, 0.36].forEach((d) => tone(ctx, t, 880, "sine", 0.8, 0.28, d));
      tone(ctx, t, 1320, "sine", 0.55, 0.2, 0.55);
      break;
    case "chime":
      [523, 659, 784, 1046].forEach((f, i) => tone(ctx, t, f, "triangle", 0.7, 0.32, i * 0.14));
      break;
    case "urgent":
      [0, 0.12, 0.24, 0.36, 0.48].forEach((d) => tone(ctx, t, 1580, "square", 0.8, 0.09, d));
      break;
  }
}

function soundIntervalMs(type: AlarmSoundType) {
  switch (type) {
    case "urgent": return 620;
    case "beep":   return 900;
    case "bell":   return 850;
    case "chime":  return 1100;
    case "siren":  return 1050;
  }
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

function startVibrationLoop() {
  if (!isVibrationSupported()) return;
  navigator.vibrate(VIBRATE_PATTERN);
  vibrateInterval = setInterval(() => {
    if (alarmActive) navigator.vibrate(VIBRATE_PATTERN);
  }, 1640);
}

/** 選択中の音を1回だけ試聴 */
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

export function startAlarm(settings: AlarmSettings, onStop?: () => void) {
  stopAlarm();
  alarmActive = true;
  activeSoundType = settings.soundType;

  if (settings.soundEnabled) startSoundLoop(settings.soundType);
  if (settings.vibrationEnabled) startVibrationLoop();

  stopTimeout = setTimeout(() => {
    stopAlarm();
    onStop?.();
  }, settings.durationSec * 1000);
}

export function stopAlarm() {
  alarmActive = false;
  setSoundBlocked(false);
  if (stopTimeout) { clearTimeout(stopTimeout); stopTimeout = null; }
  if (beepInterval) { clearInterval(beepInterval); beepInterval = null; }
  if (vibrateInterval) { clearInterval(vibrateInterval); vibrateInterval = null; }
  navigator.vibrate?.(0);
}
