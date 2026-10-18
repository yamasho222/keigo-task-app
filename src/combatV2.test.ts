import { describe, expect, it } from "vitest";
import { COMBAT_ACTIONS, type CombatAction, type CombatV2Command, type CombatV2Location } from "./combatV2Types";
import { combatAffinity, nextCombatIntent, v2AttackDamage, v2FullDamage, v2HasWater, v2IncomingHp, winningCombatAction } from "./combatV2Rules";
import { canUseCombatV2, transitionCombatV2 } from "./combatV2Session";
import { combatLabSeed, readCombatLabSave } from "./combatV2LabStorage";
import { readCombatV2 } from "./combatV2Migration";
import { normalizeMiningState, type MiningState } from "./miningTypes";
import { rebaseMiningWrite } from "./miningCommit";
import { applyEndQuestOnVisit } from "./endChapter";
import { recommendedCraftRecipeIds } from "./miningUiHelpers";

const dateKey = "2026-10-14";
let serial = 0;
function command(state: MiningState, kind: CombatV2Command["kind"], location: CombatV2Location = "fortress", action: CombatAction = "cut", now = 1000, date = dateKey): CombatV2Command {
  const s = state.combatV2?.sessions[location];
  const base = { location, id: `test-${++serial}`, sessionId: s?.id, expectedRevision: s?.revision ?? 0, now, dateKey: date };
  return (kind === "act" ? { ...base, kind, action } : { ...base, kind }) as CombatV2Command;
}
function run(state: MiningState, kind: CombatV2Command["kind"], location: CombatV2Location = "fortress", action: CombatAction = "cut", now = 1000, date = dateKey): MiningState {
  const result = transitionCombatV2(state, command(state, kind, location, action, now, date));
  if (result.error) throw new Error(result.error);
  return result.state;
}
function ready(location: CombatV2Location = "fortress", scenario: Parameters<typeof combatLabSeed>[0] = "iron"): MiningState {
  return run(combatLabSeed(scenario), "enter", location);
}
function edit(state: MiningState, location: CombatV2Location, patch: Partial<NonNullable<MiningState["combatV2"]>["sessions"]["fortress"]>): MiningState {
  return { ...state, combatV2: { ...state.combatV2!, sessions: { ...state.combatV2?.sessions, [location]: { ...state.combatV2!.sessions[location]!, ...patch } } } };
}
function against(state: MiningState, enemy: CombatAction, location: CombatV2Location = "fortress"): MiningState {
  return edit(state, location, { intent: { actual: enemy, candidates: [enemy], unknown: false } });
}

describe("combat v2 rules", () => {
  it.each(COMBAT_ACTIONS.flatMap((player) => COMBAT_ACTIONS.map((enemy) => [player, enemy] as const)))("resolves %s / %s", (player, enemy) => {
    const expected = player === enemy ? "even" : winningCombatAction(enemy) === player ? "advantage" : "disadvantage";
    expect(combatAffinity(player, enemy)).toBe(expected);
  });
  it("preserves odd sword damage across two hands; water is added once before splitting", () => {
    const state = combatLabSeed("diamond");
    expect(v2FullDamage(state, "warped_forest")).toBe(7);
    expect([false, true].map((second) => v2AttackDamage(state, "warped_forest", second, "even"))).toEqual([3, 4]);
    state.equipped.held = "water";
    expect([false, true].map((second) => v2AttackDamage(state, "warped_forest", second, "even"))).toEqual([5, 5]);
    state.materials.water = 0;
    expect(v2FullDamage(state, "warped_forest")).toBe(7);
    expect(v2HasWater(state, "warped_forest")).toBe(false);
  });
  it("anchors diamond Enderman counters at five hearts and water at 90% before rounding", () => {
    const dry = combatLabSeed("diamond"), wet = combatLabSeed("water");
    expect(["advantage", "even", "disadvantage"].map((a) => v2IncomingHp(dry, "warped_forest", a as "even"))).toEqual([5, 10, 15]);
    expect(["advantage", "even", "disadvantage"].map((a) => v2IncomingHp(wet, "warped_forest", a as "even"))).toEqual([0, 1, 2]);
  });
  it("commits honest intents, has fixed candidate order, and never repeats unknown", () => {
    let seed = 123, unknown = false;
    for (let turn = 0; turn < 3000; turn++) {
      const next = nextCombatIntent(seed, turn, unknown);
      expect(next).toEqual(nextCombatIntent(seed, turn, unknown));
      if (next.intent.unknown) expect(unknown).toBe(false);
      else expect(next.intent.candidates).toContain(next.intent.actual);
      if (turn < 3) expect(next.intent.candidates).toHaveLength(1);
      seed = next.seed; unknown = next.intent.unknown;
    }
  });
});

describe("combat v2 session", () => {
  it("buys two hands and counters each hand; last hand works with zero tickets", () => {
    let state = ready("fortress", "last-ticket");
    state = against(state, "cut");
    state = run(state, "act", "fortress", "cut");
    expect(state.tickets).toBe(0);
    expect(state.combatV2?.sessions.fortress?.remainingActions).toBe(1);
    expect(state.combatV2?.sessions.fortress?.lastEvent?.takenHp).toBeGreaterThan(0);
    expect(canUseCombatV2(state, "fortress", "act")).toBe(true);
    const firstHp = state.combatV2!.sessions.fortress!.hp;
    state = run(against(state, "cut"), "act", "fortress", "cut");
    expect(state.tickets).toBe(0);
    expect(state.combatV2!.sessions.fortress!.hp).toBeLessThan(firstHp);
    expect(state.combatV2!.sessions.fortress!.remainingActions).toBe(0);
    expect(canUseCombatV2(state, "fortress", "act")).toBe(false);
  });
  it("guard consumes a hand and is not an infinite free action", () => {
    const state = run(against(ready(), "cut"), "act", "fortress", "guard");
    expect(state.tickets).toBe(7);
    expect(state.combatV2!.sessions.fortress!.gauge).toBe(1);
    expect(state.combatV2!.sessions.fortress!.remainingActions).toBe(1);
  });
  it("heals five hearts without counter, reroll, gauge or consuming the leftover hand", () => {
    const before = edit(ready(), "fortress", { hp: 5, remainingActions: 1, gauge: 3 });
    const after = run(before, "heal");
    expect(after.tickets).toBe(before.tickets - 1);
    expect(after.combatV2!.sessions.fortress).toMatchObject({ hp: 15, remainingActions: 1, gauge: 3, intent: before.combatV2!.sessions.fortress!.intent });
    const full = edit(after, "fortress", { hp: 20 });
    expect(run(full, "sync")).toBe(full);
    expect(transitionCombatV2(full, command(full, "heal")).state).toBe(full);
  });
  it("does not drop on contact, stages one kill, secures only on completion", () => {
    let state = against(ready(), "cut");
    state = run(state, "act", "fortress", "cut");
    expect(state.materials.blaze_rod ?? 0).toBe(0);
    state = edit(against(state, "cut"), "fortress", { mobs: [1, 20] });
    state = run(state, "act", "fortress", "cut");
    expect(state.combatV2!.sessions.fortress!.bag).toBe(1);
    expect(state.materials.blaze_rod ?? 0).toBe(0);
    state = edit(against(state, "cut"), "fortress", { mobs: [0, 1] });
    state = run(state, "act", "fortress", "cut");
    expect(state.materials.blaze_rod).toBe(2);
    expect(state.combatV2!.sessions.fortress).toMatchObject({ status: "cleared", bag: 0 });
    expect(state.combatV2!.sessions.fortress!.lastEvent!.takenHp).toBe(0);
  });
  it("only secured rods unlock the forest, including a partial-wave return", () => {
    const before = edit({ ...ready(), materials: { blaze_rod: 3, water: 1 } }, "fortress", { bag: 1, mobs: [0, 18], remainingActions: 1 });
    expect(before.unlockedGachas).not.toContain("warped_forest");
    const after = run(before, "return");
    expect(after.materials.blaze_rod).toBe(4);
    expect(after.unlockedGachas).toContain("warped_forest");
    expect(after.combatV2!.sessions.fortress).toMatchObject({ status: "returned", remainingActions: 0, mobs: [0, 18] });
    expect(transitionCombatV2(after, command(after, "return")).state).toBe(after);
  });
  it("defeat loses only pending loot and locks only the current place", () => {
    let state = edit(against(ready(), "cut"), "fortress", { hp: 1, bag: 1, mobs: [0, 20], gauge: 4 });
    state.materials.blaze_rod = 3;
    state = run(state, "act", "fortress", "cut");
    expect(state.materials.blaze_rod).toBe(3);
    expect(state.combatV2!.sessions.fortress).toMatchObject({ status: "defeated", hp: 0, bag: 0, gauge: 0, remainingActions: 0 });
    expect(state.combatV2!.sessions.fortress!.lastEvent!.lost).toBe(1);
    expect(canUseCombatV2(state, "fortress", "heal")).toBe(false);
    state.unlockedGachas.push("warped_forest");
    state = run(state, "enter", "warped_forest");
    expect(state.combatV2!.sessions.warped_forest!.hp).toBe(20);
    const hp = state.combatV2!.sessions.fortress!.mobs;
    state = run(state, "sync", "fortress", "cut", 1000, "2026-10-15");
    expect(state.combatV2!.sessions.fortress).toMatchObject({ status: "choosing", hp: 20, mobs: hp });
  });
  it("water discovered after defeat gives one retry but no free attack or lost loot", () => {
    let state = edit(ready("warped_forest", "diamond"), "warped_forest", { status: "defeated", hp: 0, failures: 1 });
    state.equipped.held = "water";
    const tickets = state.tickets;
    state = run(state, "retryWater", "warped_forest");
    expect(state.tickets).toBe(tickets);
    expect(state.combatV2!.sessions.warped_forest).toMatchObject({ hp: 20, status: "choosing", remainingActions: 0, waterRetryUsed: true, bag: 0 });
    state = edit(state, "warped_forest", { status: "defeated", hp: 0 });
    expect(canUseCombatV2(state, "warped_forest", "retryWater")).toBe(false);
  });
  it("preserves paid hands, bag, intent and gauge across reload and next day", () => {
    const before = edit(ready(), "fortress", { remainingActions: 1, bag: 1, mobs: [0, 10], hp: 8, gauge: 4 });
    const reloaded = normalizeMiningState(JSON.parse(JSON.stringify(before)));
    expect(reloaded.combatV2).toEqual(before.combatV2);
    const after = run(reloaded, "sync", "fortress", "cut", 1000, "2026-10-15");
    expect(after.combatV2!.sessions.fortress).toMatchObject({ hp: 20, remainingActions: 1, bag: 1, gauge: 4, mobs: [0, 10], intent: before.combatV2!.sessions.fortress!.intent });
  });
  it("rejects stale and duplicated commands as a whole, but permits a simultaneous parent ticket grant", () => {
    const before = ready();
    const cmd = command(before, "act");
    const once = transitionCombatV2(before, cmd).state;
    expect(transitionCombatV2(once, cmd).state).toBe(once);
    const stale = { ...cmd, id: "stale-new-id" };
    expect(transitionCombatV2(once, stale).state).toBe(once);
    const parent = { ...before, tickets: before.tickets + 1 };
    expect(transitionCombatV2(parent, cmd).state.tickets).toBe(before.tickets);
    expect(rebaseMiningWrite(once, before, transitionCombatV2(before, stale).state)).toBe(once);
    expect(rebaseMiningWrite(parent, before, once).tickets).toBe(before.tickets);
    expect(rebaseMiningWrite(once, before, { ...before, miningPoints: 1 }).combatV2).toEqual(once.combatV2);
  });
  it("keeps remaining hands across waves", () => {
    const state = edit(ready(), "fortress", { status: "cleared", mobs: [0, 0], remainingActions: 1 });
    const next = run(state, "next");
    expect(next.combatV2!.sessions.fortress).toMatchObject({ status: "choosing", mobs: [20, 20], remainingActions: 1, wave: 1 });
    expect(next.tickets).toBe(state.tickets);
  });
});

describe("combat v2 special and migration", () => {
  it("uses the last prepaid hand with no extra ticket and interrupts the counter even with zero taps", () => {
    let state = edit(ready("warped_forest", "water"), "warped_forest", { gauge: 5, remainingActions: 1 });
    state.tickets = 0;
    state = run(state, "beginSpecial", "warped_forest", "cut", 1000);
    expect(state.tickets).toBe(0);
    expect(state.combatV2!.sessions.warped_forest).toMatchObject({ gauge: 0, remainingActions: 0, status: "special" });
    expect(run(state, "finishSpecial", "warped_forest", "cut", 5999)).toBe(state);
    state = run(normalizeMiningState(JSON.parse(JSON.stringify(state))), "sync", "warped_forest", "cut", 6000);
    expect(state.combatV2!.sessions.warped_forest).toMatchObject({ hp: 20, mobs: [20, 20], status: "choosing", gauge: 0 });
    const once = state;
    expect(run(state, "finishSpecial", "warped_forest", "cut", 7000)).toBe(once);
  });
  it("caps valid taps at ten, rejects expired/rapid taps, and snapshots damage before equipment changes", () => {
    let state = edit(ready("warped_forest", "water"), "warped_forest", { gauge: 5 });
    state = run(state, "beginSpecial", "warped_forest", "cut", 1000);
    state.equipped.held = null;
    state = run(state, "tap", "warped_forest", "cut", 1100);
    expect(run(state, "tap", "warped_forest", "cut", 1150)).toBe(state);
    for (let i = 2; i <= 12; i++) state = run(state, "tap", "warped_forest", "cut", 1000 + i * 100);
    expect(state.combatV2!.sessions.warped_forest!.pendingSpecial!.taps).toBe(10);
    expect(run(state, "tap", "warped_forest", "cut", 6000)).toBe(state);
    state = run(state, "sync", "warped_forest", "cut", 6000);
    expect(state.combatV2!.sessions.warped_forest!.lastEvent!.damage).toBe(60);
    expect(state.combatV2!.sessions.warped_forest!.status).toBe("cleared");
  });
  it("settles an expired special before a daily refresh exactly once", () => {
    let state = edit(ready(), "fortress", { gauge: 5, hp: 4 });
    state = run(state, "beginSpecial", "fortress", "cut", 1000);
    state = run(state, "sync", "fortress", "cut", 7000, "2026-10-15");
    expect(state.combatV2!.sessions.fortress).toMatchObject({ hp: 20, dateKey: "2026-10-15" });
    expect(state.combatV2!.sessions.fortress!.pendingSpecial).toBeUndefined();
    const hp = state.combatV2!.sessions.fortress!.mobs;
    state = run(state, "sync", "fortress", "cut", 8000, "2026-10-15");
    expect(state.combatV2!.sessions.fortress!.mobs).toEqual(hp);
  });
  it.each([[false, 1, 1], [true, 0, 2], [true, 1, 1]] as const)("migrates prepaid legacy hands %s / %s", (freeFirstAttack, step, expected) => {
    const state = combatLabSeed("iron");
    state.playerHp = 13; state.playerHpDate = dateKey; state.specialGauge = 3;
    state.combatProgress = { fortress: { dateKey, startHp: 20, attackStep: step, freeFirstAttack, cardLayout: ["normal", "hit", "normal"], dragonTarget: "dragon" } };
    const next = run(state, "enter");
    expect(next.combatV2!.sessions.fortress).toMatchObject({ remainingActions: expected, hp: 13, gauge: 3 });
    expect(next.combatProgress?.fortress).toBeUndefined();
    expect(next.specialGauge).toBe(0);
    expect(run(next, "enter")).toBe(next);
  });
  it("does not duplicate shared gauge or retroactively lock an old death", () => {
    const state = combatLabSeed("diamond"); state.specialGauge = 5;
    const first = run(state, "enter");
    const second = run(first, "enter", "warped_forest");
    expect(second.combatV2!.sessions.fortress!.gauge + second.combatV2!.sessions.warped_forest!.gauge).toBe(5);
    const dead = combatLabSeed("iron"); dead.playerHp = 0; dead.playerHpDate = dateKey;
    expect(run(dead, "enter").combatV2!.sessions.fortress).toMatchObject({ hp: 20, status: "choosing" });
  });
  it("preserves an in-flight paid legacy special without restarting its deadline or losing prior taps", () => {
    const state = combatLabSeed("iron");
    state.combatProgress = { fortress: { dateKey, startHp: 20, attackStep: 1, freeFirstAttack: false, cardLayout: ["normal", "normal", "hit"], dragonTarget: "dragon", pendingSpecial: { startedAtMs: 500, taps: 12, target: "dragon" } } };
    let next = run(state, "enter", "fortress", "cut", 1000);
    expect(next.tickets).toBe(state.tickets);
    expect(next.combatV2!.sessions.fortress).toMatchObject({ status: "special", remainingActions: 1, pendingSpecial: { deadline: 5500, baseDamage: 48, legacy: true } });
    next = run(next, "sync", "fortress", "cut", 5500);
    expect(next.materials.blaze_rod).toBe(2);
    expect(next.combatV2!.sessions.fortress!.status).toBe("cleared");
    expect(run(next, "sync", "fortress", "cut", 6000).materials.blaze_rod).toBe(2);
  });
  it("blocks unknown or damaged saves without silently dropping state", () => {
    const state = ready();
    expect(() => readCombatV2({ ...state.combatV2, version: 3 })).toThrow();
    const broken = edit(state, "fortress", { hp: Number.NaN });
    expect(() => readCombatV2(broken.combatV2)).toThrow();
    expect(() => readCombatLabSave(JSON.stringify({ schemaVersion: 3, mining: state }))).toThrow();
  });
  it("can recommend powder before the forest opens because unlocks now use cumulative rods", () => {
    const state = ready(); state.materials.blaze_rod = 3;
    state.unlockedGachas.push("fortress");
    expect(recommendedCraftRecipeIds(state)).toContain("blaze_powder_batch");
  });
  it("chooses mining-only destinations and never advances through an old combat mark", () => {
    const state = ready("warped_forest", "water"); state.materials.ender_eye = 1; state.equipped.held = "ender_eye";
    const next = applyEndQuestOnVisit(state, "wood", () => 0.999).state;
    expect(["fortress", "warped_forest"]).not.toContain(next.endQuest?.mark);
    next.endQuest!.mark = "warped_forest";
    const visited = applyEndQuestOnVisit(next, "warped_forest", () => 0.9).state;
    expect(visited.endQuest?.visited).not.toContain("warped_forest");
  });
  it("does not count paid attacks, healing or prepaid hands as mining-screen hint visits", () => {
    let state = ready(); state.materials.ender_eye = 1;
    state = run(state, "act");
    expect(state.endQuest?.enderEyeHintVisits).toBe(0);
    state = run(state, "heal");
    state = run(state, "act");
    expect(state.endQuest?.enderEyeHintVisits).toBe(0);
  });
});
