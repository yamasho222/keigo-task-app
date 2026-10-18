import { applyEndQuestOnVisit, insertPortalEye, unlockTheEnd } from "./endChapter";
import { tryCraft } from "./miningProgress";
import { MINING_RECIPES } from "./miningRecipes";
import { combatLabSeed } from "./combatV2LabStorage";
import { combatAffinity, combatRandom, v2Drop, v2IncomingHp, winningCombatAction } from "./combatV2Rules";
import { transitionCombatV2 } from "./combatV2Session";
import { COMBAT_ACTIONS, type CombatAction, type CombatV2Command, type CombatV2Location, type CombatV2Session } from "./combatV2Types";
import type { MiningState } from "./miningTypes";

export interface CombatSimulationConfig {
  seed: number;
  scenario: "iron" | "diamond" | "water";
  policy: "reader" | "random" | "guard-only";
  specialTaps: number;
  location?: CombatV2Location;
  route?: boolean;
  dailyTickets?: number;
}
export interface CombatSimulationResult {
  tickets: number; heals: number; hands: number; days: number; defeats: number; completed: boolean;
}
function chooseAction(s: CombatV2Session, policy: CombatSimulationConfig["policy"], random: number): CombatAction {
  if (policy === "guard-only") return "guard";
  if (policy === "random" || s.intent.unknown) return COMBAT_ACTIONS[Math.floor(random * 3)];
  if (s.intent.candidates.length === 1) return winningCombatAction(s.intent.candidates[0]);
  // Two candidates have one action that either wins or ties: use only displayed information.
  return COMBAT_ACTIONS.find((action) => s.intent.candidates.every((enemy) => combatAffinity(action, enemy) !== "disadvantage"))!;
}

/** Calls the real transition/recipes/quest functions, not a second combat implementation. */
export function simulateCombatV2(config: CombatSimulationConfig): CombatSimulationResult {
  let state: MiningState = combatLabSeed(config.scenario);
  state.materials = { ancient_debris: 1, water: 1 };
  if (config.route) {
    state = combatLabSeed("iron"); state.materials = { ancient_debris: 1, water: 1 };
  }
  state.tickets = config.dailyTickets ?? 10_000;
  let date = "2026-10-14", now = 1000, serial = 0, seed = config.seed;
  const result: CombatSimulationResult = { tickets: 0, heals: 0, hands: 0, days: 1, defeats: 0, completed: false };
  const send = (kind: CombatV2Command["kind"], location: CombatV2Location, action: CombatAction = "cut") => {
    const session = state.combatV2?.sessions[location];
    const base = { location, id: `sim-${config.seed}-${++serial}`, sessionId: session?.id, expectedRevision: session?.revision ?? 0, dateKey: date, now: now += 200 };
    const command = (kind === "act" ? { ...base, kind, action } : { ...base, kind }) as CombatV2Command;
    const before = state;
    const next = transitionCombatV2(state, command);
    if (next.error) throw new Error(next.error);
    state = next.state;
    result.tickets += before.tickets - state.tickets;
    if (kind === "heal") result.heals++;
    if (kind === "act" || kind === "beginSpecial") result.hands++;
  };
  const nextDay = () => {
    result.days++;
    const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); date = d.toISOString().slice(0, 10);
    if (config.dailyTickets !== undefined) state = { ...state, tickets: state.tickets + config.dailyTickets };
    for (const location of ["fortress", "warped_forest"] as const) if (state.combatV2?.sessions[location]) send("sync", location);
  };
  for (let iteration = 0; iteration < 3000 && result.days <= 365; iteration++) {
    const location: CombatV2Location = config.route ? ((state.materials.blaze_rod ?? 0) < 6 ? "fortress" : "warped_forest") : config.location ?? "fortress";
    if (config.route && location === "warped_forest") {
      const diamond = combatLabSeed("diamond");
      state = { ...state, crafted: { ...state.crafted, ...diamond.crafted }, equipped: { ...diamond.equipped, held: config.scenario === "water" ? "water" : null } };
    }
    if (!state.combatV2?.sessions[location]) send("enter", location);
    const s = state.combatV2!.sessions[location]!;
    if (s.status === "cleared") {
      const enough = config.route ? (state.materials.ender_pearl ?? 0) >= 12 : (state.materials[v2Drop(location)] ?? 0) >= 2;
      if (enough) {
        result.completed = true;
        break;
      }
      send("next", location); continue;
    }
    if (s.status === "defeated") {
      result.defeats++;
      if (config.dailyTickets === undefined) break;
      nextDay(); continue;
    }
    if (state.tickets === 0 && s.remainingActions === 0) {
      if (config.dailyTickets === undefined) break;
      nextDay(); continue;
    }
    const random = combatRandom(seed); seed = random.seed;
    const action = chooseAction(s, config.policy, random.value);
    const candidates = s.intent.unknown ? COMBAT_ACTIONS : s.intent.candidates;
    const worstCounter = Math.max(...candidates.map((enemy) => v2IncomingHp(state, location, combatAffinity(action, enemy))));
    if (s.hp <= worstCounter && s.hp < 20 && state.tickets > 0 && s.gauge < 5) { send("heal", location); continue; }
    if (s.gauge >= 5) {
      send("beginSpecial", location);
      for (let tap = 0; tap < Math.min(10, config.specialTaps); tap++) send("tap", location);
      now = state.combatV2!.sessions[location]!.pendingSpecial!.deadline;
      send("sync", location);
    } else send("act", location, action);
  }
  if (config.route && result.completed) {
    // No recipe shortcuts: consume the six rods and twelve pearls through real crafting.
    let crafted = tryCraft(state, MINING_RECIPES.find((recipe) => recipe.id === "blaze_powder_batch")!, { times: 6 });
    if (crafted.error) throw new Error(crafted.error); state = crafted.state;
    crafted = tryCraft(state, MINING_RECIPES.find((recipe) => recipe.id === "ender_eye_craft")!, { times: 12 });
    if (crafted.error) throw new Error(crafted.error); state = crafted.state;
    state = { ...state, equipped: { ...state.equipped, held: "ender_eye" } };
    let visits = 0;
    while (!state.endQuest?.foundPortal && visits < 20) {
      if (state.tickets === 0) nextDay();
      state = { ...state, tickets: state.tickets - 1 };
      result.tickets++;
      const destination = state.endQuest?.mark ?? "wood";
      const roll = combatRandom(seed); seed = roll.seed;
      state = applyEndQuestOnVisit(state, destination, () => roll.value).state;
      visits++;
    }
    for (let eye = 0; eye < 12; eye++) state = insertPortalEye(state).state;
    const unlocked = unlockTheEnd(state);
    result.completed = !unlocked.error && !!unlocked.state.endQuest?.theEndUnlocked;
  }
  return result;
}

export function summarizeCombatSimulations(results: CombatSimulationResult[]) {
  const completed = results.filter((r) => r.completed);
  const values = (key: keyof Pick<CombatSimulationResult, "tickets" | "days">) => completed.map((r) => r[key]).sort((a, b) => a - b);
  const percentile = (a: number[], p: number) => a[Math.max(0, Math.ceil(a.length * p) - 1)] ?? null;
  return {
    samples: results.length, completed: completed.length,
    meanTickets: completed.length ? +(completed.reduce((sum, r) => sum + r.tickets, 0) / completed.length).toFixed(2) : null,
    medianTickets: percentile(values("tickets"), 0.5), p90Tickets: percentile(values("tickets"), 0.9), p95Tickets: percentile(values("tickets"), 0.95),
    medianDays: percentile(values("days"), 0.5), p90Days: percentile(values("days"), 0.9),
    meanHeals: +(results.reduce((sum, r) => sum + r.heals, 0) / results.length).toFixed(2),
    defeatRate: +(results.filter((r) => r.defeats > 0).length / results.length).toFixed(4),
  };
}
