/** 採掘状態の関数更新・競合時の載せ直し */

import {
  writeMaterialCount,
  type CraftedGearId,
  type MaterialId,
  type MiningState,
} from "./miningTypes";
import { syncEndJourney } from "./endJourneyProgress";

export type MiningPatch = (prev: MiningState) => MiningState;

export function patchFromResult(
  run: (prev: MiningState) => { state: MiningState; error?: string },
): MiningPatch {
  return (prev) => {
    const result = run(prev);
    return result.error ? prev : result.state;
  };
}

export function composeMiningPatches(prev: MiningState, patches: MiningPatch[]): MiningState {
  return patches.reduce((state, patch) => patch(state), prev);
}

function countKeys(a: Partial<Record<string, number>>, b: Partial<Record<string, number>>): string[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])];
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function rebaseCombatProgress(
  from: MiningState["combatProgress"],
  latest: MiningState["combatProgress"],
  written: MiningState["combatProgress"],
): MiningState["combatProgress"] {
  const out = { ...(latest ?? {}) };
  for (const location of ["warped_forest", "fortress", "the_end"] as const) {
    const before = from?.[location];
    const next = written?.[location];
    if (sameValue(before, next)) continue;
    if (sameValue(latest?.[location], before)) {
      if (next) out[location] = next;
      else delete out[location];
    }
  }
  return out;
}

function rebaseCombatEncounters(
  from: MiningState["combatEncounters"],
  latest: MiningState["combatEncounters"],
  written: MiningState["combatEncounters"],
): MiningState["combatEncounters"] {
  const out = { ...(latest ?? {}) };
  for (const location of ["warped_forest", "fortress"] as const) {
    const before = from?.[location];
    const next = written?.[location];
    if (sameValue(before, next)) continue;
    if (sameValue(latest?.[location], before)) {
      if (next) out[location] = next;
      else delete out[location];
    }
  }
  return out;
}

/** from → written の差分を latest に載せる（掘りなど乱数つき更新用） */
export function rebaseCountMap(
  from: Partial<Record<string, number>>,
  latest: Partial<Record<string, number>>,
  written: Partial<Record<string, number>>,
): Partial<Record<string, number>> {
  const out: Partial<Record<string, number>> = {};
  for (const key of countKeys(from, { ...latest, ...written })) {
    const n = (latest[key] ?? 0) + (written[key] ?? 0) - (from[key] ?? 0);
    out[key] = Math.max(0, n);
  }
  return out;
}

export function rebaseMiningWrite(
  latest: MiningState,
  from: MiningState,
  written: MiningState,
): MiningState {
  if (latest === from) return written;
  const changedAdventure = !sameValue(from.adventure, written.adventure);
  if (changedAdventure && (!sameValue(latest.adventure, from.adventure)
    || !sameValue(latest.equipped, from.equipped) || !sameValue(latest.crafted, from.crafted)
    || !sameValue(latest.materials, from.materials) || latest.tickets + written.tickets - from.tickets < 0)) return latest;

  // Never apply a stale insertion/search twice (including its inventory/ticket delta).
  const route = (s: MiningState) => [s.endQuest?.eyes ?? 0, s.endQuest?.eyeSlots ?? [], s.endQuest?.visited ?? [], s.endQuest?.foundPortal ?? false];
  if (!sameValue(route(from), route(written)) && !sameValue(route(latest), route(from))) return latest;
  const eyeCost = (from.materials.ender_eye ?? 0) - (written.materials.ender_eye ?? 0);
  if (eyeCost > 0 && (latest.materials.ender_eye ?? 0) < eyeCost) return latest;

  const changedV2 = !sameValue(from.combatV2, written.combatV2);
  if (changedV2 && (!sameValue(latest.combatV2, from.combatV2)
    || !sameValue(latest.equipped, from.equipped)
    || !sameValue(latest.crafted, from.crafted)
    || !sameValue(latest.materials, from.materials)
    || latest.tickets + written.tickets - from.tickets < 0)) return latest;

  const materials: Partial<Record<MaterialId, number>> = {};
  const rebased = rebaseCountMap(from.materials, latest.materials, written.materials);
  for (const [id, amount] of Object.entries(rebased)) {
    writeMaterialCount(materials, id as MaterialId, amount ?? 0);
  }

  const crafted: Partial<Record<CraftedGearId, boolean>> = {
    ...latest.crafted,
    ...written.crafted,
  };
  for (const id of Object.keys(from.crafted) as CraftedGearId[]) {
    if (from.crafted[id] && written.crafted[id] === false) {
      crafted[id] = false;
    }
  }

  let playerHp = latest.playerHp ?? 20;
  let playerHpDate = latest.playerHpDate ?? "";
  if (written.playerHpDate !== from.playerHpDate) {
    if (latest.playerHpDate === from.playerHpDate) {
      playerHp = written.playerHp ?? 20;
      playerHpDate = written.playerHpDate ?? "";
    }
  } else if (latest.playerHpDate === from.playerHpDate) {
    playerHp = Math.max(0, Math.min(20,
      playerHp + (written.playerHp ?? 20) - (from.playerHp ?? 20),
    ));
  }

  const dragonFight = sameValue(from.dragonFight, written.dragonFight)
    ? latest.dragonFight
    : sameValue(latest.dragonFight, from.dragonFight)
      ? written.dragonFight
      : latest.dragonFight;
  const dragonRageSeq = written.dragonRageSeq === from.dragonRageSeq
    ? latest.dragonRageSeq
    : latest.dragonRageSeq === from.dragonRageSeq
      ? written.dragonRageSeq
      : Math.max(0, (latest.dragonRageSeq ?? 0)
        + (written.dragonRageSeq ?? 0) - (from.dragonRageSeq ?? 0));
  const specialGauge = written.specialGauge === from.specialGauge
    ? latest.specialGauge
    : latest.playerHpDate === from.playerHpDate
      ? Math.max(0, Math.min(5,
        (latest.specialGauge ?? 0)
        + (written.specialGauge ?? 0)
        - (from.specialGauge ?? 0),
      ))
      : latest.specialGauge;
  const pendingReviveLocation = written.pendingReviveLocation === from.pendingReviveLocation
    ? latest.pendingReviveLocation
    : latest.pendingReviveLocation === from.pendingReviveLocation
      ? written.pendingReviveLocation
      : latest.pendingReviveLocation;

  const endQuest = sameValue(from.endQuest, written.endQuest) ? latest.endQuest
    : sameValue(latest.endQuest, from.endQuest) ? written.endQuest
    : written.endQuest && latest.endQuest ? {
      ...latest.endQuest,
      // A hint-only update must not restore an older route/mark/eye count.
      ...(!sameValue(route(from), route(written)) ? {
        visited: written.endQuest.visited, mark: written.endQuest.mark, eyes: written.endQuest.eyes,
        eyeSlots: written.endQuest.eyeSlots, lastEyeSlot: written.endQuest.lastEyeSlot,
        fifth: written.endQuest.fifth, fifthStreak: written.endQuest.fifthStreak,
      } : {}),
      ...(written.endQuest.mark !== from.endQuest?.mark && sameValue(route(latest), route(from)) ? { mark: written.endQuest.mark } : {}),
      routeVersion: Math.max(latest.endQuest.routeVersion ?? 0, written.endQuest.routeVersion ?? 0) || undefined,
      enderEyeHintVisits: Math.max(written.endQuest.enderEyeHintVisits, latest.endQuest.enderEyeHintVisits),
      hintVisitKey: (latest.endQuest.hintVisitAt ?? 0) > (written.endQuest.hintVisitAt ?? 0) ? latest.endQuest.hintVisitKey : written.endQuest.hintVisitKey,
      hintVisitAt: Math.max(latest.endQuest.hintVisitAt ?? 0, written.endQuest.hintVisitAt ?? 0),
      foundPortal: written.endQuest.foundPortal || latest.endQuest.foundPortal,
      linked: written.endQuest.linked || latest.endQuest.linked,
      theEndUnlocked: written.endQuest.theEndUnlocked || latest.endQuest.theEndUnlocked,
    } : latest.endQuest ?? written.endQuest;
  const a = syncEndJourney(from).endJourney!;
  const b = syncEndJourney(latest).endJourney!;
  const c = syncEndJourney(written).endJourney!;
  return {
    ...written,
    adventure: changedAdventure ? written.adventure : latest.adventure,
    // A stale inventory/task write must never un-acknowledge a release notice.
    endChapterNotices: {
      fortress: !!(latest.endChapterNotices?.fortress || written.endChapterNotices?.fortress),
      crafting: !!(latest.endChapterNotices?.crafting || written.endChapterNotices?.crafting),
    },
    endQuest,
    endJourney: {
      rodsAcquired: Math.min(4, Math.max(b.rodsAcquired, b.rodsAcquired + c.rodsAcquired - a.rodsAcquired)),
      rodBalance: materials.blaze_rod ?? 0,
      debrisFound: b.debrisFound || c.debrisFound,
    },
    unlockedGachas: [...new Set([...latest.unlockedGachas, ...written.unlockedGachas])],
    tickets: Math.max(0, latest.tickets + (written.tickets - from.tickets)),
    miningPoints: Math.max(0, latest.miningPoints + (written.miningPoints - from.miningPoints)),
    materials,
    crafted,
    playerHp,
    playerHpDate,
    combatProgress: rebaseCombatProgress(from.combatProgress, latest.combatProgress, written.combatProgress),
    combatV2: changedV2 ? written.combatV2 : latest.combatV2,
    combatEncounters: rebaseCombatEncounters(from.combatEncounters, latest.combatEncounters, written.combatEncounters),
    pendingReviveLocation,
    dragonFight,
    dragonRageSeq,
    specialGauge,
    ticketStampedSessions: {
      ...written.ticketStampedSessions,
      ...latest.ticketStampedSessions,
    },
    fullDayTicketClaimed: {
      ...written.fullDayTicketClaimed,
      ...latest.fullDayTicketClaimed,
    },
    streakTicketClaimed: {
      ...written.streakTicketClaimed,
      ...latest.streakTicketClaimed,
    },
    bedtimeTicketEligibleNight: {
      ...written.bedtimeTicketEligibleNight,
      ...latest.bedtimeTicketEligibleNight,
    },
    bedtimeTicketClaimed: {
      ...written.bedtimeTicketClaimed,
      ...latest.bedtimeTicketClaimed,
    },
    luckyBonusClaimedDate: written.luckyBonusClaimedDate ?? latest.luckyBonusClaimedDate,
  };
}
