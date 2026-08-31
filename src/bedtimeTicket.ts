import { parseDateKey } from "./japaneseCalendar";
import { addTickets } from "./miningProgress";
import type { MiningState } from "./miningTypes";

/** 夜の遊びロック開始（21:00）。早ねボタンの締切とは別 */
export const NIGHT_PLAY_LOCK_START_MINUTES = 21 * 60;
/** 早ね宣言の締切（21:30 まで） */
export const BEDTIME_DEADLINE_MINUTES = 21 * 60 + 30;
/** 翌朝チケット付与・遊びロック解除 */
export const BEDTIME_CLAIM_HOUR = 6;
export const BEDTIME_CLAIM_MINUTE = 30;
export const BEDTIME_CLAIM_MINUTES = BEDTIME_CLAIM_HOUR * 60 + BEDTIME_CLAIM_MINUTE;

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addCalendarDays(dateKey: string, days: number): string {
  const d = parseDateKey(dateKey);
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}

function minutesOfDay(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

export function isBeforeBedtimeDeadline(now: Date): boolean {
  return minutesOfDay(now) <= BEDTIME_DEADLINE_MINUTES;
}

export function canDeclareBedtime(opts: {
  now?: Date;
  nightDate: string;
  state: MiningState;
  eveningAllResolved: boolean;
}): boolean {
  const now = opts.now ?? new Date();
  if (!opts.eveningAllResolved) return false;
  if (localDateKey(now) !== opts.nightDate) return false;
  if (!isBeforeBedtimeDeadline(now)) return false;
  if (opts.state.bedtimeTicketEligibleNight[opts.nightDate]) return false;
  if (opts.state.bedtimeTicketClaimed[opts.nightDate]) return false;
  return true;
}

export function declareBedtime(
  state: MiningState,
  nightDate: string,
  opts: { now?: Date; eveningAllResolved: boolean },
): MiningState | null {
  if (!canDeclareBedtime({
    now: opts.now,
    nightDate,
    state,
    eveningAllResolved: opts.eveningAllResolved,
  })) {
    return null;
  }
  return {
    ...state,
    bedtimeTicketEligibleNight: {
      ...state.bedtimeTicketEligibleNight,
      [nightDate]: true,
    },
  };
}

/** 未付与の宣言だけ取り消せる（チケット回収はしない） */
export function canRevokeBedtimeDeclaration(opts: {
  state: MiningState;
  nightDate: string;
}): boolean {
  if (!opts.state.bedtimeTicketEligibleNight[opts.nightDate]) return false;
  if (opts.state.bedtimeTicketClaimed[opts.nightDate]) return false;
  return true;
}

export function revokeBedtimeDeclaration(
  state: MiningState,
  nightDate: string,
): MiningState | null {
  if (!canRevokeBedtimeDeclaration({ state, nightDate })) return null;
  const eligible = { ...state.bedtimeTicketEligibleNight };
  delete eligible[nightDate];
  return {
    ...state,
    bedtimeTicketEligibleNight: eligible,
  };
}

/**
 * 夜パネルに使う nightDate。
 * 今日の宣言／宣言待ちを優先し、日付またぎでまだ 6:30 前の未付与があれば昨夜を返す。
 */
export function getBedtimePanelNightDate(opts: {
  now?: Date;
  state: MiningState;
}): string {
  const now = opts.now ?? new Date();
  const today = localDateKey(now);
  const yesterday = addCalendarDays(today, -1);

  if (opts.state.bedtimeTicketClaimed[today] || opts.state.bedtimeTicketEligibleNight[today]) {
    return today;
  }
  if (
    opts.state.bedtimeTicketEligibleNight[yesterday]
    && !opts.state.bedtimeTicketClaimed[yesterday]
    && !isBedtimeTicketClaimable(yesterday, now)
  ) {
    return yesterday;
  }
  return today;
}

/** 付与可能か（翌日 6:30 以降） */
export function isBedtimeTicketClaimable(nightDate: string, now: Date): boolean {
  const claimDay = addCalendarDays(nightDate, 1);
  const claimAt = parseDateKey(claimDay);
  claimAt.setHours(BEDTIME_CLAIM_HOUR, BEDTIME_CLAIM_MINUTE, 0, 0);
  return now.getTime() >= claimAt.getTime();
}

export function claimDueBedtimeTickets(
  state: MiningState,
  now = new Date(),
): { nextState: MiningState; granted: number; claimedNights: string[] } {
  const claimedNights: string[] = [];
  let next = state;

  for (const nightDate of Object.keys(state.bedtimeTicketEligibleNight)) {
    if (!state.bedtimeTicketEligibleNight[nightDate]) continue;
    if (state.bedtimeTicketClaimed[nightDate] || next.bedtimeTicketClaimed[nightDate]) continue;
    if (!isBedtimeTicketClaimable(nightDate, now)) continue;
    next = addTickets(next, 1);
    next = {
      ...next,
      bedtimeTicketClaimed: {
        ...next.bedtimeTicketClaimed,
        [nightDate]: true,
      },
    };
    claimedNights.push(nightDate);
  }

  return { nextState: next, granted: claimedNights.length, claimedNights };
}

export type BedtimePanelStatus =
  | "hidden"
  | "ready"
  | "declared"
  | "missed"
  | "claimed";

export function getBedtimePanelStatus(opts: {
  now?: Date;
  nightDate: string;
  state: MiningState;
  eveningAllResolved: boolean;
}): BedtimePanelStatus {
  const now = opts.now ?? new Date();
  if (opts.state.bedtimeTicketClaimed[opts.nightDate]) return "claimed";
  if (opts.state.bedtimeTicketEligibleNight[opts.nightDate]) return "declared";
  if (!opts.eveningAllResolved) return "hidden";
  if (localDateKey(now) !== opts.nightDate) {
    // 日付が変わったあとでも、未宣言の夜は missed として見せない（hidden）
    return "hidden";
  }
  if (!isBeforeBedtimeDeadline(now)) return "missed";
  return "ready";
}
