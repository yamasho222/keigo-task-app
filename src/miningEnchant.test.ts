import { describe, expect, it } from "vitest";
import {
  ENCHANT_REROLL_COST,
  applyEnchant,
  ensureEnchantOffers,
  rerollEnchantOffers,
} from "./miningEnchant";
import { emptyMiningState, normalizeMiningState, type MiningState } from "./miningTypes";

function withLapis(n: number, extra?: Partial<MiningState>): MiningState {
  return {
    ...emptyMiningState(),
    materials: { lapis: n },
    ...extra,
  };
}

function seqRand(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)] ?? 0;
}

describe("pending enchant offers", () => {
  it("keeps the first roll until reroll", () => {
    const first = ensureEnchantOffers(withLapis(0), "sword", seqRand([0, 0.9]));
    const again = ensureEnchantOffers(first.state, "sword", seqRand([0.5, 0.5]));
    expect(again.state).toBe(first.state);
    expect(again.offers).toEqual(first.offers);
    expect(again.offers[0]).not.toBe(again.offers[1]);
  });

  it("charges 3 lapis every reroll and changes the offers", () => {
    const seeded = ensureEnchantOffers(withLapis(10), "axe", seqRand([0, 0.9]));
    const reroll = rerollEnchantOffers(seeded.state, "axe", seqRand([0.4, 0.8]));
    expect(reroll.error).toBeUndefined();
    expect(reroll.state.materials.lapis).toBe(10 - ENCHANT_REROLL_COST);
    expect(reroll.state.pendingEnchantOffers?.axe).not.toEqual(seeded.offers);
  });

  it("does not reroll when lapis is short", () => {
    const seeded = ensureEnchantOffers(withLapis(2), "pickaxe", seqRand([0, 0.9]));
    const reroll = rerollEnchantOffers(seeded.state, "pickaxe", seqRand([0.4, 0.8]));
    expect(reroll.error).toBe(`ラピスが${ENCHANT_REROLL_COST}こひつようだよ`);
    expect(reroll.state.pendingEnchantOffers?.pickaxe).toEqual(seeded.offers);
    expect(reroll.state.materials.lapis).toBe(2);
  });

  it("clears pending offers when applying", () => {
    const seeded = ensureEnchantOffers(withLapis(0), "helmet", seqRand([0, 0.9]));
    const applied = applyEnchant(seeded.state, "helmet", seeded.offers[0]);
    expect(applied.error).toBeUndefined();
    expect(applied.state.pendingEnchantOffers?.helmet).toBeUndefined();
    expect(applied.state.enchants.helmet?.id).toBe(seeded.offers[0]);
  });

  it("round-trips pending offers through normalize", () => {
    const seeded = ensureEnchantOffers(withLapis(0), "boots", seqRand([0, 0.9]));
    const loaded = normalizeMiningState(seeded.state);
    expect(loaded.pendingEnchantOffers?.boots).toEqual(seeded.offers);
  });
});
