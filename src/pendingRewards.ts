import type { DailyMission } from "./missions";
import type { SpecialRewardFloor } from "./sharedTasks";
import { SESSION_IDS, type SessionId } from "./sharedTasks";
import {
  ownedRewardTicketKinds,
  rewardTicketLabel,
  totalRewardTickets,
  type RewardTicketInventory,
  type RewardTicketKind,
} from "./rewardTickets";
import { BRAINROD_COMPENSATION_CLAIM_KEY } from "./compensationGrants";

export type PendingRewardKind =
  | "daily"
  | "deadline"
  | "threeDay"
  | "weekly"
  | "fifteenDay"
  | "thirtyDay"
  | "specialMission"
  | "oneOffSpecial"
  | "fullDayBonus"
  | "voucher"
  | "compensation";

export interface PendingRewardItem {
  id: string;
  kind: PendingRewardKind;
  label: string;
  session?: SessionId;
  claimKey?: string;
  /** ごほうびチケット開封用 */
  voucherKind?: RewardTicketKind;
  /** 溜まった日（日付またぎの受け取り用） */
  dateKey?: string;
}

export interface PendingRewardsContext {
  todayKey: string;
  taskDayKey: string;
  sessionApproved: Record<SessionId, boolean>;
  dailyTreatClaimed: Record<string, boolean>;
  dailyTreatPending: Record<string, boolean>;
  fullDayBonusClaimed: Record<string, boolean>;
  fullDayBonusTreatPending: Record<string, boolean>;
  deadlineTreatClaimed: Record<string, SpecialRewardFloor>;
  deadlineTreatPending: Record<string, SpecialRewardFloor>;
  weeklyTreatPending: Record<string, number>;
  lastWeeklyRewardStreak: number;
  threeDayTreatPending: Record<string, number>;
  lastThreeDayRewardStreak: number;
  fifteenDayTreatPending: Record<string, number>;
  lastFifteenDayRewardStreak: number;
  thirtyDayTreatPending: Record<string, number>;
  lastThirtyDayRewardStreak: number;
  specialMissionRewardClaimed: Record<string, boolean>;
  specialMissionTreatPending: Record<string, boolean>;
  oneOffSpecialClaimed: Record<string, boolean>;
  oneOffSpecialTreatPending: Record<string, SpecialRewardFloor>;
  todayMission: DailyMission | null;
  currentTaskDay: string;
  missionApprovedSessions?: SessionId[];
  missionRewardClaimedToday: boolean;
  missionHistory?: Record<string, { title: string; emoji: string }>;
  oneOffLabels?: Record<string, string>;
  rewardTickets?: RewardTicketInventory;
  /** けいご専用の1回限りガチャ */
  compensationAvailable?: boolean;
  /** 親はんこ履歴。pending未書き込みの日付またぎ日次ごほうびを拾う */
  sessionHistory?: Record<string, Partial<Record<SessionId, boolean>>>;
  sessionSickSkip?: Record<string, Partial<Record<SessionId, boolean>>>;
  catchUpDateKeys?: Record<string, unknown>;
}

export type PersistableTreat = {
  mode: string;
  session?: SessionId;
  claimDateKey?: string;
  deadlineRewardFloor?: SpecialRewardFloor;
  weeklyMilestoneStreak?: number;
  threeDayMilestoneStreak?: number;
  fifteenDayMilestoneStreak?: number;
  thirtyDayMilestoneStreak?: number;
  oneOffSpecialClaimKey?: string;
  rewardFloor?: SpecialRewardFloor;
};

export interface PendingTreatMaps {
  dailyTreatPending: Record<string, boolean>;
  fullDayBonusTreatPending: Record<string, boolean>;
  deadlineTreatPending: Record<string, SpecialRewardFloor>;
  weeklyTreatPending: Record<string, number>;
  threeDayTreatPending: Record<string, number>;
  fifteenDayTreatPending: Record<string, number>;
  thirtyDayTreatPending: Record<string, number>;
  specialMissionTreatPending: Record<string, boolean>;
  oneOffSpecialTreatPending: Record<string, SpecialRewardFloor>;
}

/** ガチャを開けなかった権利を pending に残す（夜ロックなど） */
export function mergeQueueIntoPendingMaps(
  maps: PendingTreatMaps,
  queue: PersistableTreat[],
  fallbackDateKey: string,
): PendingTreatMaps {
  const next: PendingTreatMaps = {
    dailyTreatPending: { ...maps.dailyTreatPending },
    fullDayBonusTreatPending: { ...maps.fullDayBonusTreatPending },
    deadlineTreatPending: { ...maps.deadlineTreatPending },
    weeklyTreatPending: { ...maps.weeklyTreatPending },
    threeDayTreatPending: { ...maps.threeDayTreatPending },
    fifteenDayTreatPending: { ...maps.fifteenDayTreatPending },
    thirtyDayTreatPending: { ...maps.thirtyDayTreatPending },
    specialMissionTreatPending: { ...maps.specialMissionTreatPending },
    oneOffSpecialTreatPending: { ...maps.oneOffSpecialTreatPending },
  };

  for (const treat of queue) {
    const day = treat.claimDateKey ?? fallbackDateKey;
    if (treat.mode === "daily" && treat.session) {
      next.dailyTreatPending[sessionTreatKey(day, treat.session)] = true;
    } else if (treat.mode === "fullDayBonus") {
      next.fullDayBonusTreatPending[day] = true;
    } else if (treat.mode === "deadline" && treat.deadlineRewardFloor) {
      next.deadlineTreatPending[day] = treat.deadlineRewardFloor;
    } else if (treat.mode === "weekly" && treat.weeklyMilestoneStreak !== undefined) {
      next.weeklyTreatPending[day] = treat.weeklyMilestoneStreak;
    } else if (treat.mode === "threeDayStreak" && treat.threeDayMilestoneStreak !== undefined) {
      next.threeDayTreatPending[day] = treat.threeDayMilestoneStreak;
    } else if (treat.mode === "fifteenDayStreak" && treat.fifteenDayMilestoneStreak !== undefined) {
      next.fifteenDayTreatPending[day] = treat.fifteenDayMilestoneStreak;
    } else if (treat.mode === "thirtyDayStreak" && treat.thirtyDayMilestoneStreak !== undefined) {
      next.thirtyDayTreatPending[day] = treat.thirtyDayMilestoneStreak;
    } else if (treat.mode === "specialMission") {
      next.specialMissionTreatPending[day] = true;
    } else if (treat.mode === "oneOffSpecial" && treat.oneOffSpecialClaimKey) {
      const floor = treat.rewardFloor ?? treat.deadlineRewardFloor ?? "rare";
      next.oneOffSpecialTreatPending[treat.oneOffSpecialClaimKey] = floor;
    }
  }

  return next;
}

const SESSION_DAILY_LABELS: Record<SessionId, string> = {
  morning: "朝のごほうび",
  daytime: "昼のごほうび",
  home: "帰宅後のごほうび",
  evening: "夜のごほうび",
};

export function sessionTreatKey(date: string, session: SessionId) {
  return `${date}:${session}`;
}

export function parseSessionTreatKey(key: string): { date: string; session: SessionId } | null {
  const sep = key.lastIndexOf(":");
  if (sep <= 0) return null;
  const date = key.slice(0, sep);
  const session = key.slice(sep + 1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!SESSION_IDS.includes(session as SessionId)) return null;
  return { date, session: session as SessionId };
}

function isSessionTreatClaimed(claimed: Record<string, boolean>, date: string, session: SessionId) {
  if (claimed[sessionTreatKey(date, session)]) return true;
  if (claimed[date]) return true;
  return false;
}

function isSessionDailyUnclaimed(ctx: PendingRewardsContext, session: SessionId): boolean {
  if (!ctx.sessionApproved[session]) return false;
  const key = sessionTreatKey(ctx.todayKey, session);
  if (ctx.dailyTreatPending[key]) return true;
  return !isSessionTreatClaimed(ctx.dailyTreatClaimed, ctx.todayKey, session);
}

function pushStreakItem(
  items: PendingRewardItem[],
  pending: Record<string, number>,
  lastClaimed: number,
  kind: PendingRewardKind,
  label: string,
) {
  const seen = new Set<number>();
  for (const [dateKey, streak] of Object.entries(pending)) {
    if (streak === undefined || lastClaimed >= streak || seen.has(streak)) continue;
    seen.add(streak);
    items.push({
      id: `${kind}:${dateKey}`,
      kind,
      label,
      dateKey,
    });
  }
}

export function getPendingRewardItems(ctx: PendingRewardsContext): PendingRewardItem[] {
  const items: PendingRewardItem[] = [];

  if (ctx.compensationAvailable) {
    items.push({
      id: `compensation:${BRAINROD_COMPENSATION_CLAIM_KEY}`,
      kind: "compensation",
      label: "とくべつなガチャ",
      claimKey: BRAINROD_COMPENSATION_CLAIM_KEY,
    });
  }

  const dailySeen = new Set<string>();
  for (const [key, pending] of Object.entries(ctx.dailyTreatPending)) {
    if (!pending) continue;
    const parsed = parseSessionTreatKey(key);
    if (!parsed) continue;
    if (isSessionTreatClaimed(ctx.dailyTreatClaimed, parsed.date, parsed.session)) continue;
    dailySeen.add(`${parsed.date}:${parsed.session}`);
    items.push({
      id: `daily:${key}`,
      kind: "daily",
      label: SESSION_DAILY_LABELS[parsed.session],
      session: parsed.session,
      dateKey: parsed.date,
    });
  }
  for (const sid of SESSION_IDS) {
    if (!isSessionDailyUnclaimed(ctx, sid)) continue;
    const seenKey = `${ctx.todayKey}:${sid}`;
    if (dailySeen.has(seenKey)) continue;
    items.push({
      id: `daily:${sid}`,
      kind: "daily",
      label: SESSION_DAILY_LABELS[sid],
      session: sid,
      dateKey: ctx.todayKey,
    });
  }

  for (const [dateKey, day] of Object.entries(ctx.sessionHistory ?? {})) {
    if (dateKey === ctx.todayKey) continue;
    if (ctx.catchUpDateKeys && dateKey in ctx.catchUpDateKeys) continue;
    for (const sid of SESSION_IDS) {
      if (!day[sid]) continue;
      if (ctx.sessionSickSkip?.[dateKey]?.[sid]) continue;
      if (isSessionTreatClaimed(ctx.dailyTreatClaimed, dateKey, sid)) continue;
      const seenKey = `${dateKey}:${sid}`;
      if (dailySeen.has(seenKey)) continue;
      dailySeen.add(seenKey);
      items.push({
        id: `daily:${dateKey}:${sid}`,
        kind: "daily",
        label: SESSION_DAILY_LABELS[sid],
        session: sid,
        dateKey,
      });
    }
  }

  for (const [dateKey, floor] of Object.entries(ctx.deadlineTreatPending)) {
    if (floor === undefined || ctx.deadlineTreatClaimed[dateKey]) continue;
    items.push({
      id: `deadline:${dateKey}`,
      kind: "deadline",
      label: "締切クリア ごほうび",
      dateKey,
    });
  }

  pushStreakItem(items, ctx.threeDayTreatPending, ctx.lastThreeDayRewardStreak, "threeDay", "3日連続 ごほうび");
  pushStreakItem(items, ctx.weeklyTreatPending, ctx.lastWeeklyRewardStreak, "weekly", "7日連続 ごほうび");
  pushStreakItem(items, ctx.fifteenDayTreatPending, ctx.lastFifteenDayRewardStreak, "fifteenDay", "15日連続 ごほうび");
  pushStreakItem(items, ctx.thirtyDayTreatPending, ctx.lastThirtyDayRewardStreak, "thirtyDay", "30日連続 ごほうび");

  for (const [dateKey, pending] of Object.entries(ctx.fullDayBonusTreatPending)) {
    if (!pending || ctx.fullDayBonusClaimed[dateKey]) continue;
    items.push({
      id: `fullDayBonus:${dateKey}`,
      kind: "fullDayBonus",
      label: "1日ぜんぶクリア ボーナス",
      dateKey,
    });
  }

  const missionSeen = new Set<string>();
  for (const [dateKey, pending] of Object.entries(ctx.specialMissionTreatPending)) {
    if (!pending || ctx.specialMissionRewardClaimed[dateKey]) continue;
    const current = ctx.todayMission && ctx.currentTaskDay === dateKey ? ctx.todayMission : null;
    const hist = ctx.missionHistory?.[dateKey];
    const title = current
      ? `${current.emoji} ${current.title}`
      : hist
        ? `${hist.emoji} ${hist.title}`
        : "ミッション";
    missionSeen.add(dateKey);
    items.push({
      id: `specialMission:${dateKey}`,
      kind: "specialMission",
      label: `${title} のごほうび`,
      dateKey,
    });
  }
  for (const [dateKey, hist] of Object.entries(ctx.missionHistory ?? {})) {
    if (ctx.specialMissionRewardClaimed[dateKey]) continue;
    if (missionSeen.has(dateKey)) continue;
    missionSeen.add(dateKey);
    items.push({
      id: `specialMission:${dateKey}`,
      kind: "specialMission",
      label: `${hist.emoji} ${hist.title} のごほうび`,
      dateKey,
    });
  }

  for (const claimKey of Object.keys(ctx.oneOffSpecialTreatPending)) {
    if (ctx.oneOffSpecialTreatPending[claimKey] === undefined || ctx.oneOffSpecialClaimed[claimKey]) continue;
    items.push({
      id: `oneOff:${claimKey}`,
      kind: "oneOffSpecial",
      label: ctx.oneOffLabels?.[claimKey] ?? "特別ミッションのごほうび",
      claimKey,
    });
  }

  const tickets = ctx.rewardTickets;
  if (tickets) {
    for (const kind of ownedRewardTicketKinds(tickets)) {
      const n = tickets[kind];
      items.push({
        id: `voucher:${kind}`,
        kind: "voucher",
        label: n > 1 ? `${rewardTicketLabel(kind)} ×${n}` : rewardTicketLabel(kind),
        voucherKind: kind,
      });
    }
  }

  return items;
}

export function pendingRewardCount(ctx: PendingRewardsContext): number {
  const base = getPendingRewardItems(ctx).filter((i) => i.kind !== "voucher").length;
  const tickets = ctx.rewardTickets;
  if (!tickets) return base;
  return base + totalRewardTickets(tickets);
}
