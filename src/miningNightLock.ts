import { BEDTIME_CLAIM_HOUR, BEDTIME_DEADLINE_MINUTES } from "./bedtimeTicket";

/** 未保存はロック ON */
export function normalizeMiningNightLockEnabled(value: unknown): boolean {
  return value !== false;
}

function minutesOfDay(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 21:00:00 以降〜翌朝 5:00:00 手前 */
export function isMiningNightHours(now: Date): boolean {
  const minutes = minutesOfDay(now);
  return minutes >= BEDTIME_DEADLINE_MINUTES || minutes < BEDTIME_CLAIM_HOUR * 60;
}

export function isMiningNightLocked(opts: {
  enabled: boolean;
  now?: Date;
}): boolean {
  if (!opts.enabled) return false;
  return isMiningNightHours(opts.now ?? new Date());
}

/** 21:00〜翌5:00 を同じ夜として扱うキー（0〜4時は前日） */
export function miningNightLockNightKey(now: Date): string {
  const d = new Date(now.getTime());
  if (d.getHours() < BEDTIME_CLAIM_HOUR) {
    d.setDate(d.getDate() - 1);
  }
  return localDateKey(d);
}

export function shouldAutoShowMiningNightEnd(opts: {
  enabled: boolean;
  now?: Date;
  shownNightKey: string | null;
}): { show: boolean; nightKey: string } {
  const now = opts.now ?? new Date();
  const nightKey = miningNightLockNightKey(now);
  if (!isMiningNightLocked({ enabled: opts.enabled, now })) {
    return { show: false, nightKey };
  }
  if (opts.shownNightKey === nightKey) {
    return { show: false, nightKey };
  }
  return { show: true, nightKey };
}
