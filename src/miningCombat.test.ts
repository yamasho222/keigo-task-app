import { describe, expect, it } from "vitest";
import {
  combatSwings,
  heartSlots,
  resolveCombat,
  swordSwingDamage,
} from "./miningCombat";
import { emptyMiningState } from "./miningTypes";

function readyState() {
  return {
    ...emptyMiningState(),
    tickets: 4,
    crafted: { sword_diamond: true },
    equipped: { ...emptyMiningState().equipped, tool: "sword_diamond" as const },
  };
}

describe("combat math", () => {
  it("maps 3-pick to swings", () => {
    expect(combatSwings("normal")).toEqual({ swings: 1, both: false });
    expect(combatSwings("hit")).toEqual({ swings: 1, both: true });
    expect(combatSwings("jackpot")).toEqual({ swings: 3, both: true });
  });

  it("diamond sword is 7, water adds 2 vs endermen", () => {
    const state = readyState();
    expect(swordSwingDamage(state, "warped_forest")).toBe(7);
    expect(swordSwingDamage(state, "fortress")).toBe(7);
    const withWater = {
      ...state,
      equipped: { ...state.equipped, held: "water" as const },
    };
    expect(swordSwingDamage(withWater, "warped_forest")).toBe(9);
    expect(swordSwingDamage(withWater, "fortress")).toBe(7);
  });

  it("draws 20 hearts for 40 hp", () => {
    const slots = heartSlots(40, 20);
    expect(slots.filter((s) => s === "full")).toHaveLength(20);
    expect(heartSlots(39, 20).filter((s) => s === "half")).toHaveLength(1);
  });
});

describe("resolveCombat", () => {
  it("does not refill a lone survivor", () => {
    const before = {
      ...readyState(),
      combatEncounters: {
        warped_forest: { mobs: [{ hp: 10 }] },
      },
    };
    const result = resolveCombat({ state: before, gacha: "warped_forest", tier: "normal" });
    if ("error" in result) throw new Error(result.error);
    expect(result.state.combatEncounters?.warped_forest?.mobs).toHaveLength(1);
  });

  it("jackpot can kill both blazes from full", () => {
    const result = resolveCombat({ state: readyState(), gacha: "fortress", tier: "jackpot" });
    if ("error" in result) throw new Error(result.error);
    expect(result.killed).toHaveLength(2);
    expect(result.drops.some((d) => d.material === "blaze_rod" && d.amount === 2)).toBe(true);
    expect(result.drops.some((d) => d.material === "netherrack" && d.amount === 3)).toBe(true);
  });

  it("needs a sword", () => {
    const result = resolveCombat({
      state: { ...emptyMiningState(), tickets: 1 },
      gacha: "warped_forest",
      tier: "hit",
    });
    expect("error" in result).toBe(true);
  });
});
