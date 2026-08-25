/** まほう（エンチャント）の抽選・付与・補正 */

import {
  ENCHANT_META,
  getMaterialCount,
  writeMaterialCount,
  type EnchantId,
  type EnchantLevel,
  type EnchantTarget,
  type GearEnchant,
  type MiningState,
} from "./miningTypes";

export const ENCHANT_APPLY_COST = 9;
export const ENCHANT_REROLL_COST = 3;
export const ENCHANT_LEVEL_UP_COST: Record<2 | 3, number> = { 2: 18, 3: 36 };

const ALL_IDS = Object.keys(ENCHANT_META) as EnchantId[];

export function rollEnchantOffers(rand = Math.random): [EnchantId, EnchantId] {
  const first = weightedPick(ALL_IDS, rand);
  const rest = ALL_IDS.filter((id) => id !== first);
  const second = weightedPick(rest, rand);
  return [first, second];
}

function weightedPick(ids: EnchantId[], rand: () => number): EnchantId {
  let total = 0;
  for (const id of ids) total += ENCHANT_META[id].weight;
  let r = rand() * total;
  for (const id of ids) {
    r -= ENCHANT_META[id].weight;
    if (r <= 0) return id;
  }
  return ids[ids.length - 1];
}

export function getEnchant(
  state: MiningState,
  target: EnchantTarget,
): GearEnchant | null {
  return state.enchants[target] ?? null;
}

export function sumEnchantBonus(
  state: MiningState,
  enchantId: EnchantId,
  levelValue: (level: EnchantLevel) => number,
  digToolKind?: "sword" | "axe" | "pickaxe",
): number {
  let sum = 0;
  for (const target of Object.keys(state.enchants) as EnchantTarget[]) {
    const e = state.enchants[target];
    if (!e || e.id !== enchantId) continue;
    if (!isEnchantActive(state, target, digToolKind)) continue;
    sum += levelValue(e.level);
  }
  return sum;
}

export function isEnchantActive(
  state: MiningState,
  target: EnchantTarget,
  digToolKind?: "sword" | "axe" | "pickaxe",
): boolean {
  if (target === "sword" || target === "axe" || target === "pickaxe") {
    if (digToolKind) return digToolKind === target;
    const tool = state.equipped.tool;
    if (!tool) return false;
    return tool.startsWith(`${target}_`);
  }
  const equipped = state.equipped[target];
  return !!(equipped && state.crafted[equipped]);
}

/** こうりつ Lv → +1率 */
export function efficiencyBonus(level: EnchantLevel): number {
  return level === 1 ? 0.05 : level === 2 ? 0.1 : 0.15;
}

export function fortuneBonus(level: EnchantLevel): number {
  return level === 1 ? 0.03 : level === 2 ? 0.06 : 0.1;
}

export function refundBonus(level: EnchantLevel): number {
  return level === 1 ? 0.04 : level === 2 ? 0.08 : 0.12;
}

export function bargainStars(level: EnchantLevel): number {
  return level;
}

export function prospectBonus(level: EnchantLevel): number {
  return level === 1 ? 0.08 : level === 2 ? 0.14 : 0.2;
}

export function bonusStarChance(level: EnchantLevel): number {
  return level === 1 ? 0.08 : level === 2 ? 0.12 : 0.15;
}

export function getPendingEnchantOffers(
  state: MiningState,
  target: EnchantTarget,
): [EnchantId, EnchantId] | null {
  return state.pendingEnchantOffers?.[target] ?? null;
}

export function ensureEnchantOffers(
  state: MiningState,
  target: EnchantTarget,
  rand = Math.random,
): { state: MiningState; offers: [EnchantId, EnchantId] } {
  const existing = state.pendingEnchantOffers?.[target];
  if (existing) return { state, offers: existing };
  const offers = rollEnchantOffers(rand);
  return {
    state: {
      ...state,
      pendingEnchantOffers: { ...state.pendingEnchantOffers, [target]: offers },
    },
    offers,
  };
}

function clearPendingOffersForTarget(
  state: MiningState,
  target: EnchantTarget,
): MiningState["pendingEnchantOffers"] {
  const next = { ...state.pendingEnchantOffers };
  delete next[target];
  return next;
}

export function applyEnchant(
  state: MiningState,
  target: EnchantTarget,
  enchantId: EnchantId,
): { state: MiningState; error?: string } {
  const pay = state.firstEnchantClaimed ? ENCHANT_APPLY_COST : 0;
  if (pay > 0 && getMaterialCount(state, "lapis") < pay) {
    return { state, error: `ラピスが${pay}こひつようだよ` };
  }
  const materials = { ...state.materials };
  if (pay > 0) {
    writeMaterialCount(materials, "lapis", getMaterialCount(state, "lapis") - pay);
  }
  return {
    state: {
      ...state,
      materials,
      enchants: { ...state.enchants, [target]: { id: enchantId, level: 1 } },
      firstEnchantClaimed: true,
      pendingEnchantOffers: clearPendingOffersForTarget(state, target),
    },
  };
}

export function levelUpEnchant(
  state: MiningState,
  target: EnchantTarget,
): { state: MiningState; error?: string } {
  const cur = state.enchants[target];
  if (!cur) return { state, error: "エンチャントがついていないよ" };
  if (cur.level >= 3) return { state, error: "もうさいきょうだよ" };
  const nextLevel = (cur.level + 1) as EnchantLevel;
  const cost = ENCHANT_LEVEL_UP_COST[nextLevel as 2 | 3];
  if (getMaterialCount(state, "lapis") < cost) {
    return { state, error: `ラピスが${cost}こひつようだよ` };
  }
  const materials = { ...state.materials };
  writeMaterialCount(materials, "lapis", getMaterialCount(state, "lapis") - cost);
  return {
    state: {
      ...state,
      materials,
      enchants: { ...state.enchants, [target]: { id: cur.id, level: nextLevel } },
    },
  };
}

export function rerollEnchantOffers(
  state: MiningState,
  target: EnchantTarget,
  rand = Math.random,
): { state: MiningState; error?: string } {
  const cost = ENCHANT_REROLL_COST;
  if (getMaterialCount(state, "lapis") < cost) {
    return { state, error: `ラピスが${cost}こひつようだよ` };
  }
  const materials = { ...state.materials };
  writeMaterialCount(materials, "lapis", getMaterialCount(state, "lapis") - cost);
  const offers = rollEnchantOffers(rand);
  return {
    state: {
      ...state,
      materials,
      pendingEnchantOffers: { ...state.pendingEnchantOffers, [target]: offers },
    },
  };
}

export function enchantLevelBlurb(id: EnchantId, level: EnchantLevel): string {
  const base = ENCHANT_META[id].blurb;
  if (id === "efficiency") {
    const n = level === 1 ? "ときどき" : level === 2 ? "わりと" : "けっこう";
    return `${n}素材がもう1こ（${base}）`;
  }
  return `${base}（Lv${level}）`;
}

/** いま装備中で効いているまほう（最大5） */
export function listActiveEnchants(
  state: MiningState,
  digToolKind?: "sword" | "axe" | "pickaxe",
): { target: EnchantTarget; enchant: GearEnchant }[] {
  const out: { target: EnchantTarget; enchant: GearEnchant }[] = [];
  for (const target of Object.keys(state.enchants) as EnchantTarget[]) {
    const enchant = state.enchants[target];
    if (!enchant) continue;
    if (!isEnchantActive(state, target, digToolKind)) continue;
    out.push({ target, enchant });
  }
  return out;
}

/** 初回付与あとのデモ掘り文言 */
export function demoDigLines(id: EnchantId): { title: string; lines: string[]; highlight: string } {
  switch (id) {
    case "efficiency":
      return {
        title: "デモほり：こうりつ",
        lines: ["きほん 1", "エンチャント +1"],
        highlight: "こうりつで素材がもう1こ！",
      };
    case "fortune":
      return {
        title: "デモほり：大あたり",
        lines: ["きほん 3"],
        highlight: "大あたりで3こ出た！",
      };
    case "refund":
      return {
        title: "デモほり：もどり",
        lines: ["きほん 1", "🎫チケットがもどった！"],
        highlight: "もどりで🎫がもどった！",
      };
    case "bargain":
      return {
        title: "デモ：やすうり",
        lines: ["こうかん所でエメラルドが安くなるよ"],
        highlight: "もちもののこうかん所を見てね！",
      };
    case "prospect":
      return {
        title: "デモほり：あたり日",
        lines: ["きほん 1", "あたり日エンチャント +1"],
        highlight: "こううんのほりばで得しやすい！",
      };
    case "bonus_star":
      return {
        title: "デモほり：エメラルドおまけ",
        lines: ["きほん 1", "エメラルドおまけ +1"],
        highlight: "たまにエメラルドがもらえる！",
      };
  }
}
