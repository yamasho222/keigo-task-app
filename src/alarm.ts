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
let soundBlocked = false;
let stopTimeout: ReturnType<typeof setTimeout> | null = null;
let beepInterval: ReturnType<typeof setInterval> | null = null;
let vibrateInterval: ReturnType<typeof setInterval> | null = null;
let audioCtx: AudioContext | null = null;
let onSoundBlockedChange: ((blocked: boolean) => void) | null = null;

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

/** ユーザータップ後に呼ぶと iOS でも音が鳴るようになる */
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

function playAttentionBeep() {
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== "running") return;
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

async function startSoundLoop() {
  const ok = await ensureAudioRunning();
  if (!ok) return;
  playAttentionBeep();
  beepInterval = setInterval(() => {
    if (!alarmActive) return;
    void (async () => {
      if (await ensureAudioRunning()) playAttentionBeep();
    })();
  }, 900);
}

/** アラーム中にタップされたとき、音が止まっていたら再開を試みる */
export async function retryAlarmSound() {
  if (!alarmActive) return false;
  const ok = await unlockAudio();
  if (!ok) return false;
  if (!beepInterval) {
    playAttentionBeep();
    beepInterval = setInterval(() => {
      if (!alarmActive) return;
      if (audioCtx?.state === "running") playAttentionBeep();
    }, 900);
  }
  return true;
}

export function startAlarm(settings: AlarmSettings, onStop?: () => void) {
  stopAlarm();
  alarmActive = true;

  if (settings.soundEnabled) void startSoundLoop();
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
