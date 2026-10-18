import { armorReductionRate, equippedCombatArmorTier } from "./playerCombat";
import { getMaterialCount, type CraftedGearId, type GearTier, type MiningState } from "./miningTypes";
import { COMBAT_ACTIONS, COMBAT_V2_RULES, type CombatAction, type CombatAffinity, type CombatIntent, type CombatV2Location } from "./combatV2Types";

const beats: Record<CombatAction, CombatAction> = { guard: "cut", cut: "charge", charge: "guard" };
const swordDamage: Record<GearTier, number> = { wood: 4, stone: 5, iron: 6, gold: 4, diamond: 7, netherite: 8 };
const swordTiers: GearTier[] = ["netherite", "diamond", "iron", "stone", "gold", "wood"];

export function combatAffinity(player: CombatAction, enemy: CombatAction): CombatAffinity {
  return player === enemy ? "even" : beats[player] === enemy ? "advantage" : "disadvantage";
}
export function winningCombatAction(enemy: CombatAction): CombatAction {
  return COMBAT_ACTIONS.find((action) => beats[action] === enemy)!;
}
export function v2Sword(state: MiningState): CraftedGearId | null {
  return swordTiers.map((tier) => `sword_${tier}` as CraftedGearId).find((id) => state.crafted[id]) ?? null;
}
export function v2HasWater(state: MiningState, location: CombatV2Location): boolean {
  return location === "warped_forest" && state.equipped.held === "water" && getMaterialCount(state, "water") > 0;
}
export function v2FullDamage(state: MiningState, location: CombatV2Location): number {
  const sword = v2Sword(state);
  const tier = sword?.slice(6) as GearTier | undefined;
  return (tier ? swordDamage[tier] : 0) + (v2HasWater(state, location) ? 3 : 0);
}
export function v2AttackDamage(state: MiningState, location: CombatV2Location, second: boolean, affinity: CombatAffinity): number {
  const full = v2FullDamage(state, location);
  const half = second ? Math.ceil(full / 2) : Math.floor(full / 2);
  return Math.max(1, Math.floor(half * ({ advantage: 1.5, even: 1, disadvantage: 0.5 }[affinity])));
}
/** HP units are half-hearts. Round once, after armor, water and affinity. */
export function v2IncomingHp(state: MiningState, location: CombatV2Location, affinity: CombatAffinity): number {
  const baseHp = location === "fortress" ? 4 : 25;
  const value = baseHp * (1 - armorReductionRate(state)) * (v2HasWater(state, location) ? 0.1 : 1)
    * ({ advantage: 0.5, even: 1, disadvantage: 1.5 }[affinity]);
  return affinity === "advantage" ? Math.floor(value + 1e-9) : Math.ceil(value - 1e-9);
}
export function v2MaxMobHp(location: CombatV2Location): number {
  return location === "fortress" ? 20 : 40;
}
export function v2Drop(location: CombatV2Location): "blaze_rod" | "ender_pearl" {
  return location === "fortress" ? "blaze_rod" : "ender_pearl";
}
/** A persisted PRNG makes rerenders, healing and reloads unable to reroll intent. */
export function combatRandom(seed: number): { seed: number; value: number } {
  const next = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return { seed: next, value: next / 4294967296 };
}
export function nextCombatIntent(seed: number, turn: number, lastUnknown: boolean, state?: MiningState): { intent: CombatIntent; seed: number } {
  const actualRoll = combatRandom(seed);
  const displayRoll = combatRandom(actualRoll.seed);
  const alternateRoll = combatRandom(displayRoll.seed);
  const actual = COMBAT_ACTIONS[Math.floor(actualRoll.value * 3)];
  // First three choices teach the cycle; helmets improve clarity, not the actual move.
  const helmet = state ? equippedCombatArmorTier(state, "helmet") : null;
  const clarity = helmet === "netherite" ? 0.2 : helmet === "diamond" ? 0.12 : helmet ? 0.06 : 0;
  const value = displayRoll.value;
  const unknown = turn >= 3 && !lastUnknown && value >= COMBAT_V2_RULES.certainty + COMBAT_V2_RULES.twoChoices;
  let candidates: CombatAction[] = [actual];
  if (unknown) candidates = [];
  else if (turn >= 3 && value >= COMBAT_V2_RULES.certainty + clarity) {
    const others = COMBAT_ACTIONS.filter((action) => action !== actual);
    const alternate = others[Math.floor(alternateRoll.value * 2)];
    // Stable display order doesn't leak which candidate is real.
    candidates = COMBAT_ACTIONS.filter((action) => action === actual || action === alternate);
  }
  return { intent: { actual, candidates, unknown }, seed: alternateRoll.seed };
}
