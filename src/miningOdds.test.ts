import { describe, expect, it } from "vitest";
import {
  compareDigCountOdds,
  previewDigBoost,
  strippedMiningStateForOdds,
} from "./miningProgress";
import { emptyMiningState, type MiningState } from "./miningTypes";

function rate(segments: { key: string; rate: number }[], key: string): number {
  return segments.find((s) => s.key === key)?.rate ?? 0;
}

function woodWithAxe(): MiningState {
  return {
    ...emptyMiningState(),
    crafted: { axe_wood: true },
    equipped: {
      tool: "axe_wood",
      helmet: null,
      chest: null,
      leggings: null,
      boots: null,
    },
  };
}

describe("dig count odds compare", () => {
  it("stripped preview matches empty loadout", () => {
    const loaded = woodWithAxe();
    const bare = previewDigBoost({
      state: strippedMiningStateForOdds(loaded),
      gacha: "wood",
      toolKind: "axe",
      dateKey: "2026-08-26",
    });
    const empty = previewDigBoost({
      state: emptyMiningState(),
      gacha: "wood",
      toolKind: "axe",
      dateKey: "2026-08-26",
    });
    expect(bare.finalOdds).toEqual(empty.finalOdds);
    expect(bare.expectedCount).toBeCloseTo(1.28, 2);
  });

  it("wood axe raises 2-count chance versus stripped", () => {
    const loaded = woodWithAxe();
    const now = previewDigBoost({
      state: loaded,
      gacha: "wood",
      toolKind: "axe",
      dateKey: "2026-08-26",
    });
    const bare = previewDigBoost({
      state: strippedMiningStateForOdds(loaded),
      gacha: "wood",
      toolKind: "axe",
      dateKey: "2026-08-26",
    });
    expect(now.expectedCount).toBeGreaterThan(bare.expectedCount);
    const rows = compareDigCountOdds(bare.finalOdds, now.finalOdds);
    const two = rows.find((r) => r.key === "2");
    expect(two).toBeTruthy();
    expect(two!.after).toBeGreaterThan(two!.before);
    expect(rate(now.finalOdds, "1")).toBeLessThan(rate(bare.finalOdds, "1"));
  });
});
