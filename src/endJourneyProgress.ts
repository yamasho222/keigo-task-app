/** Progress-only migrations. No inventory grants, tickets, randomness, or battle rules. */
import type { EndQuestState, GachaId, MiningState } from "./miningTypes";

export interface EndJourneyProgress {
  rodsAcquired: number;
  rodBalance: number;
  debrisFound: boolean;
}

const count = (n: unknown) => typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
export const END_SEARCH_PLACES: GachaId[] = ["wood", "farm", "ranch", "stone", "iron", "coal", "gold", "diamond", "lapis_cave", "nether"];
export const END_SEARCH_FINAL_PLACES: GachaId[] = ["stone", "iron", "coal", "gold", "diamond", "lapis_cave"];
export const END_SEARCH_STOPS = 5;
export const END_ROUTE_VERSION = 3;

export function portalEyeSlots(q: Pick<EndQuestState, 'eyes' | 'eyeSlots'>): number[] {
  const count = Math.max(0, Math.min(12, Math.floor(q.eyes) || 0));
  const slots = [...new Set((q.eyeSlots ?? []).filter((i) => Number.isInteger(i) && i >= 0 && i < 12))].slice(0, count);
  for (let i = 0; slots.length < count && i < 12; i++) if (!slots.includes(i)) slots.push(i);
  return slots;
}

/** Old saves have no acquisition log: restore only the lower bound supported by items/unlocks. */
export function syncEndJourney(state: MiningState): MiningState {
  const old = state.endJourney;
  const rods = count(state.materials.blaze_rod);
  const eyeEquivalent = count(state.materials.ender_eye) + count(state.endQuest?.eyes);
  const legacyRods = rods + Math.ceil((count(state.materials.blaze_powder) + eyeEquivalent) / 2);
  const rodsAcquired = Math.min(4, Math.max(
    count(old?.rodsAcquired) + (old ? Math.max(0, rods - count(old.rodBalance)) : 0),
    old ? 0 : legacyRods,
    state.unlockedGachas.includes("warped_forest") ? 4 : 0,
  ));
  const debrisFound = !!old?.debrisFound || count(state.materials.ancient_debris) > 0
    || count(state.materials.netherite_scrap) > 0 || count(state.materials.netherite_ingot) > 0
    || state.unlockedGachas.includes("fortress")
    || Object.entries(state.crafted).some(([id, owned]) => owned && id.endsWith("_netherite"));
  if (old && old.rodsAcquired === rodsAcquired && old.rodBalance === rods && old.debrisFound === debrisFound) return state;
  return { ...state, endJourney: { rodsAcquired, rodBalance: rods, debrisFound } };
}

export function readEndJourney(raw: unknown): EndJourneyProgress | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.rodsAcquired !== "number" || !Number.isFinite(r.rodsAcquired)
    || typeof r.rodBalance !== "number" || !Number.isFinite(r.rodBalance)) return undefined;
  return { rodsAcquired: Math.min(4, count(r.rodsAcquired)), rodBalance: count(r.rodBalance), debrisFound: r.debrisFound === true };
}

/** Preserve completed old routes, but extend unfinished searches without losing their progress. */
export function migrateEndQuest(q: EndQuestState, unlocked: GachaId[], holding: boolean): EndQuestState {
  if ((q.routeVersion ?? 0) > END_ROUTE_VERSION) return q;
  const visited = [...new Set(q.visited)];
  const theEndUnlocked = q.theEndUnlocked || unlocked.includes("the_end");
  const linked = q.linked || theEndUnlocked || q.eyes >= 12;
  const eyes = linked ? 12 : q.eyes;
  const found = q.foundPortal || q.linked || q.theEndUnlocked || q.eyes > 0
    || unlocked.includes("end_portal") || unlocked.includes("the_end")
    || visited.length >= ((q.routeVersion ?? 0) < END_ROUTE_VERSION ? 3 : END_SEARCH_STOPS);
  const pool = (visited.length >= END_SEARCH_STOPS - 1 ? END_SEARCH_FINAL_PLACES : END_SEARCH_PLACES)
    .filter((id) => unlocked.includes(id) && !visited.includes(id));
  const valid = q.mark && pool.includes(q.mark);
  const mark = found ? null : valid ? q.mark : holding ? pool[0] ?? null : null;
  const eyeSlots = portalEyeSlots({ ...q, eyes });
  if (q.routeVersion === END_ROUTE_VERSION && q.visited.length === visited.length && q.mark === mark
    && q.foundPortal === found && q.fifth === null && q.fifthStreak === 0
    && q.theEndUnlocked === theEndUnlocked && q.linked === linked && q.eyes === eyes
    && JSON.stringify(q.eyeSlots) === JSON.stringify(eyeSlots)) return q;
  return { ...q, routeVersion: END_ROUTE_VERSION, visited, mark, fifth: null, fifthStreak: 0, foundPortal: found, theEndUnlocked, linked, eyes, eyeSlots };
}
