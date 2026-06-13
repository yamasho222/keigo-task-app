import { getActiveSessionIds, type PhaseSessionId } from "./japaneseCalendar";

export interface MissionLike {
  dateKey: string;
}

export type MissionOverallStatus = "pending" | "awaiting_reward" | "done";

/** 各フェーズの TaskScreen 行用 */
export type MissionCardStatus =
  | "pending"
  | "session_awaiting_parent"
  | "session_complete"
  | "awaiting_reward"
  | "done";

export function getActiveMissionSessions(now = new Date()): PhaseSessionId[] {
  return getActiveSessionIds(now);
}

export function countCompletedMissionPhases(
  doneSessions: PhaseSessionId[],
  now = new Date(),
): { completed: number; required: number } {
  const required = getActiveSessionIds(now);
  const done = new Set(doneSessions);
  return {
    completed: required.filter((s) => done.has(s)).length,
    required: required.length,
  };
}

export function countParentApprovedPhases(
  approvedSessions: PhaseSessionId[],
  now = new Date(),
): { approved: number; required: number } {
  const required = getActiveSessionIds(now);
  const approved = new Set(approvedSessions);
  return {
    approved: required.filter((s) => approved.has(s)).length,
    required: required.length,
  };
}

export function isAllMissionPhasesParentApproved(
  approvedSessions: PhaseSessionId[],
  now = new Date(),
): boolean {
  const { approved, required } = countParentApprovedPhases(approvedSessions, now);
  return required > 0 && approved === required;
}

export function getMissionOverallStatus(
  mission: MissionLike | null,
  todayKey: string,
  approvedSessions: PhaseSessionId[],
  rewardClaimed: boolean,
  now = new Date(),
): MissionOverallStatus | null {
  if (!mission || mission.dateKey !== todayKey) return null;
  if (rewardClaimed && isAllMissionPhasesParentApproved(approvedSessions, now)) return "done";
  if (isAllMissionPhasesParentApproved(approvedSessions, now)) return "awaiting_reward";
  return "pending";
}

export function getMissionCardStatus(
  mission: MissionLike | null,
  todayKey: string,
  doneSessions: PhaseSessionId[],
  approvedSessions: PhaseSessionId[],
  rewardClaimed: boolean,
  currentSession: PhaseSessionId,
  now = new Date(),
): MissionCardStatus | null {
  const overall = getMissionOverallStatus(mission, todayKey, approvedSessions, rewardClaimed, now);
  if (!overall) return null;
  if (overall === "done") return "done";
  if (overall === "awaiting_reward") return "awaiting_reward";
  if (approvedSessions.includes(currentSession)) return "session_complete";
  if (doneSessions.includes(currentSession)) return "session_awaiting_parent";
  return "pending";
}
