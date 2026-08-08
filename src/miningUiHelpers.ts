import {
  diamondToolsComplete,
  hasWorkbench,
  ironFullComplete,
  netheriteFullComplete,
  stoneToolsComplete,
  woodToolsComplete,
} from "./miningProgress";
import type { MiningState } from "./miningTypes";

/** 上部に出す「つぎの目標」1行 */
export function miningNextGoal(mining: MiningState): string {
  if (!hasWorkbench(mining)) return "つぎ: 作業台をつくろう";
  if (!woodToolsComplete(mining)) return "つぎ: 木の剣・斧・ツルハシ";
  if (!stoneToolsComplete(mining)) return "つぎ: 石の剣・斧・ツルハシ";
  if (!ironFullComplete(mining)) return "つぎ: 鉄のどうぐとよろい";
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
} {
  if (expectedExtra >= 0.7) return { label: "つよい", color: "#2E7D32" };
  if (expectedExtra >= 0.35) return { label: "ふつう", color: "#EF6C00" };
  return { label: "よわい", color: "#78909C" };
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
  if (!mining.unlockedGachas.includes("iron") || !mining.unlockedGachas.includes("gold")) {
    return {
      title: "つぎの解放: てつ・きんのこうざん",
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
        { label: "鉄のヘルメット", done: !!mining.crafted.helmet_iron },
        { label: "鉄のむねあて", done: !!mining.crafted.chest_iron },
        { label: "鉄のすねあて", done: !!mining.crafted.leggings_iron },
        { label: "鉄のブーツ", done: !!mining.crafted.boots_iron },
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
