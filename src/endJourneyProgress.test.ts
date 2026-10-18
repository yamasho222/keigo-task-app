import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { equipHeld, exchangePointsForMaterial, refreshUnlocks, resolveDig, tryCraft } from "./miningProgress";
import { applyEndQuestOnVisit, emptyEndQuest, insertPortalEye, noteEndQuestVisit, prepareEndSearch, unlockTheEnd } from "./endChapter";
import { emptyMiningState, normalizeMiningState, type MiningState, type GachaId } from "./miningTypes";
import { MINING_RECIPES } from "./miningRecipes";
import { syncEndJourney } from "./endJourneyProgress";
import { endJourneyGuide } from "./endJourneyGuide";
import { EndJourneyGuide, EndArrival } from "./EndJourneyGuidePanel";
import { EndPortalPanel } from "./EndPortalPanel";
import { rebaseMiningWrite } from "./miningCommit";
import { detectProgressNudge, recipeEffectLine, recommendedCraftRecipeIds } from "./miningUiHelpers";

const places: GachaId[] = ["wood", "farm", "ranch", "stone", "iron", "coal", "gold", "diamond", "lapis_cave", "nether", "bastion", "fortress", "warped_forest"];
function state(patch: Partial<MiningState> = {}): MiningState {
  return { ...emptyMiningState(), tickets: 10, crafted: { workbench: true, sword_diamond: true, axe_diamond: true, pickaxe_diamond: true }, unlockedGachas: places, endQuest: emptyEndQuest(), ...patch };
}
const powder = MINING_RECIPES.find((r) => r.id === "blaze_powder_batch")!;
const eye = MINING_RECIPES.find((r) => r.id === "ender_eye_craft")!;

describe("cumulative progression without inventory grants", () => {
  it("crafting every rod immediately still unlocks the forest on the fourth acquisition", () => {
    let s = refreshUnlocks(state({ unlockedGachas: ["wood", "fortress"] }));
    for (let i = 1; i <= 4; i++) {
      s = refreshUnlocks({ ...s, materials: { ...s.materials, blaze_rod: 1 } });
      expect(s.endJourney?.rodsAcquired).toBe(i);
      s = tryCraft(s, powder).state;
      expect(s.materials.blaze_rod).toBe(0);
      expect(s.unlockedGachas.includes("warped_forest")).toBe(i === 4);
      s = refreshUnlocks(normalizeMiningState(JSON.parse(JSON.stringify(s))));
      expect(s.endJourney?.rodsAcquired).toBe(i);
    }
    expect(s.materials.blaze_powder).toBe(8);
    expect(s.tickets).toBe(10);
    expect(refreshUnlocks(s)).toBe(s);
  });
  it("legacy powders, eyes and inserted eyes restore only an evidence-backed minimum", () => {
    const s = refreshUnlocks(state({ unlockedGachas: ["wood", "fortress"], materials: { blaze_powder: 3, ender_eye: 2 }, endQuest: { ...emptyEndQuest(), eyes: 3 } }));
    expect(s.endJourney?.rodsAcquired).toBe(4);
    expect(s.unlockedGachas).toContain("warped_forest");
    expect(s.materials).toEqual({ blaze_powder: 3, ender_eye: 2 });
    expect(s.endQuest?.eyes).toBe(3);
  });
  it("three old rods converted to powder do not pretend to be four", () => {
    const s = refreshUnlocks(state({ unlockedGachas: ["wood", "fortress"], materials: { blaze_powder: 6 } }));
    expect(s.endJourney?.rodsAcquired).toBe(3);
    expect(s.unlockedGachas).not.toContain("warped_forest");
  });
  it("exchange unlocks the fortress immediately and does not guarantee another debris", () => {
    const s = state({ miningPoints: 200, unlockedGachas: ["wood", "nether"] });
    const result = exchangePointsForMaterial(s, "ancient_debris");
    expect(result.error).toBeUndefined();
    expect(result.state.unlockedGachas).toContain("fortress");
    expect(result.state.materials.ancient_debris).toBe(1);
    expect(result.state.tickets).toBe(s.tickets);
  });
  it("existing fortress/forest unlocks and spent debris are retained", () => {
    const s = refreshUnlocks(state({ materials: {} }));
    expect(s.unlockedGachas).toContain("fortress");
    expect(s.unlockedGachas).toContain("warped_forest");
    expect(s.materials).toEqual({});
    const upgraded = refreshUnlocks(state({ unlockedGachas: ["wood"], crafted: { sword_netherite: true } }));
    expect(upgraded.unlockedGachas).toContain("fortress");
  });
  it("sanitizes malformed acquisition data and is stable over repeated refreshes", () => {
    const s = normalizeMiningState({ ...state(), materials: { blaze_powder: 8 }, endJourney: { rodsAcquired: "bad" } });
    const next = refreshUnlocks(s);
    expect(next.endJourney?.rodsAcquired).toBe(4);
    expect(refreshUnlocks(next)).toBe(next);
  });
});

describe("five-mark route and migration", () => {
  it("equipping reveals the first mark without spending anything; unequip/re-equip never rerolls", () => {
    const before = state({ tickets: 0, materials: { ender_eye: 1 } });
    const s = equipHeld(before, "ender_eye");
    expect(s.endQuest?.mark).toBeTruthy();
    expect(s.tickets).toBe(0);
    expect(s.materials.ender_eye).toBe(1);
    const again = equipHeld(equipHeld(s, null), "ender_eye");
    expect(again.endQuest?.mark).toBe(s.endQuest?.mark);
  });
  it("exactly five paid mining actions find the portal; zero extra eye or visit action", () => {
    let s = equipHeld(state({ materials: { ender_eye: 12 } }), "ender_eye");
    const seen: GachaId[] = [];
    for (let i = 0; i < 5; i++) {
      const mark = s.endQuest!.mark!;
      seen.push(mark);
      const result = resolveDig({ state: s, gacha: mark, toolKind: "pickaxe", dateKey: "2026-10-17", rand: () => .99 });
      if ("error" in result) throw new Error(result.error);
      s = result.state;
    }
    expect(s.endQuest?.foundPortal).toBe(true);
    expect(s.unlockedGachas).toContain("end_portal");
    expect(s.tickets).toBe(5);
    expect(s.materials.ender_eye).toBe(12);
    expect(new Set(seen).size).toBe(5);
    expect(["stone", "coal", "iron", "gold", "diamond", "lapis_cave"]).toContain(seen[4]);
  });
  it.each(["fortress", "warped_forest", "the_end", "end_portal", "bastion"] as const)("never advances exploration in %s", (place) => {
    const s = equipHeld(state({ materials: { ender_eye: 1 } }), "ender_eye");
    expect(applyEndQuestOnVisit(s, place).state).toBe(s);
  });
  it("wrong destinations do not consume/reset any search progress", () => {
    const s = equipHeld(state({ materials: { ender_eye: 1 } }), "ender_eye");
    expect(applyEndQuestOnVisit(s, "gold").state).toBe(s);
  });
  it("old two-stop saves keep both stops and need only three more stops", () => {
    const old = state({ materials: { ender_eye: 1 }, endQuest: { ...emptyEndQuest(), routeVersion: undefined, visited: ["farm", "ranch"], mark: "fortress" } });
    let s = equipHeld(old, "ender_eye");
    expect(s.endQuest?.visited).toEqual(["farm", "ranch"]);
    for (let i = 0; i < 3; i++) {
      expect(s.endQuest?.foundPortal).toBe(false);
      if (i === 2) expect(["stone", "iron", "coal", "gold", "diamond", "lapis_cave"]).toContain(s.endQuest?.mark);
      s = applyEndQuestOnVisit(s, s.endQuest!.mark!, () => 0).state;
    }
    expect(s.endQuest?.foundPortal).toBe(true);
  });
  it("old four-stop/fifth streak becomes discovery, preserving inventory/tickets/inserted eyes", () => {
    const old = state({ materials: { ender_eye: 4 }, endQuest: { ...emptyEndQuest(), routeVersion: undefined, visited: ["wood", "farm", "ranch", "nether"], fifth: "fortress", fifthStreak: 1, mark: "fortress" } });
    const s = refreshUnlocks(normalizeMiningState(old));
    expect(s.endQuest?.foundPortal).toBe(true);
    expect(s.endQuest?.visited).toEqual(old.endQuest?.visited);
    expect(s.endQuest?.mark).toBeNull();
    expect(s.unlockedGachas).toContain("end_portal");
    expect(s.tickets).toBe(old.tickets);
    expect(s.materials).toEqual(old.materials);
  });
  it("duplicate old stops never count twice; existing End unlocks never disappear", () => {
    const s = prepareEndSearch(state({ endQuest: { ...emptyEndQuest(), visited: ["wood", "wood", "farm"] } }));
    expect(s.endQuest?.foundPortal).toBe(false);
    expect(s.endQuest?.visited).toEqual(["wood", "farm"]);
    const unlocked = refreshUnlocks(state({ unlockedGachas: [...places, "the_end"] }));
    expect(unlocked.endQuest).toMatchObject({ foundPortal: true, linked: true, eyes: 12, theEndUnlocked: true });
    expect(unlocked.unlockedGachas).toContain("the_end");
  });
  it("preserves unknown future quest versions without consuming an eye", () => {
    const s = normalizeMiningState(state({ materials: { ender_eye: 1 }, endQuest: { ...emptyEndQuest(), routeVersion: 99, foundPortal: true } }));
    expect(prepareEndSearch(s)).toBe(s);
    expect(insertPortalEye(s).inserted).toBe(false);
    expect(unlockTheEnd(s).error).toBeTruthy();
  });
});

describe("free gradual hints and the next step", () => {
  it("first two genuine visits have no hint; 3/5/7 give progressively stronger visual nudges", () => {
    let s = state({ tickets: 0, materials: { ender_eye: 1 } });
    for (let n = 1; n <= 7; n++) {
      s = noteEndQuestVisit(s, `visit-${n}`, 50_000 * n);
      const guide = endJourneyGuide(s);
      if (n <= 2) expect(guide).toBeNull();
      else {
        expect(guide?.icon).toBe("ender_eye");
        expect(guide?.label).not.toMatch(/持ち物に|入れて/);
        expect(guide?.action).toEqual(n >= 5 ? { equip: true } : undefined);
      }
      expect(noteEndQuestVisit(s, `visit-${n}`, 50_000 * n + 40_000)).toBe(s);
      expect(noteEndQuestVisit(s, `spam-${n}`, 50_000 * n + 1)).toBe(s);
      expect(s.tickets).toBe(0);
    }
    expect(refreshUnlocks(normalizeMiningState(JSON.parse(JSON.stringify(s)))).endQuest?.enderEyeHintVisits).toBe(7);
  });
  it("no hints before an eye exists, after discovery, or while it is equipped", () => {
    const noEye = state();
    expect(noteEndQuestVisit(noEye, "a", 100_000).endQuest?.enderEyeHintVisits).toBe(0);
    const equipped = equipHeld(state({ materials: { ender_eye: 1 } }), "ender_eye");
    expect(noteEndQuestVisit(equipped, "a", 100_000).endQuest?.enderEyeHintVisits).toBe(0);
  });
  it("the craft effect and completion nudge do not give the answer away", () => {
    expect(recipeEffectLine(eye)).not.toMatch(/そうび|持ち物|マーク/);
    const nudge = detectProgressNudge(state(), state({ materials: { ender_eye: 1 } }));
    expect(nudge?.body).not.toMatch(/そうび|持ち物/);
  });
  it("shows one actionable ingredient/craft step, including pearl acquisition", () => {
    expect(endJourneyGuide(state({ materials: { blaze_powder: 2 } }))?.action).toEqual({ place: "warped_forest" });
    expect(endJourneyGuide(state({ materials: { blaze_rod: 1 } }))?.action).toEqual({ recipe: "blaze_powder_batch" });
    expect(endJourneyGuide(state({ materials: { blaze_powder: 1, ender_pearl: 1 } }))?.action).toEqual({ recipe: "ender_eye_craft" });
    // Optional enchanting/smithing/netherite crafts must not hide the journey's recipes.
    expect(recommendedCraftRecipeIds(state({ materials: { blaze_rod: 1 } }))[0]).toBe("blaze_powder_batch");
    expect(recommendedCraftRecipeIds(state({ materials: { blaze_powder: 1, ender_pearl: 1 } }))[0]).toBe("ender_eye_craft");
  });
});

describe("portal, arrival and concurrent writes", () => {
  it("six rods and twelve pearls are sufficient: craft, search, insert, enter without an extra eye", () => {
    let s = state({ materials: { blaze_rod: 6, ender_pearl: 12 } });
    s = tryCraft(s, powder, { times: 6 }).state;
    s = tryCraft(s, eye, { times: 12 }).state;
    s = equipHeld(s, "ender_eye");
    for (let i = 0; i < 5; i++) s = applyEndQuestOnVisit(s, s.endQuest!.mark!, () => 0).state;
    for (let i = 0; i < 12; i++) s = insertPortalEye(s).state;
    expect(s.materials.ender_eye).toBe(0);
    expect(s.materials.blaze_rod).toBe(0);
    expect(s.materials.ender_pearl).toBe(0);
    const before = s;
    s = unlockTheEnd(s).state;
    expect(s.tickets).toBe(before.tickets);
    expect(s.dragonFight).toEqual(before.dragonFight);
    expect(s.playerHp).toBe(before.playerHp);
    expect(s.endQuest).toMatchObject({ foundPortal: true, eyes: 12, linked: true, theEndUnlocked: true });
  });
  it("unrelated delayed writes do not overwrite a completed quest or new unlocks", () => {
    const before = refreshUnlocks(state({ endQuest: { ...emptyEndQuest(), foundPortal: true }, materials: { ender_eye: 2 } }));
    const latest = insertPortalEye(before).state;
    const merged = rebaseMiningWrite(latest, before, { ...before, tickets: before.tickets + 1 });
    expect(merged.endQuest?.eyes).toBe(1);
    expect(merged.materials.ender_eye).toBe(1);
    expect(merged.tickets).toBe(11);
    expect(merged.unlockedGachas).toContain("end_portal");
  });
  it("stale insertion/search results do not consume twice", () => {
    const before = state({ endQuest: { ...emptyEndQuest(), foundPortal: true }, materials: { ender_eye: 1 } });
    const written = insertPortalEye(before).state;
    const latest = { ...written, tickets: 12 };
    expect(rebaseMiningWrite(latest, before, written)).toBe(latest);
  });
  it("a delayed hint-only write cannot rewind a newer search route", () => {
    const before = equipHeld(state({ materials: { ender_eye: 1 } }), "ender_eye");
    const latest = applyEndQuestOnVisit(before, before.endQuest!.mark!).state;
    const hintOnly = { ...before, endQuest: { ...before.endQuest!, enderEyeHintVisits: 3 } };
    const merged = rebaseMiningWrite(latest, before, hintOnly);
    expect(merged.endQuest?.visited).toEqual(latest.endQuest?.visited);
    expect(merged.endQuest?.mark).toBe(latest.endQuest?.mark);
    expect(merged.endQuest?.enderEyeHintVisits).toBe(3);
  });
  it("concurrent rod acquisition credits both without counting a reload", () => {
    const before = syncEndJourney(state({ unlockedGachas: ["wood", "fortress"] }));
    const one = refreshUnlocks({ ...before, materials: { blaze_rod: 1 } });
    const merged = rebaseMiningWrite({ ...one }, before, one);
    expect(merged.materials.blaze_rod).toBe(2);
    expect(merged.endJourney?.rodsAcquired).toBe(2);
    expect(refreshUnlocks(merged).endJourney?.rodsAcquired).toBe(2);
  });
  it("renders five search marks, twelve tappable frames, and an explicit arrival decision", () => {
    const guide = endJourneyGuide(equipHeld(state({ materials: { ender_eye: 1 } }), "ender_eye"))!;
    expect(renderToStaticMarkup(createElement(EndJourneyGuide, { guide, onAction() {} }))).toContain('aria-label="探索 0/5"');
    const panel = renderToStaticMarkup(createElement(EndPortalPanel, { mining: state({ endQuest: { ...emptyEndQuest(), foundPortal: true, eyes: 3 } }), shaking: false, insertPulse: 1, onInsert() {}, onUnlockTheEnd() {} }));
    expect(panel.match(/class="end-portal-slot/g)).toHaveLength(12);
    expect(panel.match(/end-portal-slot is-filled/g)).toHaveLength(3);
    expect(panel.match(/アイをはめる 枠/g)).toHaveLength(9);
    const arrival = renderToStaticMarkup(createElement(EndArrival, { onFight() {}, onBack() {} }));
    expect(arrival).toContain("ジ・エンドについた！");
    expect(arrival).toContain("いまはもどる");
  });
});
