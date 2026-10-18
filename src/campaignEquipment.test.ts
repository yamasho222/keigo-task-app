import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CampaignPreparation, type CampaignPreparationProps } from "./CampaignPreparation";
import {
  ARMOR_SLOTS, CAMPAIGN_MATERIALS, CAMPAIGN_RECIPES, TOOL_BONUS,
  armorRate, attackDamage, campaignGearImage, craftCampaign,
  defaultEquipment, defaultSupplies, fullArmor, harvestCampaign,
  incomingDamage, maxHp, upgradeCampaign,
  type ArmorTier, type CampaignEquipment, type CampaignSupplies,
} from "./campaignEquipment";

function richSupplies(): CampaignSupplies {
  const supplies = defaultSupplies();
  supplies.materials = Object.fromEntries(Object.keys(CAMPAIGN_MATERIALS).map(id => [id, 100]));
  return supplies;
}

function naked(): CampaignEquipment {
  return { ...defaultEquipment(), armor: fullArmor("none"), buddies: [] };
}

function freezeSupplies(supplies: CampaignSupplies): CampaignSupplies {
  Object.freeze(supplies.materials);
  Object.freeze(supplies.owned);
  return Object.freeze(supplies);
}

describe("isolated campaign fixtures", () => {
  it("includes default equipment ownership and finite limited supplies", () => {
    const eq = defaultEquipment();
    const supplies = defaultSupplies();
    expect(eq.sword).toBe("diamond");
    expect(eq.armor).toEqual({ helmet: "iron", chest: "diamond", leggings: "iron", boots: "iron" });
    expect(eq.shield).toBe(true);
    expect(supplies.owned[`sword_${eq.sword}`]).toBe(true);
    for (const slot of ARMOR_SLOTS) expect(supplies.owned[`armor_${slot}_${eq.armor[slot]}`]).toBe(true);
    expect(supplies.owned.shield).toBe(true);
    expect(supplies.hasTable).toBe(true);
    expect(supplies.owned.enchanting_table).toBe(true);
    expect(supplies.materials).toMatchObject({ plank: 18, wool: 9, wheat: 6, lapis_lazuli: 12, book: 2, quartz: 0, bread: 0, spare_bed: 0 });
    expect(eq.buddies.map(buddy => buddy.level)).toEqual([10, 10, 10]);
    expect(supplies.partySlots).toBe(3);
    expect(Object.values(supplies.materials).every(Number.isSafeInteger)).toBe(true);
  });

  it("creates independent fixture objects", () => {
    const eq = defaultEquipment();
    const supplies = defaultSupplies();
    eq.armor.chest = "none";
    eq.buddies[0].level = 1;
    supplies.materials.plank = 0;
    supplies.owned.shield = false;
    expect(defaultEquipment().armor.chest).toBe("diamond");
    expect(defaultEquipment().buddies[0].level).toBe(10);
    expect(defaultSupplies().materials.plank).toBe(18);
    expect(defaultSupplies().owned.shield).toBe(true);
  });

  it("references only existing local images and imports no legacy state", () => {
    const images = [
      ...defaultEquipment().buddies.map(buddy => buddy.image),
      ...Object.values(CAMPAIGN_MATERIALS).map(material => material.image),
      ...CAMPAIGN_RECIPES.map(recipe => recipe.image),
      ...ARMOR_SLOTS.map(slot => campaignGearImage(`armor_${slot}_${defaultEquipment().armor[slot]}`)),
    ].filter((image): image is string => !!image);
    for (const image of images) expect(existsSync(fileURLToPath(new URL(`../public${image}`, import.meta.url))), image).toBe(true);
    const source = readFileSync(new URL("./campaignEquipment.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/^import\s/m);
    expect(source).not.toMatch(/localStorage|sessionStorage|firebase|fetch\(/);
  });
});

describe("campaign damage", () => {
  it.each<[ArmorTier, number]>([["none", 0], ["gold", .20], ["iron", .25], ["diamond", .40], ["netherite", .55]])("full %s armor removes %s", (tier, rate) => {
    expect(armorRate({ ...naked(), armor: fullArmor(tier) })).toBe(rate);
  });

  it("weights mixed armor per slot and computes maximum HP only for health", () => {
    expect(armorRate(defaultEquipment())).toBe(.30);
    for (const [slot, expected] of [["helmet", 5 / 24 * .4], ["chest", 8 / 24 * .4], ["leggings", 7 / 24 * .4], ["boots", 4 / 24 * .4]] as const) {
      expect(armorRate({ ...naked(), armor: { ...fullArmor("none"), [slot]: "diamond" } })).toBeCloseTo(expected);
    }
    const eq = defaultEquipment();
    for (const rank of [0, 1, 2, 3] as const) {
      eq.defense = { kind: "health", rank };
      expect(maxHp(eq)).toBe(20 + rank * 2);
    }
    eq.defense = { kind: "fire", rank: 3 };
    expect(maxHp(eq)).toBe(20);
  });

  it("uses sword bases and only gives companions on specials", () => {
    const eq = defaultEquipment();
    expect(attackDamage(eq, false, false, false)).toEqual({ weapon: 4, companions: 0, total: 4 });
    expect(attackDamage(eq, true, false, false)).toEqual({ weapon: 8, companions: 9, total: 17 });
    eq.sword = "netherite";
    expect(attackDamage(eq, false, false, false).weapon).toBe(6);
    expect(attackDamage(eq, true, false, false)).toEqual({ weapon: 12, companions: 9, total: 21 });
    expect(attackDamage(eq, true, false, true)).toEqual({ weapon: 24, companions: 9, total: 33 });
  });

  it.each([0, 1, 2, 3] as const)("applies each attack enchant at rank %s to its specified attack", rank => {
    const eq = naked();
    eq.attack = { kind: "power", rank };
    expect(attackDamage(eq, false, false, false).weapon).toBe(4 + rank);
    expect(attackDamage(eq, true, false, false).weapon).toBe(8);
    eq.attack = { kind: "ultimate", rank };
    expect(attackDamage(eq, false, false, false).weapon).toBe(4);
    expect(attackDamage(eq, true, false, false).weapon).toBe(8 + 4 * rank);
    eq.attack = { kind: "break", rank };
    expect(attackDamage(eq, false, false, false).weapon).toBe(4);
    expect(attackDamage(eq, true, false, false).weapon).toBe(8);
    expect(attackDamage(eq, false, true, false).weapon).toBe(4 + rank);
    expect(attackDamage(eq, true, true, false).weapon).toBe(8 + 2 * rank);
    expect(attackDamage(eq, true, true, true).weapon).toBe((8 + 2 * rank) * 2);
  });

  it.each([
    { kind: "none", part: false, landing: false, expected: 29 },
    { kind: "power", part: false, landing: false, expected: 38 },
    { kind: "ultimate", part: false, landing: false, expected: 41 },
    { kind: "break", part: true, landing: false, expected: 44 },
    { kind: "ultimate", part: false, landing: true, expected: 61 },
  ] as const)("three normal attacks plus a special: $kind, landing=$landing totals $expected", ({ kind, part, landing, expected }) => {
    const eq = defaultEquipment();
    eq.attack = { kind, rank: kind === "none" ? 0 : 3 };
    const normal = attackDamage(eq, false, part, false);
    const special = attackDamage(eq, true, part, landing);
    expect(normal.companions).toBe(0);
    expect(special.companions).toBe(9);
    expect(normal.total * 3 + special.total).toBe(expected);
    if (landing) expect(special).toEqual({ weapon: 40, companions: 9, total: 49 });
  });

  it("clamps companion levels and never counts more than three friends", () => {
    const eq = defaultEquipment();
    eq.buddies = [0, 5, 100, 10].map((level, i) => ({ id: String(i), image: "", level }));
    expect(attackDamage(eq, true, false, false).companions).toBe(6);
    eq.buddies = [NaN, Infinity, -Infinity].map((level, i) => ({ id: String(i), image: "", level }));
    expect(attackDamage(eq, true, false, false).companions).toBe(3);
  });

  it("rounds once after armor, enchant and guard", () => {
    const eq = { ...naked(), armor: fullArmor("diamond"), defense: { kind: "protection" as const, rank: 3 as const }, shield: true };
    // 31 × .60 × .80 × .20 = 2.976; rounding between stages would give 4.
    expect(incomingDamage(eq, 10, "physical", true)).toBe(1);
    expect(incomingDamage(eq, 20, "physical", true)).toBe(2);
    expect(incomingDamage(eq, 21, "physical", true)).toBe(3);
    expect(incomingDamage(eq, 31, "physical", true)).toBe(3);
    expect(incomingDamage(eq, 25, "physical", false)).toBe(12);
    expect(incomingDamage(eq, 26, "physical", false)).toBe(13);
    eq.shield = false;
    expect(incomingDamage(eq, 25, "physical", true)).toBe(6);
  });

  it("uses integer fractions at decimal boundaries", () => {
    const eq = { ...naked(), armor: fullArmor("diamond"), defense: { kind: "protection" as const, rank: 1 as const }, shield: false };
    // Exact rational boundaries must stay integral after all reductions.
    expect(incomingDamage(eq, 200, "physical", true)).toBe(57);
    eq.armor = fullArmor("netherite");
    expect(incomingDamage(eq, 400, "physical", true)).toBe(86);
    expect(incomingDamage(naked(), Number.MAX_SAFE_INTEGER, "physical", false)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it.each([[1, 80], [2, 65], [3, 50]] as const)("fire rank %s only reduces fire to %s/100", (rank, damage) => {
    const eq = naked();
    eq.defense = { kind: "fire", rank };
    expect(incomingDamage(eq, 100, "fire", false)).toBe(damage);
    expect(incomingDamage(eq, 100, "physical", false)).toBe(100);
  });

  it.each([[1, 95], [2, 90], [3, 80]] as const)("protection rank %s reduces either damage kind", (rank, damage) => {
    const eq = naked();
    eq.defense = { kind: "protection", rank };
    expect(incomingDamage(eq, 100, "fire", false)).toBe(damage);
    expect(incomingDamage(eq, 100, "physical", false)).toBe(damage);
  });

  it("returns at least one for positive hits, zero for absent or invalid hits", () => {
    const eq = { ...naked(), armor: fullArmor("netherite"), defense: { kind: "fire" as const, rank: 3 as const } };
    expect(incomingDamage(eq, 1, "fire", true)).toBe(1);
    for (const raw of [0, -1, NaN, Infinity, -Infinity, .5, Number.MAX_SAFE_INTEGER + 1]) expect(incomingDamage(eq, raw, "fire", true)).toBe(0);
  });
});

describe("campaign crafting", () => {
  it("crafts bread and battle beds from zero without mutating input", () => {
    const supplies = freezeSupplies(defaultSupplies());
    const bread = craftCampaign(supplies, "bread");
    expect(bread.error).toBeUndefined();
    expect(bread.supplies.materials).toMatchObject({ bread: 1, wheat: 3 });
    const bed = craftCampaign(supplies, "battle_bed");
    expect(bed.supplies.materials).toMatchObject({ plank: 15, wool: 6, spare_bed: 1 });
    expect(bed.supplies.partySlots).toBe(3);
    expect(supplies.materials.bread).toBe(0);
    expect(supplies.materials.spare_bed).toBe(0);
    expect(bread.supplies.owned).not.toBe(supplies.owned);
  });

  it("keeps party and battle bed effects separate and caps party slots", () => {
    const supplies = defaultSupplies();
    supplies.partySlots = 2;
    const party = craftCampaign(supplies, "party_bed");
    expect(party.supplies.partySlots).toBe(3);
    expect(party.supplies.materials.spare_bed).toBe(0);
    const capped = craftCampaign(party.supplies, "party_bed");
    expect(capped.error).toBeTruthy();
    expect(capped.supplies).toBe(party.supplies);
    expect(craftCampaign(party.supplies, "battle_bed").supplies.materials.spare_bed).toBe(1);
  });

  it("makes paper then books with exact costs", () => {
    const supplies = defaultSupplies();
    supplies.materials.sugar_cane = 3;
    supplies.materials.leather = 1;
    const paper = craftCampaign(supplies, "paper");
    expect(paper.supplies.materials).toMatchObject({ sugar_cane: 0, paper: 3 });
    const book = craftCampaign(paper.supplies, "book");
    expect(book.supplies.materials).toMatchObject({ paper: 0, leather: 0, book: 3 });
  });

  it("crafts shield and table flags with the specified costs", () => {
    const supplies = defaultSupplies();
    supplies.owned = {};
    supplies.hasTable = false;
    supplies.materials = { plank: 6, iron_ingot: 1, obsidian: 4, diamond: 2, book: 1 };
    const shield = craftCampaign(supplies, "shield");
    expect(shield.supplies.owned.shield).toBe(true);
    expect(shield.supplies.materials.plank).toBe(0);
    expect(shield.supplies.materials.iron_ingot).toBe(0);
    for (const id of ["enchanting_table", "table"]) {
      const table = craftCampaign(supplies, id);
      expect(table.error).toBeUndefined();
      expect(table.supplies.hasTable).toBe(true);
      expect(table.supplies.owned.enchanting_table).toBe(true);
      expect(table.supplies.materials).toMatchObject({ obsidian: 0, diamond: 0, book: 0 });
    }
  });

  it("crafts every supported gear into canonical owned keys, with diamond prerequisites", () => {
    for (const recipe of CAMPAIGN_RECIPES.filter(recipe => recipe.owned && recipe.id !== "enchanting_table")) {
      const supplies = richSupplies();
      supplies.owned = recipe.requiresOwned ? { [recipe.requiresOwned]: true } : {};
      const crafted = craftCampaign(supplies, recipe.id);
      expect(crafted.error, recipe.id).toBeUndefined();
      expect(crafted.supplies.owned[recipe.owned!], recipe.id).toBe(true);
      if (recipe.requiresOwned) {
        supplies.owned = {};
        expect(craftCampaign(supplies, recipe.id).supplies).toBe(supplies);
      }
    }
  });

  it("leaves everything untouched on insufficient materials, unknown or duplicate recipes", () => {
    const supplies = freezeSupplies(defaultSupplies());
    for (const id of ["missing", "__proto__", "book", "shield", "enchanting_table", "armor_helmet_iron"]) {
      const result = craftCampaign(supplies, id);
      expect(result.error).toBeTruthy();
      expect(result.supplies).toBe(supplies);
    }
  });

  it("never spends missing materials or allows output overflow", () => {
    const supplies = defaultSupplies();
    supplies.materials = { wheat: 3 };
    const made = craftCampaign(supplies, "bread");
    expect(made.supplies.materials).toEqual({ wheat: 0, bread: 1 });
    expect(craftCampaign(made.supplies, "bread").supplies).toBe(made.supplies);
    supplies.materials.bread = Number.MAX_SAFE_INTEGER;
    expect(craftCampaign(supplies, "bread").supplies).toBe(supplies);
  });

  it("repeated crafting stops at exhaustion with all counts nonnegative", () => {
    let supplies = defaultSupplies();
    for (let i = 0; i < 10; i++) {
      supplies = craftCampaign(supplies, "bread").supplies;
      supplies = craftCampaign(supplies, "battle_bed").supplies;
      expect(Object.values(supplies.materials).every(value => Number.isSafeInteger(value) && value >= 0)).toBe(true);
    }
    expect(supplies.materials).toMatchObject({ bread: 2, wheat: 0, spare_bed: 3, wool: 0, plank: 9 });
  });
});

describe("campaign enchant upgrades", () => {
  it("guarantees ranks 1/2/3 with shared rank across replacements and exact total cost", () => {
    let eq = defaultEquipment();
    let supplies = richSupplies();
    eq.attack = { kind: "power", rank: 0 };
    const first = upgradeCampaign(eq, supplies, "attack");
    expect(first.error).toBeUndefined();
    expect(first.equipment.attack.rank).toBe(1);
    expect(first.supplies.materials).toMatchObject({ lapis_lazuli: 94, book: 99, quartz: 100 });
    eq = { ...first.equipment, attack: { ...first.equipment.attack, kind: "ultimate" } };
    supplies = first.supplies;
    const second = upgradeCampaign(eq, supplies, "attack");
    expect(second.equipment.attack).toEqual({ kind: "ultimate", rank: 2 });
    expect(second.supplies.materials).toMatchObject({ lapis_lazuli: 84, book: 99, quartz: 96 });
    const third = upgradeCampaign(second.equipment, second.supplies, "attack");
    expect(third.equipment.attack.rank).toBe(3);
    expect(third.equipment.defense.rank).toBe(0);
    expect(third.supplies.materials).toMatchObject({ lapis_lazuli: 70, book: 99, quartz: 88 });
    const capped = upgradeCampaign(third.equipment, third.supplies, "attack");
    expect(capped.error).toBeTruthy();
    expect(capped.equipment).toBe(third.equipment);
    expect(capped.supplies).toBe(third.supplies);
  });

  it("upgrades defense independently and never mutates or heals", () => {
    const eq = defaultEquipment();
    eq.defense = Object.freeze({ kind: "health", rank: 0 });
    Object.freeze(eq);
    const supplies = freezeSupplies(defaultSupplies());
    const result = upgradeCampaign(eq, supplies, "defense");
    expect(result.equipment.defense).toEqual({ kind: "health", rank: 1 });
    expect(eq.defense.rank).toBe(0);
    expect(maxHp(result.equipment)).toBe(22);
    expect(result.equipment).not.toHaveProperty("hp");
    expect(result.equipment.attack).toBe(eq.attack);
  });

  it("rejects table missing, no kind, or insufficient resources atomically", () => {
    const eq = defaultEquipment();
    const supplies = defaultSupplies();
    expect(upgradeCampaign(eq, supplies, "attack").supplies).toBe(supplies);
    eq.attack = { kind: "break", rank: 1 };
    const noQuartz = upgradeCampaign(eq, supplies, "attack");
    expect(noQuartz.error).toBeTruthy();
    expect(noQuartz.equipment).toBe(eq);
    expect(noQuartz.supplies).toBe(supplies);
    supplies.hasTable = false;
    eq.attack.rank = 0;
    expect(upgradeCampaign(eq, supplies, "attack").supplies).toBe(supplies);
    supplies.hasTable = true;
    supplies.materials = { lapis_lazuli: 6 };
    expect(upgradeCampaign(eq, supplies, "attack").supplies).toBe(supplies);
  });

  it.each([NaN, Infinity, -Infinity, -1, .5, 4])("does not reset or upgrade an invalid rank %s", rank => {
    const eq = defaultEquipment();
    eq.attack = { kind: "power", rank: rank as 0 };
    const supplies = richSupplies();
    const result = upgradeCampaign(eq, supplies, "attack");
    expect(result.error).toBeTruthy();
    expect(result.equipment).toBe(eq);
    expect(result.supplies).toBe(supplies);
  });
});

describe("campaign harvesting and invalid input boundaries", () => {
  it("guarantees wheat 3/4/5 before exactly one optional bonus", () => {
    const supplies = freezeSupplies(defaultSupplies());
    for (const [outcome, amount] of [["normal", 3], ["hit", 4], ["jackpot", 5]] as const) {
      expect(harvestCampaign(supplies, "farm", .99, { outcome }).supplies.materials.wheat).toBe(6 + amount);
      expect(harvestCampaign(supplies, "farm", 0, { outcome }).supplies.materials.wheat).toBe(6 + amount + 1);
    }
    expect(supplies.materials.wheat).toBe(6);
  });

  it("uses exact tool thresholds, adds buddy probability, and caps chance at 1", () => {
    const supplies = defaultSupplies();
    for (const tool of Object.keys(TOOL_BONUS) as (keyof typeof TOOL_BONUS)[]) {
      const chance = TOOL_BONUS[tool];
      expect(harvestCampaign(supplies, "farm", chance - .000001, { tool }).supplies.materials.wheat).toBe(10);
      expect(harvestCampaign(supplies, "farm", chance, { tool }).supplies.materials.wheat).toBe(9);
    }
    expect(harvestCampaign(supplies, "farm", .29, { tool: "iron", buddyBonus: .10 }).supplies.materials.wheat).toBe(10);
    expect(harvestCampaign(supplies, "farm", .99999, { buddyBonus: 100 }).supplies.materials.wheat).toBe(10);
  });

  it.each(["wood", "ranch", "lapis", "nether"] as const)("%s yields deterministic useful materials without spending tickets", place => {
    const supplies = freezeSupplies(defaultSupplies());
    const low = harvestCampaign(supplies, place, 0);
    const high = harvestCampaign(supplies, place, .99999, { outcome: "jackpot", tool: "netherite" });
    expect(low.supplies).toEqual(high.supplies);
    expect(low.supplies).not.toBe(supplies);
    expect(low.message).toContain("+");
    expect(low.supplies).not.toHaveProperty("tickets");
    expect(low.supplies.owned).toEqual(supplies.owned);
    expect(Object.values(low.supplies.materials).every(value => Number.isSafeInteger(value) && value >= 0)).toBe(true);
  });

  it("provides materials to craft books and reach rank three through harvesting", () => {
    let supplies = defaultSupplies();
    for (const place of ["farm", "ranch", "lapis", "lapis", "lapis", "nether", "nether", "nether"] as const) supplies = harvestCampaign(supplies, place, .5).supplies;
    supplies = craftCampaign(supplies, "paper").supplies;
    supplies = craftCampaign(supplies, "book").supplies;
    let eq = defaultEquipment();
    eq.attack.kind = "power";
    for (let i = 0; i < 3; i++) {
      const result = upgradeCampaign(eq, supplies, "attack");
      expect(result.error).toBeUndefined();
      eq = result.equipment;
      supplies = result.supplies;
    }
    expect(eq.attack.rank).toBe(3);
  });

  it.each([NaN, Infinity, -Infinity, -1, 1, 2])("rejects invalid roll %s without a reward", roll => {
    const supplies = defaultSupplies();
    expect(harvestCampaign(supplies, "farm", roll).supplies).toBe(supplies);
    expect(harvestCampaign(supplies, "wood", roll).supplies).toBe(supplies);
  });

  it.each([NaN, Infinity, -Infinity, -1, .5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid material count %s atomically in all mutators", count => {
    const supplies = defaultSupplies();
    supplies.materials.plank = count;
    const eq = defaultEquipment();
    eq.attack.kind = "power";
    expect(craftCampaign(supplies, "bread").supplies).toBe(supplies);
    expect(upgradeCampaign(eq, supplies, "attack").supplies).toBe(supplies);
    expect(harvestCampaign(supplies, "lapis", .5).supplies).toBe(supplies);
  });

  it("rejects invalid bonuses, invalid enums, and gain overflow atomically", () => {
    const supplies = defaultSupplies();
    for (const buddyBonus of [NaN, Infinity, -Infinity, -1]) expect(harvestCampaign(supplies, "farm", 0, { buddyBonus }).supplies).toBe(supplies);
    expect(harvestCampaign(supplies, "farm", 0, { tool: "bad" as "wood" }).supplies).toBe(supplies);
    expect(harvestCampaign(supplies, "farm", 0, { outcome: "bad" as "normal" }).supplies).toBe(supplies);
    expect(harvestCampaign(supplies, "missing" as "farm", 0).supplies).toBe(supplies);
    supplies.materials.wheat = Number.MAX_SAFE_INTEGER;
    expect(harvestCampaign(supplies, "farm", 0).supplies).toBe(supplies);
    expect(supplies.materials.sugar_cane).toBe(0);
  });
});

describe("preparation presentation", () => {
  function props(): CampaignPreparationProps {
    const equipment = defaultEquipment();
    equipment.attack.kind = "power";
    return { equipment, supplies: defaultSupplies(), canChangeType: false, tickets: 0, notice: "じゅんびできたよ", onEquip: vi.fn(), onCraft: vi.fn(), onUpgrade: vi.fn(), onHarvest: vi.fn(), onResume: vi.fn() };
  }

  it("renders controlled selectors, locked kinds, available upgrades, recipes and notice", () => {
    const input = props();
    const html = renderToStaticMarkup(createElement(CampaignPreparation, input));
    expect(html).toContain('role="status"');
    expect(html).toContain("じゅんびできたよ");
    expect(html).not.toContain('<option value="netherite"');
    expect(html).toContain('<select disabled=""');
    expect(html).toContain('aria-label="こうげきの ほしを ふやす">');
    expect(html).toContain("ラピス 12/6");
    expect(html).toContain("バトルベッド");
    expect(input.onEquip).not.toHaveBeenCalled();
    expect(input.onCraft).not.toHaveBeenCalled();
    expect(input.onUpgrade).not.toHaveBeenCalled();
    expect(input.onHarvest).not.toHaveBeenCalled();
  });

  it("only displays netherite options when owned and requires tickets for harvest", () => {
    const input = props();
    input.supplies.owned.sword_netherite = true;
    input.supplies.owned.armor_helmet_netherite = true;
    input.tickets = 1;
    input.canChangeType = true;
    const html = renderToStaticMarkup(createElement(CampaignPreparation, input));
    expect(html.match(/<option value="netherite"/g)).toHaveLength(2);
    expect(html).toContain("1まいで あつめる");
    expect(html).not.toContain("チケットが たまったら");
  });
});
