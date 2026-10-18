import { enderEyeHoldHintText, ensureEndQuest, isHoldingEnderEye } from "./endChapter";
import { syncEndJourney } from "./endJourneyProgress";
import type { GachaId, MaterialId, MiningState } from "./miningTypes";
import type { RecipeId } from "./miningRecipes";

export type JourneyAction = { place: GachaId } | { recipe: RecipeId } | { equip: true };
export type JourneyGuide = { label: string; icon: MaterialId; action?: JourneyAction; hunt?: number; rods?: number; mystery?: boolean };

/** Exactly one next step, without revealing how to use the first eye. */
export function endJourneyGuide(state: MiningState): JourneyGuide | null {
  if (!state.unlockedGachas.includes("nether")) return null;
  const q = ensureEndQuest(state);
  const have = (id: MaterialId) => state.materials[id] ?? 0;
  if (q.linked || q.theEndUnlocked) return { label: "ポータルのむこうへ", icon: "ender_eye", action: { place: "end_portal" } };
  if (!state.unlockedGachas.includes("fortress")) return { label: "ふしぎな残骸をさがそう", icon: "ancient_debris", action: { place: "nether" } };
  if (!state.unlockedGachas.includes("warped_forest")) return {
    label: "ロッドをあつめよう", icon: "blaze_rod", action: { place: "fortress" }, rods: syncEndJourney(state).endJourney!.rodsAcquired,
  };
  if (q.foundPortal && have("ender_eye") > 0) return { label: "アイをはめよう", icon: "ender_eye", action: { place: "end_portal" } };
  if (!q.foundPortal && have("ender_eye") > 0) {
    if (isHoldingEnderEye(state)) return { label: "光の印をたどろう", icon: "ender_eye", hunt: q.visited.length,
      ...(q.mark ? { action: { place: q.mark } } : {}) };
    const hint = enderEyeHoldHintText(state);
    return hint ? { label: hint, icon: "ender_eye", mystery: true, ...(q.enderEyeHintVisits >= 5 ? { action: { equip: true } } : {}) } : null;
  }
  if (have("blaze_powder") > 0 && have("ender_pearl") > 0) return {
    label: "ふたつの力をあわせよう", icon: "ender_eye", action: { recipe: state.crafted.workbench ? "ender_eye_craft" : "workbench" },
  };
  if (have("blaze_powder") === 0 && have("blaze_rod") > 0) return {
    label: "ロッドをクラフトしてみよう", icon: "blaze_powder", action: { recipe: state.crafted.workbench ? "blaze_powder_batch" : "workbench" },
  };
  if (have("ender_pearl") === 0) return { label: "パールをさがそう", icon: "ender_pearl", action: { place: "warped_forest" } };
  return { label: "ロッドをあつめよう", icon: "blaze_rod", action: { place: "fortress" } };
}
