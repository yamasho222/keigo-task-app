import { parseDateKey } from "./japaneseCalendar";
import { addTickets } from "./miningProgress";
import type { MiningState } from "./miningTypes";

/** 早ね宣言の締切（21:00 まで） */
export const BEDTIME_DEADLINE_MINUTES = 21 * 60;
/** 翌朝チケット付与開始時刻 */
export const BEDTIME_CLAIM_HOUR = 5;

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

/** 付与可能か（翌日 5:00 以降） */
export function isBedtimeTicketClaimable(nightDate: string, now: Date): boolean {
  const claimDay = addCalendarDays(nightDate, 1);
  const claimAt = parseDateKey(claimDay);
  claimAt.setHours(BEDTIME_CLAIM_HOUR, 0, 0, 0);
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
  if (!opts.eveningAllResolved) return "hidden";
  if (opts.state.bedtimeTicketClaimed[opts.nightDate]) return "claimed";
  if (opts.state.bedtimeTicketEligibleNight[opts.nightDate]) return "declared";
  if (localDateKey(now) !== opts.nightDate) {
    // 日付が変わったあとでも、未宣言の夜は missed として見せない（hidden）
    return "hidden";
  }
  if (!isBeforeBedtimeDeadline(now)) return "missed";
  return "ready";
}
