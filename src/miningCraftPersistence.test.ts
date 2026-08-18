import { describe, expect, it } from "vitest";
import { firestoreAppStateSetOptions } from "./cloudAppStateWrite";
import {
  composeMiningPatches,
  patchFromResult,
  rebaseCountMap,
  rebaseMiningWrite,
} from "./miningCommit";
import { MINING_RECIPES, addTickets, tryCraft } from "./miningProgress";
import { emptyMiningState, getMaterialCount, type MiningState } from "./miningTypes";

function recipe(id: string) {
  const found = MINING_RECIPES.find((item) => item.id === id);
  if (!found) throw new Error(`recipe not found: ${id}`);
  return found;
}

function withMaterials(materials: MiningState["materials"], extra?: Partial<MiningState>): MiningState {
  return {
    ...emptyMiningState(),
    materials,
    ...extra,
  };
}

describe("cloud appState write", () => {
  it("does not merge, so deleted material keys are replaced", () => {
    expect(firestoreAppStateSetOptions()).toBeUndefined();
  });
});

describe("tryCraft materials", () => {
  it("consumes the last piece and keeps 0 instead of dropping the key", () => {
    const before = withMaterials({ log: 1 });
    const result = tryCraft(before, recipe("plank_batch"));
    expect(result.error).toBeUndefined();
    expect(getMaterialCount(result.state, "log")).toBe(0);
    expect(result.state.materials.log).toBe(0);
    expect(getMaterialCount(result.state, "plank")).toBe(4);
  });

  it("is pure: applying twice to the same snapshot yields the same next state", () => {
    const before = withMaterials({ log: 3 });
    const first = tryCraft(before, recipe("plank_batch"));
    const second = tryCraft(before, recipe("plank_batch"));
    expect(first.state).toEqual(second.state);
    expect(getMaterialCount(first.state, "log")).toBe(2);
  });

  it("marks replaced gear as false instead of deleting the key", () => {
    const before = withMaterials(
      { cobble: 3, stick: 2 },
      {
        crafted: { workbench: true, sword_wood: true },
        unlockedGachas: ["wood", "stone"],
      },
    );
    const result = tryCraft(before, recipe("sword_stone"));
    expect(result.error).toBeUndefined();
    expect(result.state.crafted.sword_stone).toBe(true);
    expect(result.state.crafted.sword_wood).toBe(false);
  });
});

describe("mining state races", () => {
  it("stale snapshot replace undoes material spend (the old bug)", () => {
    const start = withMaterials({ log: 1 });
    const crafted = tryCraft(start, recipe("plank_batch")).state;
    const stalePlusTickets = addTickets(start, 1);
    expect(getMaterialCount(stalePlusTickets, "log")).toBe(1);
    expect(getMaterialCount(crafted, "log")).toBe(0);
    expect(getMaterialCount(stalePlusTickets, "plank")).toBe(0);
  });

  it("composed patches keep the craft spend and still add tickets", () => {
    const start = withMaterials({ log: 1 });
    const next = composeMiningPatches(start, [
      patchFromResult((prev) => tryCraft(prev, recipe("plank_batch"))),
      (prev) => addTickets(prev, 1),
    ]);
    expect(getMaterialCount(next, "log")).toBe(0);
    expect(getMaterialCount(next, "plank")).toBe(4);
    expect(next.tickets).toBe(1);
  });
});

describe("rebaseMiningWrite", () => {
  it("keeps concurrent ticket grants on top of a dig write", () => {
    const from = withMaterials({ log: 2 }, { tickets: 3 });
    const written = withMaterials({ log: 3 }, { tickets: 2 });
    const latest = withMaterials({ log: 2 }, { tickets: 4 });
    const rebased = rebaseMiningWrite(latest, from, written);
    expect(rebased.tickets).toBe(3);
    expect(getMaterialCount(rebased, "log")).toBe(3);
  });

  it("3-way merges count maps so a concurrent write does not restore spent materials", () => {
    const from = { log: 1 };
    const written = { log: 0, plank: 4 };
    const latest = { log: 1 };
    const rebased = rebaseCountMap(from, latest, written);
    expect(rebased.log).toBe(0);
    expect(rebased.plank).toBe(4);
  });

  it("object merge restores a deleted key, but an explicit 0 overwrites it", () => {
    const remote = { log: 1 };
    expect({ ...remote, ...{ plank: 4 } }).toEqual({ log: 1, plank: 4 });
    expect({ ...remote, ...{ log: 0, plank: 4 } }).toEqual({ log: 0, plank: 4 });
  });
});
