/** 採掘状態の関数更新・競合時の載せ直し */

import {
  writeMaterialCount,
  type CraftedGearId,
  type MaterialId,
  type MiningState,
} from "./miningTypes";

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

  return {
    ...written,
    tickets: Math.max(0, latest.tickets + (written.tickets - from.tickets)),
    miningPoints: Math.max(0, latest.miningPoints + (written.miningPoints - from.miningPoints)),
    materials,
    crafted,
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
