import {
  diamondToolsComplete,
  hasBucket,
  hasEnchantingTable,
  hasFurnace,
  hasWorkbench,
  ironFullComplete,
  ironToolsComplete,
  netheriteFullComplete,
  stoneToolsComplete,
  woodToolsComplete,
} from "./miningProgress";
import { MINING_RECIPES, canAffordRecipe, type MiningRecipe, type RecipeId } from "./miningRecipes";
import type { ArmorKind, CraftedGearId, GachaId, MaterialId, MiningState } from "./miningTypes";
import {
  ARMOR_EFFECT_SHORT,
  armorTierEffectCopy,
  armorTierFromGearId,
  MATERIAL_META,
  getMaterialCount,
  parseToolId,
  partySlotCount,
  TOOL_EFFECT_BLURB,
} from "./miningTypes";

/** 上部に出す「つぎの目標」1行（互換用） */
export function miningNextGoal(mining: MiningState): string {
  return miningNextHero(mining).title;
}

export type NextHeroKind =
  | "workbench"
  | "tools"
  | "furnace_route"
  | "unlock"
  | "bed"
  | "netherite"
  | "done";

export interface NextHeroToolReq {
  id: CraftedGearId;
  label: string;
  done: boolean;
}

export type NextHighlightKind = "recipe" | "gacha" | "rocks" | "equip" | "none";

export interface NextHero {
  kind: NextHeroKind;
  title: string;
  subtitle?: string;
  tools?: NextHeroToolReq[];
  doneCount?: number;
  totalCount?: number;
  jumpTab?: "craft" | "mine";
  preferredGacha?: GachaId;
  /** 到着先ハイライト */
  highlightKind?: NextHighlightKind;
  highlightRecipeId?: RecipeId;
  ctaLabel?: string;
  /** 同一提案フォールバック用キー */
  trustKey?: string;
}

function toolTrio(
  mining: MiningState,
  sword: CraftedGearId,
  axe: CraftedGearId,
  pickaxe: CraftedGearId,
  labels: [string, string, string],
): NextHeroToolReq[] {
  return [
    { id: sword, label: labels[0], done: !!mining.crafted[sword] },
    { id: axe, label: labels[1], done: !!mining.crafted[axe] },
    { id: pickaxe, label: labels[2], done: !!mining.crafted[pickaxe] },
  ];
}

/** 画面上部の「つぎの1手」ヒーロー用（短い1メッセージ） */
export function miningNextHero(mining: MiningState): NextHero {
  if (!hasWorkbench(mining)) {
    return {
      kind: "workbench",
      title: "作業台をつくろう",
      subtitle: "板材を4つでできるよ",
      jumpTab: "craft",
    };
  }
  if (!woodToolsComplete(mining)) {
    const tools = toolTrio(
      mining,
      "sword_wood",
      "axe_wood",
      "pickaxe_wood",
      ["木の剣", "木の斧", "木のツルハシ"],
    );
    const doneCount = tools.filter((t) => t.done).length;
    const next = tools.find((t) => !t.done);
    return {
      kind: "tools",
      title: next ? `${next.label}をつくろう` : "木のどうぐをそろえよう",
      subtitle: "3つで、いしのどうくつがひらくよ",
      tools,
      doneCount,
      totalCount: 3,
      jumpTab: "craft",
    };
  }
  if (!stoneToolsComplete(mining)) {
    const tools = toolTrio(
      mining,
      "sword_stone",
      "axe_stone",
      "pickaxe_stone",
      ["石の剣", "石の斧", "石のツルハシ"],
    );
    const doneCount = tools.filter((t) => t.done).length;
    const next = tools.find((t) => !t.done);
    return {
      kind: "tools",
      title: next ? `${next.label}をつくろう` : "石のどうぐをそろえよう",
      subtitle: "3つで、てつ・せきたん・きんがひらくよ",
      tools,
      doneCount,
      totalCount: 3,
      jumpTab: "craft",
      preferredGacha: "stone",
    };
  }
  if (!hasFurnace(mining) || !ironToolsComplete(mining)) {
    if (!hasFurnace(mining)) {
      const hasCoal = getMaterialCount(mining, "coal") > 0;
      return {
        kind: "furnace_route",
        title: hasCoal ? "かまどをつくろう" : "せきたんをほろう",
        subtitle: "つぎは せきたん→かまど→てつ",
        jumpTab: hasCoal ? "craft" : "mine",
        preferredGacha: "coal",
      };
    }
    if (!ironToolsComplete(mining)) {
      const tools = toolTrio(
        mining,
        "sword_iron",
        "axe_iron",
        "pickaxe_iron",
        ["鉄の剣", "鉄の斧", "鉄のツルハシ"],
      );
      const doneCount = tools.filter((t) => t.done).length;
      const next = tools.find((t) => !t.done);
      return {
        kind: "tools",
        title: next ? `${next.label}をつくろう` : "鉄のどうぐをそろえよう",
        subtitle: "てつをほって、かまどで精錬しよう",
        tools,
        doneCount,
        totalCount: 3,
        jumpTab: "craft",
        preferredGacha: "iron",
      };
    }
  }
  if (!hasEnchantingTable(mining)) {
    const obs = getMaterialCount(mining, "obsidian");
    const books = getMaterialCount(mining, "book");
    const dia = getMaterialCount(mining, "diamond");
    if (books < 1) {
      return {
        kind: "unlock",
        title: "本をつくろう",
        subtitle: "牧場の皮と、農場のさとうきび→紙でできるよ",
        jumpTab: "craft",
        preferredGacha: getMaterialCount(mining, "leather") < 1 ? "ranch" : "farm",
      };
    }
    if (obs < 4) {
      return {
        kind: "unlock",
        title: "黒曜石をあつめよう",
        subtitle: `水とようがんをバケツでくもう（あと黒曜石${4 - obs}）`,
        jumpTab: "mine",
        preferredGacha: "river",
      };
    }
    if (dia < 2) {
      return {
        kind: "unlock",
        title: "テーブル用のダイヤをあつめよう",
        subtitle: `しんそうで欠片をあつめよう（あとダイヤ${2 - dia}）`,
        jumpTab: "mine",
        preferredGacha: "diamond",
      };
    }
    return {
      kind: "unlock",
      title: "エンチャントテーブルをつくろう",
      subtitle: "黒曜石4・ダイヤ2・本1でできるよ",
      jumpTab: "craft",
      preferredGacha: "diamond",
    };
  }
  if (!diamondToolsComplete(mining)) {
    const tools = toolTrio(
      mining,
      "sword_diamond",
      "axe_diamond",
      "pickaxe_diamond",
      ["ダイヤの剣", "ダイヤの斧", "ダイヤのツルハシ"],
    );
    const doneCount = tools.filter((t) => t.done).length;
    const next = tools.find((t) => !t.done);
    return {
      kind: "tools",
      title: next ? `${next.label}をつくろう` : "ダイヤのどうぐをそろえよう",
      subtitle: "テーブルができたら、しんそうで欠片をあつめよう",
      tools,
      doneCount,
      totalCount: 3,
      jumpTab: "craft",
      preferredGacha: "diamond",
    };
  }
  if (!mining.unlockedGachas.includes("nether")) {
    return {
      kind: "unlock",
      title: "ネザーまであと少し",
      subtitle: "ダイヤのどうぐ3つでひらくよ",
      jumpTab: "craft",
    };
  }
  if ((mining.bedCount ?? 1) < 3) {
    return {
      kind: "bed",
      title: "ベッドでなかまをふやそう",
      subtitle: "ベッド1つで、なかまが1人ふえるよ",
      jumpTab: "craft",
    };
  }
  if (!netheriteFullComplete(mining)) {
    return {
      kind: "netherite",
      title: "ネザライトをそろえよう",
      subtitle: "残骸をほって、強化していこう",
      jumpTab: "mine",
      preferredGacha: "nether",
    };
  }
  return {
    kind: "done",
    title: "ネザライトそろい！",
    subtitle: "特典で残骸が出やすいよ",
  };
}

/**
 * つぎやること（信頼ルール付き）。
 * 材料不足なら掘りへ誘導。おすすめレシピと同一ソース。
 */
export function buildNextHero(
  mining: MiningState,
  opts?: { repeatCount?: number },
): NextHero {
  const repeatCount = opts?.repeatCount ?? 0;
  if (repeatCount >= 3) {
    return {
      kind: "done",
      title: "じゆうにほってもいいよ",
      subtitle: "すきな岩をえらんでね",
      jumpTab: "mine",
      highlightKind: "rocks",
      ctaLabel: "ほりにいく",
      trustKey: "free_dig",
    };
  }

  const base = miningNextHero(mining);
  const recIds = recommendedCraftRecipeIds(mining);
  const have = (id: MaterialId) => getMaterialCount(mining, id);

  if (base.jumpTab === "craft" && recIds.length > 0) {
    const recipe = MINING_RECIPES.find((r) => r.id === recIds[0]);
    if (recipe) {
      if (!canAffordRecipe(recipe.costs, have, recipe.fuelOptions)) {
        const missing = recipe.costs.find((c) => have(c.material) < c.amount);
        if (missing) {
          const need = missing.amount - have(missing.material);
          const gacha = gachaForMaterial(missing.material);
          const unlocked =
            gacha && mining.unlockedGachas.includes(gacha) ? gacha : base.preferredGacha;
          return {
            kind: "unlock",
            title: `${MATERIAL_META[missing.material].label}をあつめよう`,
            subtitle: `あと${need}こ（${recipe.label}用）`,
            jumpTab: "mine",
            preferredGacha: unlocked ?? undefined,
            highlightKind: unlocked ? "gacha" : "rocks",
            ctaLabel: "ほりにいく",
            trustKey: `need:${missing.material}:${need}`,
          };
        }
      }
      return {
        ...base,
        highlightKind: "recipe",
        highlightRecipeId: recipe.id,
        ctaLabel: "クラフトへ",
        trustKey: `craft:${recipe.id}`,
      };
    }
  }

  if (base.jumpTab === "mine") {
    return {
      ...base,
      highlightKind: base.preferredGacha ? "gacha" : "rocks",
      ctaLabel: "ほりにいく",
      trustKey: `mine:${base.preferredGacha ?? "any"}:${base.title}`,
    };
  }

  return {
    ...base,
    highlightKind: "none",
    ctaLabel: base.jumpTab === "craft" ? "クラフトへ" : "つぎへ",
    trustKey: `other:${base.title}`,
  };
}

/**
 * クラフトタブ「おすすめ」に出すレシピID（進行順）。
 * いまの目標に直結するものを先頭にする（ベッドを常時先頭にしない）。
 */
export function recommendedCraftRecipeIds(mining: MiningState): RecipeId[] {
  const ids: RecipeId[] = [];
  const push = (id: RecipeId) => {
    if (!ids.includes(id)) ids.push(id);
  };
  const planks = getMaterialCount(mining, "plank");
  const sticks = getMaterialCount(mining, "stick");
  const logs = getMaterialCount(mining, "log");

  if (!hasWorkbench(mining)) {
    if (planks < 4) {
      if (logs < 1 && planks < 1) {
        // 原木すらない場合も板材レシピを案内（ほる導線付き）
      }
      push("plank_batch");
    }
    push("workbench");
    return ids;
  }

  if (!woodToolsComplete(mining)) {
    const missing = (
      [
        "sword_wood",
        "axe_wood",
        "pickaxe_wood",
      ] as const
    ).filter((id) => !mining.crafted[id]);
    // どうぐには棒が必要（作業台には不要）
    const stickNeed = missing.reduce((n, id) => n + (id.startsWith("sword_") ? 1 : 2), 0);
    if (sticks < Math.min(2, stickNeed) && missing.length > 0) {
      if (planks < 2) push("plank_batch");
      push("stick_batch");
    }
    for (const id of missing) push(id);
    return ids;
  }

  if (!stoneToolsComplete(mining)) {
    const missing = (
      [
        "sword_stone",
        "axe_stone",
        "pickaxe_stone",
      ] as const
    ).filter((id) => !mining.crafted[id]);
    if (sticks < 2 && missing.length > 0) push("stick_batch");
    for (const id of missing) push(id);
    return ids;
  }

  if (!hasFurnace(mining)) {
    push("furnace");
    return ids;
  }

  if (!ironToolsComplete(mining)) {
    const missing = (
      [
        "sword_iron",
        "axe_iron",
        "pickaxe_iron",
      ] as const
    ).filter((id) => !mining.crafted[id]);
    if (getMaterialCount(mining, "iron_ingot") < 3 && getMaterialCount(mining, "iron_ore") > 0) {
      push("smelt_iron");
    }
    if (sticks < 2 && missing.length > 0) push("stick_batch");
    for (const id of missing) push(id);
    return ids;
  }

  if (!hasEnchantingTable(mining)) {
    if (!hasBucket(mining)) push("bucket_iron");
    const books = getMaterialCount(mining, "book");
    const paper = getMaterialCount(mining, "paper");
    const obs = getMaterialCount(mining, "obsidian");
    const dia = getMaterialCount(mining, "diamond");
    if (books < 1) {
      if (paper < 3) push("paper_batch");
      push("book_craft");
    }
    if (obs < 4) push("obsidian_craft");
    if (dia < 2 && getMaterialCount(mining, "diamond_shard") >= 9) {
      push("diamond_from_shards");
    }
    push("enchanting_table");
    return ids;
  }

  if (!diamondToolsComplete(mining)) {
    const missing = (
      [
        "sword_diamond",
        "axe_diamond",
        "pickaxe_diamond",
      ] as const
    ).filter((id) => !mining.crafted[id]);
    if (getMaterialCount(mining, "diamond") < 3
      && getMaterialCount(mining, "diamond_shard") >= 9) {
      push("diamond_from_shards");
    }
    if (sticks < 2 && missing.length > 0) push("stick_batch");
    for (const id of missing) push(id);
    return ids;
  }

  if ((mining.bedCount ?? 1) < 3) {
    push("bed");
  }

  if (!netheriteFullComplete(mining)) {
    if (getMaterialCount(mining, "netherite_scrap") < 4
      && getMaterialCount(mining, "ancient_debris") > 0) {
      push("smelt_debris");
    }
    if (getMaterialCount(mining, "netherite_ingot") < 1
      && getMaterialCount(mining, "netherite_scrap") >= 4) {
      push("netherite_ingot_craft");
    }
  }

  return ids;
}

function parseArmorKind(id: CraftedGearId): ArmorKind | null {
  const m = /^(helmet|chest|leggings|boots)_/.exec(id);
  return m ? (m[1] as ArmorKind) : null;
}

/** クラフトカードに出す効果・役割の一言 */
export function recipeEffectLine(recipe: MiningRecipe): string | null {
  if (recipe.id === "plank_batch") return "作業台やどうぐの材料";
  if (recipe.id === "stick_batch") return "どうぐの取っ手（作業台にはいらない）";
  if (recipe.id === "workbench") return "どうぐ・ベッド・かまどがつくれる";
  if (recipe.id === "furnace") return "てつ・きんの原石をインゴットにできる";
  if (recipe.id === "bed" || recipe.grantsBed) return "なかまが1人ふえる";
  if (recipe.id === "smelt_iron") return "鉄のどうぐ・よろいの材料";
  if (recipe.id === "smelt_gold") return "金のどうぐ・よろいの材料";
  if (recipe.id === "smelt_debris") return "ネザライトの材料";
  if (recipe.id === "netherite_ingot_craft") return "ダイヤどうぐをいちばん強くできる";
  if (recipe.id === "diamond_from_shards") return "ダイヤどうぐの材料";
  if (recipe.id === "paper_batch") return "本の材料（さとうきび3で紙3）";
  if (recipe.id === "book_craft") return "エンチャントテーブルの材料";
  if (recipe.id === "obsidian_craft") return "水＋ようがんでテーブルの材料";
  if (recipe.craftFlag === "bucket_iron") return "うみとようがんで液体をくめる";
  if (recipe.craftFlag === "enchanting_table") return "まほうとダイヤどうぐがひらく";
  if (recipe.craftFlag) {
    const tool = parseToolId(recipe.craftFlag);
    if (tool) return TOOL_EFFECT_BLURB[tool.kind];
    const armor = parseArmorKind(recipe.craftFlag);
    if (armor) {
      const tier = armorTierFromGearId(recipe.craftFlag);
      return tier ? armorTierEffectCopy(armor, tier) : ARMOR_EFFECT_SHORT[armor];
    }
  }
  return null;
}

/** クラフトタブ上部の手順案内（ヒーローと役割分担：ここでは手順だけ短く） */
export function craftTutorialBanner(mining: MiningState): {
  title: string;
  steps: string[];
  tip?: string;
} {
  if (!hasWorkbench(mining)) {
    const planks = getMaterialCount(mining, "plank");
    return {
      title: "いまやること：作業台",
      steps: planks < 4
        ? ["もりで原木→板材→作業台"]
        : ["下のおすすめから作業台をつくる"],
      tip: "棒はあとでどうぐ用",
    };
  }
  if (!woodToolsComplete(mining)) {
    return {
      title: "いまやること：木のどうぐ3つ",
      steps: ["棒→剣・斧・ツルハシをそろえる"],
      tip: "場所に合うどうぐがつよいよ",
    };
  }
  if (!stoneToolsComplete(mining)) {
    return {
      title: "いまやること：石のどうぐ3つ",
      steps: ["いしのどうくつで丸石→石のどうぐ3つ"],
    };
  }
  if (!hasFurnace(mining)) {
    return {
      title: "いまやること：かまど",
      steps: ["せきたん→かまど→てつを精錬"],
      tip: "きんはあとでOK",
    };
  }
  if (!ironToolsComplete(mining)) {
    return {
      title: "いまやること：鉄のどうぐ",
      steps: ["てつをほる→インゴット→どうぐ3つ"],
    };
  }
  if (!hasEnchantingTable(mining)) {
    return {
      title: "いまやること：エンチャントテーブル",
      steps: ["本・黒曜石・ダイヤ2でテーブル→まほうがつかえる"],
      tip: "農場・牧場・うみ・ようがんで材料をあつめよう",
    };
  }
  if (!diamondToolsComplete(mining)) {
    return {
      title: "いまやること：ダイヤ",
      steps: ["しんそうで欠片→ダイヤ→どうぐ3つ（テーブルひつよう）"],
    };
  }
  if ((mining.bedCount ?? 1) < 3) {
    return {
      title: "いまやること：ベッド",
      steps: ["牧場で羊毛→ベッド（なかま+1）"],
    };
  }
  if (!netheriteFullComplete(mining)) {
    return {
      title: "いまやること：ネザライト",
      steps: ["残骸→かまどで精錬→強化"],
    };
  }
  return {
    title: "ぜんぶそろった！",
    steps: ["すきな場所をほっていいよ"],
  };
}

export type ProgressNudgeAction = "party" | "equip" | "craft" | "mine" | "dismiss";

export interface ProgressNudge {
  id: string;
  title: string;
  body: string;
  actionLabel: string;
  action: ProgressNudgeAction;
}

function craftedArmorKinds(state: MiningState): number {
  let n = 0;
  for (const slot of ["helmet", "chest", "leggings", "boots"] as const) {
    if (Object.keys(state.crafted).some((k) => k.startsWith(`${slot}_`) && state.crafted[k as CraftedGearId])) {
      n += 1;
    }
  }
  return n;
}

function craftedToolCount(state: MiningState): number {
  return Object.keys(state.crafted).filter(
    (k) => /^(sword|axe|pickaxe)_/.test(k) && state.crafted[k as CraftedGearId],
  ).length;
}

/**
 * クラフト／解放などのトリガー直後に出す「つぎ何する？」案内。
 * いちばん優先度の高いもの1件だけ返す。
 */
export function detectProgressNudge(
  before: MiningState,
  after: MiningState,
): ProgressNudge | null {
  const slotsBefore = partySlotCount(before);
  const slotsAfter = partySlotCount(after);
  if (slotsAfter > slotsBefore) {
    return {
      id: `party-slot-${slotsAfter}`,
      title: "ベッドできた！",
      body: `なかまが${slotsAfter}人までふえたよ。パーティに入れよう`,
      actionLabel: "パーティをひらく",
      action: "party",
    };
  }

  if (!before.crafted.workbench && after.crafted.workbench) {
    return {
      id: "after-workbench",
      title: "つぎは木のどうぐ",
      body: "剣・斧・ツルハシを3つそろえよう",
      actionLabel: "クラフトをみる",
      action: "craft",
    };
  }

  if (!before.crafted.furnace && after.crafted.furnace) {
    return {
      id: "after-furnace",
      title: "てつを精錬しよう",
      body: "てつをほって、かまどでインゴットにしよう",
      actionLabel: "ほりにいく",
      action: "mine",
    };
  }

  if (craftedArmorKinds(before) === 0 && craftedArmorKinds(after) > 0) {
    return {
      id: "first-armor",
      title: "ぼうぐをそうびしよう",
      body: "「パーティ・そうび」からつけられるよ",
      actionLabel: "そうびをひらく",
      action: "equip",
    };
  }

  if (craftedToolCount(before) === 0 && craftedToolCount(after) > 0) {
    return {
      id: "first-tool",
      title: "どうぐできた！",
      body: "ほるタブで種類を選ぶと、いちばん強いのを使うよ",
      actionLabel: "ほりにいく",
      action: "mine",
    };
  }

  if (!woodToolsComplete(before) && woodToolsComplete(after)) {
    return {
      id: "wood-tools-done",
      title: "いしのどうくつ ひらいた！",
      body: "ほるタブで選んで、丸石をあつめよう",
      actionLabel: "ほりにいく",
      action: "mine",
    };
  }

  if (!stoneToolsComplete(before) && stoneToolsComplete(after)) {
    return {
      id: "stone-tools-done",
      title: "てつルート ひらいた！",
      body: "せきたん→かまど→てつ のじゅんばんがおすすめ",
      actionLabel: "ほりにいく",
      action: "mine",
    };
  }

  if (!ironToolsComplete(before) && ironToolsComplete(after)) {
    return {
      id: "iron-tools-done",
      title: "ダイヤのしんそう ひらいた！",
      body: "欠片が9つでダイヤになるよ",
      actionLabel: "ほりにいく",
      action: "mine",
    };
  }

  if (!diamondToolsComplete(before) && diamondToolsComplete(after)) {
    return {
      id: "diamond-tools-done",
      title: "ネザーへ行ける！",
      body: "残骸をさがして、ネザライトをめざそう",
      actionLabel: "ほりにいく",
      action: "mine",
    };
  }

  return null;
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
      title: "つぎにひらく: いしのどうくつ",
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
      title: "つぎにひらく: てつ・きん・せきたん",
      requirements: [
        { label: "石の剣", done: !!mining.crafted.sword_stone },
        { label: "石の斧", done: !!mining.crafted.axe_stone },
        { label: "石のツルハシ", done: !!mining.crafted.pickaxe_stone },
      ],
    };
  }
  if (!mining.unlockedGachas.includes("diamond")) {
    return {
      title: "つぎにひらく: ダイヤのしんそう",
      requirements: [
        { label: "鉄の剣", done: !!mining.crafted.sword_iron },
        { label: "鉄の斧", done: !!mining.crafted.axe_iron },
        { label: "鉄のツルハシ", done: !!mining.crafted.pickaxe_iron },
      ],
    };
  }
  if (!mining.unlockedGachas.includes("nether")) {
    return {
      title: "つぎにひらく: ネザー",
      requirements: [
        { label: "ダイヤの剣", done: !!mining.crafted.sword_diamond },
        { label: "ダイヤの斧", done: !!mining.crafted.axe_diamond },
        { label: "ダイヤのツルハシ", done: !!mining.crafted.pickaxe_diamond },
      ],
    };
  }
  return null;
}

/** 石どうぐ直後〜鉄どうぐ完成前の推奨ルート案内 */
export function showIronRouteGuide(mining: MiningState): boolean {
  return stoneToolsComplete(mining) && !ironToolsComplete(mining);
}

/** 不足素材→主にほる場所 */
export function gachaForMaterial(id: MaterialId): GachaId | null {
  switch (id) {
    case "log":
    case "stick":
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
    case "leather":
    case "wool":
      return "ranch";
    case "sugar_cane":
      return "farm";
    case "water":
      return "river";
    case "lava":
      return "lava_cave";
    case "lapis":
      return "lapis_cave";
    case "paper":
    case "book":
    case "obsidian":
      return null;
    default:
      return null;
  }
}

/** ほりばカードの地表色（選択中のランドマーク） */
export const GACHA_SURFACE: Record<GachaId, string> = {
  wood: "#E8F5E9",
  farm: "#F1F8E9",
  ranch: "#FFF3E0",
  stone: "#ECEFF1",
  river: "#E1F5FE",
  iron: "#E3F2FD",
  coal: "#EFEBE9",
  gold: "#FFF8E1",
  lava_cave: "#FBE9E7",
  diamond: "#E0F7FA",
  lapis_cave: "#E8EAF6",
  nether: "#FBE9E7",
};

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

export interface ChapterMoment {
  id: string;
  title: string;
  sub: string;
}

/** クラフト／掘り後に出す章クリア・中間祝福 */
export function detectChapterMoments(before: MiningState, after: MiningState): ChapterMoment[] {
  const moments: ChapterMoment[] = [];
  const pushed = new Set<string>();
  const push = (m: ChapterMoment) => {
    if (pushed.has(m.id)) return;
    pushed.add(m.id);
    moments.push(m);
  };

  if (!woodToolsComplete(before) && woodToolsComplete(after)) {
    push({ id: "wood_age", title: "きのじだい クリア！", sub: "農場と牧場、いしのどうくつがひらいたよ" });
  }
  if (!stoneToolsComplete(before) && stoneToolsComplete(after)) {
    push({ id: "stone_age", title: "いしのじだい クリア！", sub: "てつ・せきたん・きん・うみへいこう" });
  }
  if (!ironToolsComplete(before) && ironToolsComplete(after)) {
    push({
      id: "iron_tools",
      title: "てつのどうぐ 完成！",
      sub: "ようがん・しんそう・ラピスがひらいたよ",
    });
  }
  if (!ironFullComplete(before) && ironFullComplete(after)) {
    push({ id: "iron_full", title: "てつよろい そろい！", sub: "ぼうぐもそろったね" });
  }
  if (!hasEnchantingTable(before) && hasEnchantingTable(after)) {
    push({
      id: "enchant_table",
      title: "エンチャントテーブル！",
      sub: "まほうがかけられるよ。ダイヤどうぐもつくれる！",
    });
  }
  if (!diamondToolsComplete(before) && diamondToolsComplete(after)) {
    push({ id: "diamond_age", title: "ダイヤのじだい！", sub: "ネザーがひらいたよ" });
  }
  if (!netheriteFullComplete(before) && netheriteFullComplete(after)) {
    push({ id: "netherite_full", title: "ネザライト そろい！", sub: "いちばんつよいセット！" });
  }

  if (
    getMaterialCount(before, "ancient_debris") < 1
    && getMaterialCount(after, "ancient_debris") >= 1
  ) {
    push({ id: "first_debris", title: "古代の残骸 はじめて！", sub: "ネザライトへのはじめのいっぽ" });
  }
  if (
    getMaterialCount(before, "netherite_scrap") < 1
    && getMaterialCount(after, "netherite_scrap") >= 1
  ) {
    push({ id: "netherite_scrap", title: "ネザライトの欠片！", sub: "インゴットまであと少し" });
  }
  if (
    getMaterialCount(before, "netherite_ingot") < 1
    && getMaterialCount(after, "netherite_ingot") >= 1
  ) {
    push({ id: "netherite_ingot", title: "ネザライトインゴット！", sub: "どうぐを強くしよう" });
  }

  return moments;
}

/** レア掘り結果のタイトル（画面いっぱい用） */
export function digRevealTitle(
  tier: "normal" | "good" | "great",
  materials: MaterialId[],
): { title: string; sub?: string } {
  if (materials.includes("ancient_debris")) {
    return { title: "古代の残骸！！", sub: "ネザーのレアだ！" };
  }
  if (materials.includes("diamond")) {
    return { title: "ダイヤゲット！", sub: "そのまま出たよ！" };
  }
  if (materials.includes("iron_ingot") || materials.includes("gold_ingot")) {
    return { title: "インゴット直！", sub: "かまどいらずで出た！" };
  }
  if (materials.includes("diamond_shard")) {
    return { title: "ダイヤのかけら！", sub: "9こでダイヤになるよ" };
  }
  if (materials.includes("wool")) {
    return { title: "羊毛ゲット！", sub: "ベッドの材料だよ" };
  }
  if (materials.includes("lapis")) {
    return { title: "ラピスゲット！", sub: "まほうのかけらだよ" };
  }
  if (materials.includes("leather")) {
    return { title: "皮ゲット！", sub: "本の材料だよ" };
  }
  if (materials.includes("sugar_cane")) {
    return { title: "さとうきび！", sub: "紙→本の材料だよ" };
  }
  if (materials.includes("lava") || materials.includes("water")) {
    return { title: "くめた！", sub: "黒曜石の材料だよ" };
  }
  if (tier === "great") return { title: "レア発見！", sub: "すごいのが出た！" };
  if (tier === "good") return { title: "いいのがでた！", sub: "ちょっといい感じ！" };
  return { title: "ほった！" };
}
