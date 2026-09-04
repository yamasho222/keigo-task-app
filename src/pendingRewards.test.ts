import { describe, expect, it } from "vitest";
import {
  getPendingRewardItems,
  mergeQueueIntoPendingMaps,
  parseSessionTreatKey,
  sessionTreatKey,
  type PendingRewardsContext,
} from "./pendingRewards";
import { SESSION_IDS } from "./sharedTasks";

function emptyCtx(overrides: Partial<PendingRewardsContext> = {}): PendingRewardsContext {
  return {
    todayKey: "2026-08-30",
    taskDayKey: "2026-08-30",
    sessionApproved: { morning: false, daytime: false, home: false, evening: false },
    dailyTreatClaimed: {},
    dailyTreatPending: {},
    fullDayBonusClaimed: {},
    fullDayBonusTreatPending: {},
    deadlineTreatClaimed: {},
    deadlineTreatPending: {},
    weeklyTreatPending: {},
    lastWeeklyRewardStreak: 0,
    threeDayTreatPending: {},
    lastThreeDayRewardStreak: 0,
    fifteenDayTreatPending: {},
    lastFifteenDayRewardStreak: 0,
    thirtyDayTreatPending: {},
    lastThirtyDayRewardStreak: 0,
    specialMissionRewardClaimed: {},
    specialMissionTreatPending: {},
    oneOffSpecialClaimed: {},
    oneOffSpecialTreatPending: {},
    todayMission: null,
    currentTaskDay: "2026-08-30",
    missionRewardClaimedToday: false,
    ...overrides,
  };
}

describe("parseSessionTreatKey", () => {
  it("parses date and session", () => {
    expect(parseSessionTreatKey("2026-08-29:evening")).toEqual({
      date: "2026-08-29",
      session: "evening",
    });
  });
});

describe("getPendingRewardItems leftover days", () => {
  it("keeps yesterday's unclaimed daily treat after the day rolls", () => {
    const yesterday = sessionTreatKey("2026-08-29", "evening");
    const items = getPendingRewardItems(emptyCtx({
      dailyTreatPending: { [yesterday]: true },
    }));
    expect(items.some((i) => i.kind === "daily" && i.session === "evening" && i.dateKey === "2026-08-29")).toBe(true);
  });

  it("keeps yesterday's full-day and deadline treats", () => {
    const items = getPendingRewardItems(emptyCtx({
      fullDayBonusTreatPending: { "2026-08-29": true },
      deadlineTreatPending: { "2026-08-29": "rare" },
    }));
    expect(items.some((i) => i.kind === "fullDayBonus" && i.dateKey === "2026-08-29")).toBe(true);
    expect(items.some((i) => i.kind === "deadline" && i.dateKey === "2026-08-29")).toBe(true);
  });

  it("keeps a leftover 3-day streak treat", () => {
    const items = getPendingRewardItems(emptyCtx({
      threeDayTreatPending: { "2026-08-29": 3 },
      lastThreeDayRewardStreak: 0,
    }));
    expect(items.some((i) => i.kind === "threeDay" && i.dateKey === "2026-08-29")).toBe(true);
  });

  it("keeps a leftover mission treat using missionHistory", () => {
    const items = getPendingRewardItems(emptyCtx({
      specialMissionTreatPending: { "2026-08-29": true },
      specialMissionRewardClaimed: {},
      missionHistory: { "2026-08-29": { title: "音読", emoji: "📖" } },
    }));
    const mission = items.find((i) => i.kind === "specialMission");
    expect(mission?.dateKey).toBe("2026-08-29");
    expect(mission?.label).toContain("音読");
  });

  it("still lists today's approved daily when there is no leftover", () => {
    const items = getPendingRewardItems(emptyCtx({
      sessionApproved: { morning: true, daytime: false, home: false, evening: false },
    }));
    expect(items.some((i) => i.kind === "daily" && i.session === "morning" && i.dateKey === "2026-08-30")).toBe(true);
    expect(SESSION_IDS.length).toBeGreaterThan(0);
  });

  it("recovers yesterday's daily from session history when pending was never written", () => {
    const items = getPendingRewardItems(emptyCtx({
      sessionHistory: {
        "2026-08-29": { morning: true, daytime: false, home: false, evening: true },
      },
    }));
    expect(items.some((i) => i.kind === "daily" && i.session === "morning" && i.dateKey === "2026-08-29")).toBe(true);
    expect(items.some((i) => i.kind === "daily" && i.session === "evening" && i.dateKey === "2026-08-29")).toBe(true);
  });

  it("does not recover history days that were already claimed or sick-skipped", () => {
    const items = getPendingRewardItems(emptyCtx({
      sessionHistory: {
        "2026-08-29": { morning: true, evening: true },
      },
      dailyTreatClaimed: { [sessionTreatKey("2026-08-29", "morning")]: true },
      sessionSickSkip: { "2026-08-29": { evening: true } },
    }));
    expect(items.some((i) => i.kind === "daily" && i.dateKey === "2026-08-29")).toBe(false);
  });

  it("does not recover catch-up days as daily treats", () => {
    const items = getPendingRewardItems(emptyCtx({
      sessionHistory: {
        "2026-08-20": { morning: true, daytime: true, home: true, evening: true },
      },
      catchUpDateKeys: { "2026-08-20": {} },
    }));
    expect(items.some((i) => i.kind === "daily" && i.dateKey === "2026-08-20")).toBe(false);
  });

  it("recovers a leftover mission from missionHistory without pending", () => {
    const items = getPendingRewardItems(emptyCtx({
      missionHistory: { "2026-08-29": { title: "音読", emoji: "📖" } },
    }));
    const mission = items.find((i) => i.kind === "specialMission");
    expect(mission?.dateKey).toBe("2026-08-29");
    expect(mission?.label).toContain("音読");
  });
});

describe("mergeQueueIntoPendingMaps", () => {
  it("stores a blocked daily treat under the night's date", () => {
    const merged = mergeQueueIntoPendingMaps({
      dailyTreatPending: {},
      fullDayBonusTreatPending: {},
      deadlineTreatPending: {},
      weeklyTreatPending: {},
      threeDayTreatPending: {},
      fifteenDayTreatPending: {},
      thirtyDayTreatPending: {},
      specialMissionTreatPending: {},
      oneOffSpecialTreatPending: {},
    }, [{ mode: "daily", session: "evening", claimDateKey: "2026-08-29" }], "2026-08-30");
    expect(merged.dailyTreatPending[sessionTreatKey("2026-08-29", "evening")]).toBe(true);
  });
});
