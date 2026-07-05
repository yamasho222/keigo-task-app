import type { DailyMission } from "./missions";
import type { SpecialRewardFloor } from "./sharedTasks";
import { SESSION_IDS, type SessionId } from "./sharedTasks";

export type PendingRewardKind =
  | "daily"
  | "deadline"
  | "threeDay"
  | "weekly"
  | "specialMission"
  | "oneOffSpecial"
  | "fullDayBonus";

export interface PendingRewardItem {
  id: string;
  kind: PendingRewardKind;
  label: string;
  session?: SessionId;
  claimKey?: string;
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
  specialMissionRewardClaimed: Record<string, boolean>;
  specialMissionTreatPending: Record<string, boolean>;
  oneOffSpecialClaimed: Record<string, boolean>;
  oneOffSpecialTreatPending: Record<string, boolean>;
  todayMission: DailyMission | null;
  currentTaskDay: string;
  missionApprovedSessions?: SessionId[];
  missionRewardClaimedToday: boolean;
  oneOffLabels?: Record<string, string>;
}

const SESSION_DAILY_LABELS: Record<SessionId, string> = {
  morning: "朝のごほうび",
  daytime: "昼のごほうび",
  home: "帰宅後のごほうび",
  evening: "夜のごほうび",
};

function sessionTreatKey(date: string, session: SessionId) {
  return `${date}:${session}`;
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

export function getPendingRewardItems(ctx: PendingRewardsContext): PendingRewardItem[] {
  const items: PendingRewardItem[] = [];

  for (const sid of SESSION_IDS) {
    if (!isSessionDailyUnclaimed(ctx, sid)) continue;
    items.push({
      id: `daily:${sid}`,
      kind: "daily",
      label: SESSION_DAILY_LABELS[sid],
      session: sid,
    });
  }

  const dayKey = ctx.taskDayKey;
  if (!ctx.deadlineTreatClaimed[dayKey] && ctx.deadlineTreatPending[dayKey] !== undefined) {
    items.push({
      id: "deadline",
      kind: "deadline",
      label: "締切クリア ごほうび",
    });
  }

  const threeDayStreak = ctx.threeDayTreatPending[ctx.todayKey];
  if (threeDayStreak !== undefined && ctx.lastThreeDayRewardStreak < threeDayStreak) {
    items.push({
      id: "threeDay",
      kind: "threeDay",
      label: "3日連続 ごほうび",
    });
  }

  const weeklyStreak = ctx.weeklyTreatPending[ctx.todayKey];
  if (weeklyStreak !== undefined && ctx.lastWeeklyRewardStreak < weeklyStreak) {
    items.push({
      id: "weekly",
      kind: "weekly",
      label: "7日連続 ごほうび",
    });
  }

  if (ctx.fullDayBonusTreatPending[ctx.todayKey] && !ctx.fullDayBonusClaimed[ctx.todayKey]) {
    items.push({
      id: "fullDayBonus",
      kind: "fullDayBonus",
      label: "1日ぜんぶクリア ボーナス",
    });
  }

  if (
    ctx.todayMission
    && ctx.specialMissionTreatPending[ctx.currentTaskDay]
    && !ctx.missionRewardClaimedToday
  ) {
    items.push({
      id: "specialMission",
      kind: "specialMission",
      label: `${ctx.todayMission.emoji} ${ctx.todayMission.title} のごほうび`,
    });
  }

  for (const claimKey of Object.keys(ctx.oneOffSpecialTreatPending)) {
    if (!ctx.oneOffSpecialTreatPending[claimKey] || ctx.oneOffSpecialClaimed[claimKey]) continue;
    items.push({
      id: `oneOff:${claimKey}`,
      kind: "oneOffSpecial",
      label: ctx.oneOffLabels?.[claimKey] ?? "特別ミッションのごほうび",
      claimKey,
    });
  }

  return items;
}

export function pendingRewardCount(ctx: PendingRewardsContext): number {
  return getPendingRewardItems(ctx).length;
}
