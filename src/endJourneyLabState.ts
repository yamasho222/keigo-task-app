/** Disposable test fixtures/shortcuts. Import only from the DEV lab, never App. */
import { emptyMiningState, normalizeMiningState, type MiningState } from "./miningTypes";
import { emptyEndQuest } from "./endChapter";
import { equipHeld, refreshUnlocks, tryCraft } from "./miningProgress";
import { MINING_RECIPES } from "./miningRecipes";

export type JourneyLabStep = "blaze" | "forest" | "enderman" | "craft" | "search" | "portal";
export type JourneyLabScenario = "debris" | "rods" | "materials" | "eye" | "hint3" | "hint5" | "hint7" | "hunt" | "portal" | "legacy";

export const JOURNEY_LAB_STEPS: { id: JourneyLabStep; label: string; title: string; detail: string }[] = [
  { id: "blaze", label: "① ブレイズ", title: "ブレイズと1回たたかう", detail: "火の玉の予告・まもる・かいふく・必殺技を確認。残りのロッド集めは②で省けます。" },
  { id: "forest", label: "② 森の解放", title: "ロッド4本で森が開くか", detail: "3本をすでに粉にした仮データです。残り1本を補充し、同時に4本持たなくても森が開くことを確認します。" },
  { id: "enderman", label: "③ エンダーマン", title: "エンダーマンと1回たたかう", detail: "ワープ・分身・装備による変化を確認。残りのパール集めは④で省けます。" },
  { id: "craft", label: "④ クラフト", title: "ロッド → 粉 → エンダーアイ", detail: "ロッド6本・パール12個を用意済み。画面で1回ずつ作るか、一括クラフトで繰り返しを省けます。" },
  { id: "search", label: "⑤ ヒント・探索", title: "アイの反応と5地点の探索", detail: "クラフトした仮データを引き継ぎます。ヒントや探索をすぐ確認したい場合は、この下の状態切替を使えます。" },
  { id: "portal", label: "⑥ ポータル", title: "12枠を埋めてジ・エンドへ", detail: "探索後の記録を引き継ぎます。12個を順に入れるか、残り3枠の状態へ切り替えて確認できます。" },
];

export function journeyLabSeed(scenario: JourneyLabScenario): MiningState {
  let state: MiningState = {
    ...emptyMiningState(), tickets: 12, miningPoints: 200,
    miningVersionNoticeSeen: true, miningRouteBranchSeen: true,
    crafted: { workbench: true, sword_diamond: true, axe_diamond: true, pickaxe_diamond: true },
    unlockedGachas: ["wood", "farm", "ranch", "stone", "iron", "coal", "gold", "river", "diamond", "lava_cave", "lapis_cave", "nether", "bastion"],
    materials: { ancient_debris: 1 }, endQuest: emptyEndQuest(),
  };
  if (scenario === "rods") state.materials = { ancient_debris: 1, blaze_powder: 6 };
  if (scenario !== "debris" && scenario !== "rods") state.unlockedGachas.push("fortress", "warped_forest");
  if (scenario === "materials") state.materials = { blaze_rod: 6, ender_pearl: 12, plank: 6, iron_ingot: 1 };
  if (["eye", "hint3", "hint5", "hint7", "hunt", "portal", "legacy"].includes(scenario)) state.materials = { ender_eye: 12 };
  if (scenario === "hint3" || scenario === "hint5" || scenario === "hint7") state.endQuest = {
    ...emptyEndQuest(), enderEyeHintVisits: scenario === "hint3" ? 2 : scenario === "hint5" ? 4 : 6,
  };
  if (scenario === "portal") {
    state.endQuest = { ...emptyEndQuest(), foundPortal: true, eyes: 9 };
    state.materials = { ender_eye: 3 };
  }
  if (scenario === "legacy") state.endQuest = {
    ...emptyEndQuest(), routeVersion: undefined, visited: ["farm", "ranch", "wood", "nether"], mark: "fortress", fifth: "fortress", fifthStreak: 1,
  };
  state = refreshUnlocks(normalizeMiningState(state));
  if (scenario === "portal" || scenario === "legacy") state = { ...state, lastSelectedGacha: "end_portal" };
  return scenario === "hunt" ? equipHeld(state, "ender_eye") : state;
}

export function journeyLabStepSeed(step: JourneyLabStep): MiningState {
  if (step === "blaze") return journeyLabSeed("debris");
  if (step === "forest") return journeyLabSeed("rods");
  if (step === "enderman") return addLastLabRod(journeyLabSeed("rods"));
  if (step === "craft") return journeyLabSeed("materials");
  const state = journeyLabSeed("eye");
  return step === "search" ? state : refreshUnlocks({ ...state, lastSelectedGacha: "end_portal", endQuest: { ...state.endQuest!, foundPortal: true } });
}

/** The fourth cumulative rod, not four rods in the bag; safe to click repeatedly. */
export function addLastLabRod(state: MiningState): MiningState {
  const current = refreshUnlocks(state);
  if ((current.endJourney?.rodsAcquired ?? 0) >= 4) return current;
  return refreshUnlocks({ ...current, materials: { ...current.materials, blaze_rod: (current.materials.blaze_rod ?? 0) + 1 } });
}

/** Top up only what is still needed for twelve eyes, including already inserted eyes. */
export function topUpLabMaterials(state: MiningState): MiningState {
  const needed = Math.max(0, 12 - (state.endQuest?.eyes ?? 0) - (state.materials.ender_eye ?? 0));
  const rods = Math.ceil(Math.max(0, needed - (state.materials.blaze_powder ?? 0)) / 2);
  const rodCount = Math.max(state.materials.blaze_rod ?? 0, rods);
  const pearls = Math.max(state.materials.ender_pearl ?? 0, needed);
  if (rodCount === (state.materials.blaze_rod ?? 0) && pearls === (state.materials.ender_pearl ?? 0)) return state;
  return refreshUnlocks({ ...state, materials: { ...state.materials, blaze_rod: rodCount, ender_pearl: pearls } });
}

/** Uses real recipe transitions; never grants finished eyes directly. All changes are atomic on error. */
export function finishLabCraft(state: MiningState): { state: MiningState; error?: string } {
  let next = topUpLabMaterials(state);
  const needed = Math.max(0, 12 - (next.endQuest?.eyes ?? 0) - (next.materials.ender_eye ?? 0));
  if (!needed) return { state };
  const batches = Math.ceil(Math.max(0, needed - (next.materials.blaze_powder ?? 0)) / 2);
  if (batches) {
    const powder = tryCraft(next, MINING_RECIPES.find((r) => r.id === "blaze_powder_batch")!, { times: batches });
    if (powder.error) return { state, error: powder.error };
    next = powder.state;
  }
  const crafted = tryCraft(next, MINING_RECIPES.find((r) => r.id === "ender_eye_craft")!, { times: needed });
  return crafted.error ? { state, error: crafted.error } : crafted;
}

export function journeyLabNext(step: JourneyLabStep, state: MiningState): { step: JourneyLabStep; state: MiningState; error?: string } {
  if (step === "blaze") return { step: "forest", state: journeyLabStepSeed("forest") };
  if (step === "forest") return state.unlockedGachas.includes("warped_forest")
    ? { step: "enderman", state } : { step, state, error: "4本目を補充して、森の解放を確認してください。" };
  if (step === "enderman") return { step: "craft", state: journeyLabStepSeed("craft") };
  if (step === "craft") return (state.materials.ender_eye ?? 0) > 0
    ? { step: "search", state } : { step, state, error: "アイを1個作るか、一括クラフトで準備してください。" };
  if (step === "search") return state.endQuest?.foundPortal
    ? { step: "portal", state: { ...state, lastSelectedGacha: "end_portal" } }
    : { step, state, error: "探索を確認するか、上の⑥でポータル用の仮データへ切り替えてください。" };
  return { step, state };
}
