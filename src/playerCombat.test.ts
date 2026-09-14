import { describe, expect, it } from "vitest";
import { emptyMiningState, type MiningState } from "./miningTypes";
import {
  applyEnemyCounter,
  armorCutPercent,
  beginSpecialAttack,
  incomingHearts,
  revivePlayer,
  specialDamageFromTaps,
  syncPlayerHpForDate,
} from "./playerCombat";

function withArmor(tiers: {
  helmet?: string;
  chest?: string;
  leggings?: string;
  boots?: string;
}): MiningState {
  const crafted: MiningState["crafted"] = { sword_diamond: true };
  const equipped = { ...emptyMiningState().equipped, tool: "sword_diamond" as const };
  for (const slot of ["helmet", "chest", "leggings", "boots"] as const) {
    const tier = tiers[slot];
    if (!tier) continue;
    const id = `${slot}_${tier}` as const;
    crafted[id] = true;
    equipped[slot] = id;
  }
  return { ...emptyMiningState(), crafted, equipped, tickets: 4, playerHp: 20 };
}

describe("armor reduction", () => {
  it("netherite full is 100% and 0 damage even vs dragon heavy", () => {
    const state = withArmor({
      helmet: "netherite",
      chest: "netherite",
      leggings: "netherite",
      boots: "netherite",
    });
    expect(armorCutPercent(state)).toBe(100);
    expect(incomingHearts(state, "dragon")).toBe(0);
    expect(incomingHearts(state, "dragon", true)).toBe(0);
    expect(incomingHearts(state, "blaze")).toBe(0);
    expect(incomingHearts(state, "enderman")).toBe(0);
  });

  it("iron full is 30% — dragon 3.5 / blaze 1.5 / enderman 2", () => {
    const state = withArmor({
      helmet: "iron",
      chest: "iron",
      leggings: "iron",
      boots: "iron",
    });
    expect(armorCutPercent(state)).toBe(30);
    expect(incomingHearts(state, "dragon")).toBe(3.5);
    expect(incomingHearts(state, "dragon", true)).toBe(7);
    expect(incomingHearts(state, "blaze")).toBe(1.5);
    expect(incomingHearts(state, "enderman")).toBe(2);
  });

  it("diamond full is 60% — dragon 2", () => {
    const state = withArmor({
      helmet: "diamond",
      chest: "diamond",
      leggings: "diamond",
      boots: "diamond",
    });
    expect(armorCutPercent(state)).toBe(60);
    expect(incomingHearts(state, "dragon")).toBe(2);
    expect(incomingHearts(state, "dragon", true)).toBe(4);
  });

  it("naked dragon is 5, heavy is 10", () => {
    const state = emptyMiningState();
    expect(incomingHearts(state, "dragon")).toBe(5);
    expect(incomingHearts(state, "dragon", true)).toBe(10);
    expect(incomingHearts(state, "blaze")).toBe(2);
    expect(incomingHearts(state, "enderman")).toBe(3);
  });
});

describe("player hp persist", () => {
  it("refills the next morning", () => {
    const wounded = { ...emptyMiningState(), playerHp: 4, playerHpDate: "2026-09-14" };
    const next = syncPlayerHpForDate(wounded, "2026-09-15");
    expect(next.playerHp).toBe(20);
    expect(next.playerHpDate).toBe("2026-09-15");
    expect(syncPlayerHpForDate(next, "2026-09-15").playerHp).toBe(20);
  });

  it("revives for one ticket", () => {
    const dead = { ...emptyMiningState(), playerHp: 0, tickets: 2 };
    const up = revivePlayer(dead);
    expect(up.error).toBeUndefined();
    expect(up.state.playerHp).toBe(20);
    expect(up.state.tickets).toBe(1);
    expect(revivePlayer({ ...dead, tickets: 0 }).error).toBeTruthy();
  });

  it("counter can drop hp to 0", () => {
    const hit = applyEnemyCounter({ ...emptyMiningState(), playerHp: 6 }, "dragon", true);
    expect(hit.takenHearts).toBe(10);
    expect(hit.died).toBe(true);
    expect(hit.state.playerHp).toBe(0);
    expect(hit.state.specialGauge).toBe(0);
  });

  it("death clears special gauge", () => {
    const hit = applyEnemyCounter(
      { ...emptyMiningState(), playerHp: 2, specialGauge: 5 },
      "blaze",
    );
    expect(hit.died).toBe(true);
    expect(hit.state.specialGauge).toBe(0);
  });
});

describe("special attack", () => {
  it("tap damage is count times 2", () => {
    expect(specialDamageFromTaps(0)).toBe(0);
    expect(specialDamageFromTaps(1)).toBe(2);
    expect(specialDamageFromTaps(12)).toBe(24);
  });

  it("beginSpecialAttack spends one ticket and empties the gauge", () => {
    const ready = { ...emptyMiningState(), tickets: 3, specialGauge: 5, playerHp: 20 };
    const begun = beginSpecialAttack(ready);
    expect(begun.error).toBeUndefined();
    expect(begun.state.tickets).toBe(2);
    expect(begun.state.specialGauge).toBe(0);
    expect(begun.state.specialHintSeen).toBe(true);
    expect(beginSpecialAttack({ ...ready, specialGauge: 4 }).error).toBeTruthy();
  });
});
