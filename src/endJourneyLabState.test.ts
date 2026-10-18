import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import EndJourneyLab from "./EndJourneyLab";
import { addLastLabRod, finishLabCraft, JOURNEY_LAB_STEPS, journeyLabNext, journeyLabSeed, journeyLabStepSeed, topUpLabMaterials, type JourneyLabScenario } from "./endJourneyLabState";
import { applyEndQuestOnVisit, insertPortalEye, unlockTheEnd } from "./endChapter";
import { equipHeld, refreshUnlocks, tryCraft } from "./miningProgress";
import { MINING_RECIPES } from "./miningRecipes";
import { normalizeMiningState } from "./miningTypes";

describe("DEV-only sequential journey fixtures", () => {
  it("starts with Blaze, links the new battle demos, and labels isolated data honestly", () => {
    const html = renderToStaticMarkup(createElement(EndJourneyLab));
    expect(html).toContain('href="?blaze-prototype=1"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("別タブ・別の仮データ");
    expect(html).toContain("報酬は自動で引き継がず");
    expect(html).toContain('aria-current="step"');
    expect(JOURNEY_LAB_STEPS.map((s) => s.id)).toEqual(["blaze", "forest", "enderman", "craft", "search", "portal"]);
  });
  it("prepares a three-rod acquisition record, with the rods already converted to powder", () => {
    const fixture = journeyLabStepSeed("forest");
    expect(fixture.endJourney?.rodsAcquired).toBe(3);
    expect(fixture.materials.blaze_rod ?? 0).toBe(0);
    expect(fixture.materials.blaze_powder).toBe(6);
    expect(fixture.unlockedGachas).not.toContain("warped_forest");
    expect(journeyLabNext("forest", fixture).error).toBeTruthy();
    const unlocked = addLastLabRod(fixture);
    expect(unlocked.materials.blaze_rod).toBe(1);
    expect(unlocked.endJourney?.rodsAcquired).toBe(4);
    expect(unlocked.unlockedGachas).toContain("warped_forest");
    expect(unlocked.tickets).toBe(fixture.tickets);
    expect(addLastLabRod(unlocked)).toBe(unlocked);
    const next = journeyLabNext("forest", unlocked);
    expect(next.step).toBe("enderman");
    expect(next.state).toBe(unlocked);
  });
  it("each direct step selection creates independent disposable state", () => {
    const one = journeyLabStepSeed("craft");
    one.materials.blaze_rod = 99;
    expect(journeyLabStepSeed("craft").materials.blaze_rod).toBe(6);
    expect(journeyLabStepSeed("portal").endQuest).toMatchObject({ foundPortal: true, eyes: 0 });
    expect(journeyLabStepSeed("search").equipped.held).toBeNull();
    expect(journeyLabStepSeed("enderman").unlockedGachas).toContain("warped_forest");
  });
  it.each(["debris", "rods", "materials", "eye", "hint3", "hint5", "hint7", "hunt", "portal", "legacy"] satisfies JourneyLabScenario[])("retains the existing %s scenario", (scenario) => {
    const seed = journeyLabSeed(scenario);
    expect(seed.tickets).toBe(12);
    expect(seed.crafted.sword_diamond).toBe(true);
    expect(seed.combatV2).toBeUndefined();
    expect(seed.playerHp).toBe(20);
    const reload = refreshUnlocks(normalizeMiningState(JSON.parse(JSON.stringify(seed))));
    expect(reload.materials).toEqual(seed.materials);
    expect(reload.endQuest).toEqual(seed.endQuest);
  });
});

describe("test-only material shortcuts use real recipes", () => {
  it("six rods and twelve pearls make exactly twelve eyes, without tickets or HP changes", () => {
    const fixture = journeyLabStepSeed("craft");
    const before = JSON.stringify(fixture);
    const result = finishLabCraft(fixture);
    expect(result.error).toBeUndefined();
    expect(JSON.stringify(fixture)).toBe(before);
    expect(result.state.materials).toMatchObject({ blaze_rod: 0, blaze_powder: 0, ender_pearl: 0, ender_eye: 12 });
    expect(result.state.tickets).toBe(fixture.tickets);
    expect(result.state.playerHp).toBe(fixture.playerHp);
    expect(result.state.equipped).toEqual(fixture.equipped);
    expect(finishLabCraft(result.state).state).toBe(result.state);
  });
  it("does not replace partial manual crafts when completing the remainder", () => {
    const powder = MINING_RECIPES.find((r) => r.id === "blaze_powder_batch")!;
    const eye = MINING_RECIPES.find((r) => r.id === "ender_eye_craft")!;
    let fixture = journeyLabStepSeed("craft");
    fixture = tryCraft(fixture, powder).state;
    fixture = tryCraft(fixture, eye).state;
    expect(fixture.materials.ender_eye).toBe(1);
    const transition = journeyLabNext("craft", fixture);
    expect(transition.step).toBe("search");
    expect(transition.state).toBe(fixture);
    expect(topUpLabMaterials(fixture)).toBe(fixture);
    const result = finishLabCraft(fixture);
    expect(result.state.materials.ender_eye).toBe(12);
    expect(result.state.materials.blaze_rod).toBe(0);
    expect(result.state.materials.ender_pearl).toBe(0);
  });
  it("does not overfill or duplicate already inserted eyes", () => {
    const fixture = journeyLabSeed("portal");
    expect(topUpLabMaterials(fixture)).toBe(fixture);
    expect(finishLabCraft(fixture).state).toBe(fixture);
    expect(fixture.endQuest?.eyes).toBe(9);
    expect(fixture.materials.ender_eye).toBe(3);
    expect(fixture.lastSelectedGacha).toBe("end_portal");
    const missing = { ...fixture, materials: {} };
    const topped = topUpLabMaterials(missing);
    expect(topped.materials).toEqual({ blaze_rod: 2, ender_pearl: 3 });
    const completed = finishLabCraft(missing);
    expect(completed.state.materials.ender_eye).toBe(3);
    expect(completed.state.materials.blaze_powder).toBe(1);
    expect(completed.state.endQuest?.eyes).toBe(9);
    expect(topUpLabMaterials(completed.state)).toBe(completed.state);
  });
  it("does not reduce excess inventory or alter equipment/exploration when topping up", () => {
    const fixture = { ...journeyLabSeed("hunt"), materials: { blaze_rod: 20, ender_pearl: 30, diamond: 2 } };
    const result = topUpLabMaterials(fixture);
    expect(result).toBe(fixture);
    expect(result.endQuest).toBe(fixture.endQuest);
    expect(result.equipped).toBe(fixture.equipped);
  });
  it("fails atomically if a prerequisite is missing, without granting partial materials", () => {
    const fixture = { ...journeyLabStepSeed("craft"), crafted: {} };
    const result = finishLabCraft(fixture);
    expect(result.error).toBeTruthy();
    expect(result.state).toBe(fixture);
    expect(journeyLabNext("craft", fixture).error).toBeTruthy();
  });
});

describe("sequential confirmation keeps progression after crafting", () => {
  it("walks all six steps, preserving crafted eyes, discoveries, inserted eyes and battle state", () => {
    const start = journeyLabStepSeed("blaze");
    let next = journeyLabNext("blaze", start);
    expect(next.step).toBe("forest");
    next = journeyLabNext("forest", addLastLabRod(next.state));
    expect(next.step).toBe("enderman");
    next = journeyLabNext("enderman", next.state);
    expect(next.step).toBe("craft");
    next = journeyLabNext("craft", finishLabCraft(next.state).state);
    expect(next.step).toBe("search");
    expect(journeyLabNext("search", next.state).error).toBeTruthy();
    let state = equipHeld(next.state, "ender_eye");
    for (let i = 0; i < 5; i++) state = applyEndQuestOnVisit(state, state.endQuest!.mark!, () => 0).state;
    const found = state.endQuest;
    next = journeyLabNext("search", state);
    expect(next.step).toBe("portal");
    expect(next.state.endQuest).toBe(found);
    expect(next.state.lastSelectedGacha).toBe("end_portal");
    state = next.state;
    for (let i = 0; i < 12; i++) state = insertPortalEye(state).state;
    state = unlockTheEnd(state).state;
    expect(state.endQuest?.theEndUnlocked).toBe(true);
    expect(state.materials.ender_eye).toBe(0);
    expect(state.tickets).toBe(12);
    expect(state.playerHp).toBe(20);
    expect(state.combatEncounters).toEqual(start.combatEncounters);
    expect(state.dragonFight).toEqual(start.dragonFight);
    expect(journeyLabNext("portal", state).state).toBe(state);
  });
});
