import { emptyMiningState, normalizeMiningState, type CraftedGearId, type GearTier, type MiningState } from "./miningTypes";
import { readCombatV2 } from "./combatV2Migration";
import { refreshUnlocks } from "./miningProgress";

export const COMBAT_V2_LAB_KEY = "keigo-combat-v2-lab-v1";
export const COMBAT_V2_BACKUP_KEY = `${COMBAT_V2_LAB_KEY}:previous`;
export interface CombatLabSave { schemaVersion: 2; revision: number; dayOffset: number; mining: MiningState }
export type CombatLabScenario = "iron" | "diamond" | "water" | "last-ticket" | "quest";
export function combatLabDate(offset = 0, now = new Date()): string {
  const d = new Date(now); d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function combatLabSeed(scenario: CombatLabScenario): MiningState {
  const state = emptyMiningState();
  const crafted = { ...state.crafted };
  const toolTiers: GearTier[] = scenario === "iron" || scenario === "last-ticket" ? ["wood", "stone", "iron"] : ["wood", "stone", "iron", "diamond"];
  for (const tier of toolTiers) for (const tool of ["sword", "axe", "pickaxe"]) crafted[`${tool}_${tier}` as CraftedGearId] = true;
  const tier = toolTiers.at(-1)!;
  const equipped = { ...state.equipped, tool: `sword_${tier}` as CraftedGearId };
  for (const slot of ["helmet", "chest", "leggings", "boots"] as const) {
    const gear = `${slot}_${tier}` as CraftedGearId; crafted[gear] = true; equipped[slot] = gear;
  }
  Object.assign(crafted, { bucket_iron: true, workbench: true, furnace: true });
  if (scenario === "water") equipped.held = "water";
  return refreshUnlocks({
    ...state, tickets: scenario === "last-ticket" ? 1 : 8, crafted, equipped,
    miningVersionNoticeSeen: true, miningRouteBranchSeen: true,
    lastSelectedGacha: scenario === "iron" || scenario === "last-ticket" ? "fortress" : "warped_forest",
    materials: { ancient_debris: 1, water: 1, iron_ingot: 12, log: 8, coal: 8,
      ...(scenario === "diamond" || scenario === "water" ? { blaze_rod: 4 } : {}),
      ...(scenario === "quest" ? { blaze_rod: 6, ender_pearl: 12 } : {}),
    },
  });
}
export function readCombatLabSave(raw: string | null): CombatLabSave {
  if (!raw) return { schemaVersion: 2, revision: 0, dayOffset: 0, mining: combatLabSeed("iron") };
  const value = JSON.parse(raw) as CombatLabSave;
  if (value.schemaVersion !== 2 || !Number.isSafeInteger(value.revision) || value.revision < 0
    || !Number.isSafeInteger(value.dayOffset) || value.dayOffset < 0 || value.dayOffset > 36600 || !value.mining) throw new Error("テスト記録の形式が異なります。上書きせずに停止しました。");
  readCombatV2(value.mining.combatV2);
  return { ...value, mining: normalizeMiningState(value.mining) };
}
