import {
  diamondToolsComplete,
  hasWorkbench,
  ironToolsComplete,
  netheriteFullComplete,
  stoneToolsComplete,
  woodToolsComplete,
} from "./miningProgress";
import type { GachaId, MaterialId, MiningState } from "./miningTypes";

/** 上部に出す「つぎの目標」1行 */
export function miningNextGoal(mining: MiningState): string {
  if (!hasWorkbench(mining)) return "つぎ: 作業台をつくろう";
  if (!woodToolsComplete(mining)) return "つぎ: 木の剣・斧・ツルハシ";
  if (!stoneToolsComplete(mining)) return "つぎ: 石の剣・斧・ツルハシ";
  if (!ironToolsComplete(mining)) return "つぎ: 鉄の剣・斧・ツルハシ";
  if (!diamondToolsComplete(mining)) return "つぎ: ダイヤのどうぐ";
  if (!mining.unlockedGachas.includes("nether")) return "つぎ: ネザー解放";
  if ((mining.bedCount ?? 1) < 3) return "つぎ: ベッドでパーティを増やそう";
  if (!netheriteFullComplete(mining)) return "つぎ: ネザライトをそろえよう";
  return "ネザライトそろい！特典で残骸が出やすいよ";
}

/** 子ども向け補正の強さ */
export function boostStrengthLabel(expectedExtra: number): {
  label: "よわい" | "ふつう" | "つよい";
  color: string;
  pips: 1 | 2 | 3;
} {
  if (expectedExtra >= 0.7) return { label: "つよい", color: "#2E7D32", pips: 3 };
  if (expectedExtra >= 0.35) return { label: "ふつう", color: "#EF6C00", pips: 2 };
  return { label: "よわい", color: "#78909C", pips: 1 };
}

export interface NextUnlockReq {
  label: string;
  done: boolean;
}

/** クラフト先頭の「つぎの解放」カード（ガチャ解放のみ） */
export function nextGachaUnlock(mining: MiningState): {
  title: string;
  requirements: NextUnlockReq[];
} | null {
  if (!mining.unlockedGachas.includes("stone")) {
    return {
      title: "つぎの解放: いしのどうくつ",
      requirements: [
        { label: "木の剣", done: !!mining.crafted.sword_wood },
        { label: "木の斧", done: !!mining.crafted.axe_wood },
        { label: "木のツルハシ", done: !!mining.crafted.pickaxe_wood },
      ],
    };
  }
  if (
    !mining.unlockedGachas.includes("iron")
    || !mining.unlockedGachas.includes("gold")
    || !mining.unlockedGachas.includes("coal")
  ) {
    return {
      title: "つぎの解放: てつ・きん・せきたん",
      requirements: [
        { label: "石の剣", done: !!mining.crafted.sword_stone },
        { label: "石の斧", done: !!mining.crafted.axe_stone },
        { label: "石のツルハシ", done: !!mining.crafted.pickaxe_stone },
      ],
    };
  }
  if (!mining.unlockedGachas.includes("diamond")) {
    return {
      title: "つぎの解放: ダイヤのしんそう",
      requirements: [
        { label: "鉄の剣", done: !!mining.crafted.sword_iron },
        { label: "鉄の斧", done: !!mining.crafted.axe_iron },
        { label: "鉄のツルハシ", done: !!mining.crafted.pickaxe_iron },
      ],
    };
  }
  if (!mining.unlockedGachas.includes("nether")) {
    return {
      title: "つぎの解放: ネザー",
      requirements: [
        { label: "ダイヤの剣", done: !!mining.crafted.sword_diamond },
        { label: "ダイヤの斧", done: !!mining.crafted.axe_diamond },
        { label: "ダイヤのツルハシ", done: !!mining.crafted.pickaxe_diamond },
      ],
    };
  }
  return null;
}

/** 不足素材→主にほる場所 */
export function gachaForMaterial(id: MaterialId): GachaId | null {
  switch (id) {
    case "log":
    case "stick":
    case "wool":
    case "plank":
      return "wood";
    case "cobble":
      return "stone";
    case "iron_ore":
    case "iron_ingot":
      return "iron";
    case "coal":
      return "coal";
    case "gold_ore":
    case "gold_ingot":
      return "gold";
    case "diamond_shard":
    case "diamond":
      return "diamond";
    case "nether_quartz":
    case "ancient_debris":
    case "netherite_scrap":
    case "netherite_ingot":
      return "nether";
    default:
      return null;
  }
}

/** ほりばカードの地表色（選択中のランドマーク） */
export const GACHA_SURFACE: Record<GachaId, string> = {
  wood: "#E8F5E9",
  stone: "#ECEFF1",
  iron: "#E3F2FD",
  coal: "#EFEBE9",
  gold: "#FFF8E1",
  diamond: "#E0F7FA",
  nether: "#FBE9E7",
};
