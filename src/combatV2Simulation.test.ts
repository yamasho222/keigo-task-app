import { describe, expect, it } from "vitest";
import { simulateCombatV2, summarizeCombatSimulations } from "./combatV2Simulation";

const waveSamples = process.env.COMBAT_V2_FULL_SIM === "1" ? 10000 : 1000;
const routeSamples = process.env.COMBAT_V2_FULL_SIM === "1" ? 1000 : 100;

describe("combat v2 balance with actual transitions", () => {
  it("compares reading, random and fixed actions with reproducible seeds", () => {
    for (const [scenario, location] of [["iron", "fortress"], ["diamond", "warped_forest"], ["water", "warped_forest"]] as const) {
      const rows = ["reader", "random", "guard-only"].map((policy) => ({
        scenario, policy,
        ...summarizeCombatSimulations(Array.from({ length: waveSamples }, (_, index) => simulateCombatV2({ seed: 710214 + index, scenario, location, policy: policy as "reader", specialTaps: 5 }))),
      }));
      console.log("COMBAT_V2_WAVE", JSON.stringify(rows));
      expect(rows[0].completed).toBe(waveSamples);
      expect(rows[0].meanTickets!).toBeLessThan(rows[1].meanTickets!);
      expect(rows[0].meanTickets!).toBeLessThan(rows[2].meanTickets!);
    }
  }, 120000);
  it("collects actual materials, crafts twelve eyes, explores and unlocks the End on finite daily budgets", () => {
    for (const dailyTickets of [1, 2, 4, 5]) {
      const result = summarizeCombatSimulations(Array.from({ length: routeSamples }, (_, index) => simulateCombatV2({ seed: 710214 + index, scenario: "water", policy: "reader", specialTaps: 5, route: true, dailyTickets })));
      console.log("COMBAT_V2_ROUTE", JSON.stringify({ dailyTickets, ...result }));
      expect(result.completed).toBe(routeSamples);
    }
  }, 120000);
  it("has a useful guaranteed special without requiring tapping speed", () => {
    const rows = [0, 5, 10].map((specialTaps) => ({ specialTaps, ...summarizeCombatSimulations(Array.from({ length: 200 }, (_, index) => simulateCombatV2({ seed: 710214 + index, scenario: "water", location: "warped_forest", policy: "reader", specialTaps }))) }));
    console.log("COMBAT_V2_TAPS", JSON.stringify(rows));
    expect(rows[0].completed).toBe(200);
    expect(rows[2].meanTickets!).toBeLessThanOrEqual(rows[0].meanTickets!);
  }, 120000);
});
