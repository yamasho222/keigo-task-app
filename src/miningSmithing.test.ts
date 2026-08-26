import { describe, expect, it } from "vitest";
import {
  BASTION_TEMPLATE_RATE,
  EXCHANGE_TEMPLATE_COST,
  NETHERRACK_TO_POINTS,
  exchangeNetherrackForPoints,
  exchangePointsForMaterial,
  refreshUnlocks,
  resolveDig,
  tryCraft,
} from "./miningProgress";
import { MINING_RECIPES } from "./miningRecipes";
import { emptyMiningState, getMaterialCount, type MiningState } from "./miningTypes";

function recipe(id: string) {
  const found = MINING_RECIPES.find((item) => item.id === id);
  if (!found) throw new Error(`recipe not found: ${id}`);
  return found;
}

function bastionReady(extra?: Partial<MiningState>): MiningState {
  return {
    ...emptyMiningState(),
    tickets: 5,
    unlockedGachas: ["wood", "nether", "bastion"],
    crafted: { workbench: true, smithing_table: true, sword_diamond: true },
    ...extra,
  };
}

describe("bastion chest loot", () => {
  it("drops netherrack and never gold or debris", () => {
    const result = resolveDig({
      state: bastionReady(),
      gacha: "bastion",
      toolKind: "pickaxe",
      dateKey: "2026-08-26",
      rand: () => 0.99,
    });
    if ("error" in result) throw new Error(result.error);
    expect(result.drops.some((d) => d.material === "netherrack")).toBe(true);
    expect(result.drops.some((d) => d.material === "gold_ingot")).toBe(false);
    expect(result.drops.some((d) => d.material === "ancient_debris")).toBe(false);
    expect(result.drops.some((d) => d.material === "netherite_upgrade")).toBe(false);
  });

  it("can drop the smithing template", () => {
    expect(BASTION_TEMPLATE_RATE).toBe(0.1);
    const result = resolveDig({
      state: bastionReady(),
      gacha: "bastion",
      toolKind: "pickaxe",
      dateKey: "2026-08-26",
      rand: () => 0,
    });
    if ("error" in result) throw new Error(result.error);
    expect(result.drops.some((d) => d.material === "netherite_upgrade")).toBe(true);
  });
});

describe("netherrack exchange", () => {
  it("sells one netherrack for 1 emerald", () => {
    const before = {
      ...emptyMiningState(),
      materials: { netherrack: 2 },
      miningPoints: 4,
    };
    const result = exchangeNetherrackForPoints(before);
    expect(result.error).toBeUndefined();
    expect(result.state.miningPoints).toBe(4 + NETHERRACK_TO_POINTS);
    expect(getMaterialCount(result.state, "netherrack")).toBe(1);
    expect(NETHERRACK_TO_POINTS).toBe(1);
  });
});

describe("smithing recipes", () => {
  it("unlocks bastion with diamond tools", () => {
    const next = refreshUnlocks({
      ...emptyMiningState(),
      crafted: { sword_diamond: true, axe_diamond: true, pickaxe_diamond: true },
    });
    expect(next.unlockedGachas).toContain("nether");
    expect(next.unlockedGachas).toContain("bastion");
  });

  it("blocks netherite upgrade without a smithing table", () => {
    const before = bastionReady({
      crafted: { workbench: true, sword_diamond: true },
      materials: { netherite_ingot: 1, netherite_upgrade: 1 },
    });
    const result = tryCraft(before, recipe("sword_netherite"));
    expect(result.error).toBe("先に鍛冶台を作ってね");
  });

  it("duplicates a template with 3 diamonds", () => {
    const before = bastionReady({
      materials: { netherite_upgrade: 1, diamond: 3, netherrack: 1 },
    });
    const result = tryCraft(before, recipe("netherite_upgrade_dupe"));
    expect(result.error).toBeUndefined();
    expect(getMaterialCount(result.state, "netherite_upgrade")).toBe(2);
    expect(getMaterialCount(result.state, "diamond")).toBe(0);
    expect(getMaterialCount(result.state, "netherrack")).toBe(0);
  });
});

describe("template emerald buy", () => {
  it("costs 120 emeralds for one template", () => {
    expect(EXCHANGE_TEMPLATE_COST).toBe(120);
    const before = {
      ...emptyMiningState(),
      miningPoints: 120,
    };
    const result = exchangePointsForMaterial(before, "netherite_upgrade");
    expect(result.error).toBeUndefined();
    expect(result.state.miningPoints).toBe(0);
    expect(getMaterialCount(result.state, "netherite_upgrade")).toBe(1);
  });

  it("errors when emeralds are short", () => {
    const before = {
      ...emptyMiningState(),
      miningPoints: 119,
    };
    const result = exchangePointsForMaterial(before, "netherite_upgrade");
    expect(result.error).toBe("エメラルドが120ひつようだよ");
    expect(getMaterialCount(result.state, "netherite_upgrade")).toBe(0);
  });
});
