import { describe, expect, it } from "vitest";
import { lastSelectedToolKind } from "./miningProgress";
import { emptyMiningState } from "./miningTypes";

describe("lastSelectedToolKind", () => {
  it("keeps the equipped tool kind when moving to a place that recommends another tool", () => {
    const state = {
      ...emptyMiningState(),
      crafted: { sword_wood: true, axe_wood: true },
      equipped: { ...emptyMiningState().equipped, tool: "sword_wood" as const },
    };

    expect(lastSelectedToolKind(state, "farm")).toBe("sword");
  });

  it("uses the place recommendation when there is no saved selection", () => {
    const state = {
      ...emptyMiningState(),
      crafted: { axe_wood: true },
    };

    expect(lastSelectedToolKind(state, "farm")).toBe("axe");
  });

  it("falls back to an owned tool if the place recommendation is unavailable", () => {
    const state = {
      ...emptyMiningState(),
      crafted: { pickaxe_wood: true },
      equipped: { ...emptyMiningState().equipped, tool: "axe_wood" as const },
    };

    expect(lastSelectedToolKind(state, "farm")).toBe("pickaxe");
  });
});
