import { describe, expect, it } from "vitest";
import {
  applyCombatSpecialFinish,
  combatSwings,
  heartSlots,
  resolveCombat,
  settleCombatEncounter,
  swordSwingDamage,
  visibleCombatEncounter,
} from "./miningCombat";
import { beginSpecialAttack } from "./playerCombat";
import { emptyMiningState } from "./miningTypes";
import {
  buildEndDragonTestSeed,
  buildEndEyeCraftSeed,
  buildEndChapterHuntSeed,
  buildEndPortalFillSeed,
  buildEndTheEndUnlockSeed,
  buildWarpedForestTestSeed,
} from "./devSandboxSeed";

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
    expect(combatSwings("hit")).toEqual({ swings: 2, both: true });
    expect(combatSwings("jackpot")).toEqual({ swings: 4, both: true });
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
    expect(result.state.combatEncounters?.fortress?.mobs).toEqual([{ hp: 0 }, { hp: 0 }]);
    expect(result.countered).toBe(false);
    expect(result.takenHearts).toBe(0);
    expect(result.drops.some((d) => d.material === "blaze_rod" && d.amount === 2)).toBe(true);
    expect(result.drops.some((d) => d.material === "netherrack" && d.amount === 3)).toBe(true);
  });

  it("keeps a dead body in its slot instead of collapsing", () => {
    const before = {
      ...readyState(),
      combatEncounters: {
        fortress: { wave: 0, mobs: [{ hp: 5 }, { hp: 20 }] },
      },
    };
    const result = resolveCombat({ state: before, gacha: "fortress", tier: "normal" });
    if ("error" in result) throw new Error(result.error);
    expect(result.killed).toEqual([0]);
    expect(result.state.combatEncounters?.fortress?.mobs).toEqual([{ hp: 0 }, { hp: 20 }]);
    expect(result.countered).toBe(true);
    expect(result.takenHearts).toBe(2);
  });

  it("settle spawns the next wave only after a wipe", () => {
    const wiped = {
      ...readyState(),
      combatEncounters: { fortress: { wave: 0, mobs: [{ hp: 0 }, { hp: 0 }] } },
    };
    const next = settleCombatEncounter(wiped, "fortress");
    expect(next.combatEncounters?.fortress?.wave).toBe(1);
    expect(next.combatEncounters?.fortress?.mobs).toEqual([{ hp: 20 }, { hp: 20 }]);

    const survivor = {
      ...readyState(),
      combatEncounters: { fortress: { wave: 0, mobs: [{ hp: 0 }, { hp: 12 }] } },
    };
    expect(settleCombatEncounter(survivor, "fortress")).toBe(survivor);
  });

  it("visible encounter keeps corpses", () => {
    const state = {
      ...readyState(),
      combatEncounters: { warped_forest: { wave: 0, mobs: [{ hp: 0 }, { hp: 10 }] } },
    };
    expect(visibleCombatEncounter(state, "warped_forest").mobs).toEqual([{ hp: 0 }, { hp: 10 }]);
  });

  it("needs a sword", () => {
    const result = resolveCombat({
      state: { ...emptyMiningState(), tickets: 1 },
      gacha: "warped_forest",
      tier: "hit",
    });
    expect("error" in result).toBe(true);
  });

  it("blocks a swing while downed", () => {
    const result = resolveCombat({
      state: { ...readyState(), playerHp: 0 },
      gacha: "fortress",
      tier: "normal",
    });
    expect("error" in result).toBe(true);
  });
});

describe("end chapter test seeds", () => {
  const input = {
    mining: emptyMiningState(),
    duplicateTokens: 0,
    stickerAlbum: [] as string[],
    buddyProgress: {},
    buddyId: null,
  };

  it("craft seed has pearls/rods and no eyes", () => {
    const seed = buildEndEyeCraftSeed(input);
    expect(seed.mining.materials.ender_eye).toBe(0);
    expect(seed.mining.materials.ender_pearl ?? 0).toBeGreaterThanOrEqual(8);
    expect(seed.mining.materials.blaze_rod ?? 0).toBeGreaterThanOrEqual(8);
    expect(seed.mining.crafted.workbench).toBe(true);
    expect(seed.mining.unlockedGachas).toContain("fortress");
  });

  it("hunt seed has eyes and no portal yet", () => {
    const seed = buildEndChapterHuntSeed(input);
    expect(seed.mining.materials.ender_eye ?? 0).toBeGreaterThanOrEqual(1);
    expect(seed.mining.endQuest?.foundPortal).toBe(false);
    expect(seed.mining.lastSelectedGacha).toBe("wood");
  });

  it("fill seed unlocks end_portal with unfilled eyes", () => {
    const seed = buildEndPortalFillSeed(input);
    expect(seed.mining.endQuest?.foundPortal).toBe(true);
    expect(seed.mining.endQuest?.eyes).toBe(0);
    expect(seed.mining.unlockedGachas).toContain("end_portal");
    expect(seed.mining.lastSelectedGacha).toBe("end_portal");
  });

  it("unlock seed is 12/12 but The End is still closed", () => {
    const seed = buildEndTheEndUnlockSeed(input);
    expect(seed.mining.endQuest?.eyes).toBe(12);
    expect(seed.mining.endQuest?.linked).toBe(true);
    expect(seed.mining.endQuest?.theEndUnlocked).toBe(false);
    expect(seed.mining.unlockedGachas).toContain("end_portal");
    expect(seed.mining.unlockedGachas).not.toContain("the_end");
  });

  it("dragon seed opens The End", () => {
    const seed = buildEndDragonTestSeed(input);
    expect(seed.mining.endQuest?.theEndUnlocked).toBe(true);
    expect(seed.mining.unlockedGachas).toContain("the_end");
    expect(seed.mining.lastSelectedGacha).toBe("the_end");
    expect(seed.mining.dragonFight?.hp).toBe(2000);
  });
});

describe("warped forest test seed", () => {
  it("unlocks the forest and equips a sword", () => {
    const seed = buildWarpedForestTestSeed({
      mining: emptyMiningState(),
      duplicateTokens: 0,
      stickerAlbum: [],
      buddyProgress: {},
      buddyId: null,
    });
    expect(seed.mining.unlockedGachas).toContain("warped_forest");
    expect(seed.mining.unlockedGachas).toContain("fortress");
    expect(seed.mining.lastSelectedGacha).toBe("warped_forest");
    expect(seed.mining.equipped.tool).toBe("sword_netherite");
    expect(seed.mining.equipped.held).toBe("water");
    expect(seed.mining.tickets).toBeGreaterThan(0);
  });
});

describe("special gauge", () => {
  it("charges one pip per swing and caps at 5", () => {
    let state = { ...readyState(), tickets: 8 };
    for (let i = 0; i < 6; i++) {
      const r = resolveCombat({ state, gacha: "fortress", tier: "jackpot" });
      if ("error" in r) throw new Error(r.error);
      state = r.state;
    }
    expect(state.specialGauge).toBe(5);
  });

  it("special finish is tap count times 2, no normal swing", () => {
    const charged = { ...readyState(), specialGauge: 5, tickets: 4 };
    const begun = beginSpecialAttack(charged);
    expect(begun.error).toBeUndefined();
    expect(begun.state.specialGauge).toBe(0);
    expect(begun.state.tickets).toBe(3);
    const before = begun.state.combatEncounters?.fortress?.mobs ?? [{ hp: 20 }, { hp: 20 }];
    const fin = applyCombatSpecialFinish({
      state: begun.state,
      gacha: "fortress",
      taps: 3,
    });
    if ("error" in fin) throw new Error(fin.error);
    expect(fin.swingDamage).toBe(6);
    expect(fin.state.combatEncounters?.fortress?.mobs.some((m, i) => m.hp < (before[i]?.hp ?? 20))).toBe(true);
  });
});
