export interface AlarmSettings {
  durationSec: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

export const ALARM_DURATION_PRESETS = [10, 30, 60, 120, 180] as const;

export function isVibrationSupported() {
  return typeof navigator !== "undefined" && "vibrate" in navigator;
}

const ALARM_SETTINGS_KEY = "keigo-alarm-settings-v1";

const DEFAULT_SETTINGS: AlarmSettings = {
  durationSec: 30,
  soundEnabled: true,
  vibrationEnabled: true,
};

const VIBRATE_PATTERN = [400, 120, 400, 120, 600];

let alarmActive = false;
let stopTimeout: ReturnType<typeof setTimeout> | null = null;
let beepInterval: ReturnType<typeof setInterval> | null = null;
let vibrateInterval: ReturnType<typeof setInterval> | null = null;
let audioCtx: AudioContext | null = null;

export function loadAlarmSettings(): AlarmSettings {
  try {
    const raw = localStorage.getItem(ALARM_SETTINGS_KEY);
    if (raw) {
      const data = JSON.parse(raw) as Partial<AlarmSettings>;
      return {
        durationSec: clampDuration(data.durationSec ?? DEFAULT_SETTINGS.durationSec),
        soundEnabled: data.soundEnabled ?? true,
        vibrationEnabled: data.vibrationEnabled ?? true,
      };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

export function saveAlarmSettings(settings: AlarmSettings) {
  localStorage.setItem(ALARM_SETTINGS_KEY, JSON.stringify(settings));
}

function clampDuration(sec: number) {
  return Math.min(180, Math.max(5, Math.round(sec)));
}

function getAudioContext() {
  const Ctx = window.AudioContext
    ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx || audioCtx.state === "closed") audioCtx = new Ctx();
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

function playAttentionBeep() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime;
  [[0, 1046], [0.22, 1318], [0.5, 1046], [0.72, 1567]].forEach(([offset, freq]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, t + offset);
    gain.gain.exponentialRampToValueAtTime(0.65, t + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.18);
    osc.start(t + offset);
    osc.stop(t + offset + 0.2);
  });
}

function startVibrationLoop() {
  if (!isVibrationSupported()) return;
  navigator.vibrate(VIBRATE_PATTERN);
  vibrateInterval = setInterval(() => {
    if (alarmActive) navigator.vibrate(VIBRATE_PATTERN);
  }, 1640);
}

function startSoundLoop() {
  playAttentionBeep();
  beepInterval = setInterval(() => {
    if (alarmActive) playAttentionBeep();
  }, 900);
}

export function isAlarmActive() {
  return alarmActive;
}

export function startAlarm(settings: AlarmSettings, onStop?: () => void) {
  stopAlarm();
  alarmActive = true;

  if (settings.soundEnabled) startSoundLoop();
  if (settings.vibrationEnabled) startVibrationLoop();

  stopTimeout = setTimeout(() => {
    stopAlarm();
    onStop?.();
  }, settings.durationSec * 1000);
}

export function stopAlarm() {
  alarmActive = false;
  if (stopTimeout) { clearTimeout(stopTimeout); stopTimeout = null; }
  if (beepInterval) { clearInterval(beepInterval); beepInterval = null; }
  if (vibrateInterval) { clearInterval(vibrateInterval); vibrateInterval = null; }
  navigator.vibrate?.(0);
  if (audioCtx && audioCtx.state !== "closed") {
    void audioCtx.close();
    audioCtx = null;
  }
}
