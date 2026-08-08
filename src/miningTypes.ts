/** マイクラ風採掘・クラフト — 型と定数 */

export type MaterialId =
  | "log"
  | "plank"
  | "stick"
  | "wool"
  | "cobble"
  | "iron_ore"
  | "iron_ingot"
  | "gold_ore"
  | "gold_ingot"
  | "coal"
  | "diamond_shard"
  | "diamond"
  | "ancient_debris"
  | "nether_quartz"
  | "netherite_scrap"
  | "netherite_ingot";

/** パーティ枠＝ベッド数（1〜3） */
export const MAX_BEDS = 3;
export const BED_IMAGE = "/mining/White_Bed.png";

export type GachaId = "wood" | "stone" | "iron" | "gold" | "diamond" | "nether";

export type GearSlot = "tool" | "helmet" | "chest" | "leggings" | "boots";

export type ToolKind = "sword" | "axe" | "pickaxe";

export type GearTier = "wood" | "stone" | "iron" | "gold" | "diamond" | "netherite";

export type ArmorKind = "helmet" | "chest" | "leggings" | "boots";

export type CraftedGearId =
  | `${ToolKind}_${GearTier}`
  | `${ArmorKind}_${Exclude<GearTier, "wood" | "stone">}`
  | "workbench"
  | "furnace";

export type MiningSpecialty =
  | "wood"
  | "cobble"
  | "iron"
  | "gold"
  | "diamond"
  | "netherite";

export interface MiningState {
  tickets: number;
  miningPoints: number;
  materials: Partial<Record<MaterialId, number>>;
  /** クラフト済みフラグ（所持） */
  crafted: Partial<Record<CraftedGearId, boolean>>;
  unlockedGachas: GachaId[];
  /** ベッド数＝パーティ枠（1〜3）。最初は1 */
  bedCount: number;
  /** 採掘パーティ（最大3・シールID） */
  partyIds: (string | null)[];
  /** 装備中（tool は最後に使ったほるどうぐの表示用） */
  equipped: {
    tool: CraftedGearId | null;
    helmet: CraftedGearId | null;
    chest: CraftedGearId | null;
    leggings: CraftedGearId | null;
    boots: CraftedGearId | null;
  };
  /** チケット付与済みフェーズ（sessionTreatKey） */
  ticketStampedSessions: Record<string, boolean>;
  /** 全日クリアでチケット付与済みの日付 */
  fullDayTicketClaimed: Record<string, boolean>;
  /** 4連ストリーク票を付与済みのストリーク値 */
  streakTicketClaimed: Record<number, boolean>;
  /** ヘルメットのあたり日おまけを使った日付 */
  luckyBonusClaimedDate?: string | null;
}

export const MATERIAL_META: Record<
  MaterialId,
  { label: string; emoji: string; image?: string }
> = {
  log: { label: "原木", emoji: "🪵", image: "/mining/Oak_Genboku.png" },
  plank: { label: "板材", emoji: "🟫", image: "/mining/Oak_Planks.webp" },
  stick: { label: "棒", emoji: "🥢", image: "/mining/Stick.png" },
  wool: { label: "羊毛", emoji: "🧶", image: "/mining/White_Wool.png" },
  cobble: { label: "丸石", emoji: "🪨", image: "/mining/Cobblestone.png" },
  iron_ore: { label: "鉄の原石", emoji: "⛏️", image: "/mining/raw_iron.png" },
  iron_ingot: { label: "鉄インゴット", emoji: "⚙️", image: "/mining/Iron_Ingot.png" },
  gold_ore: { label: "金の原石", emoji: "✨", image: "/mining/Raw_Gold.webp" },
  gold_ingot: { label: "金インゴット", emoji: "🥇", image: "/mining/Gold_Ingot.png" },
  coal: { label: "石炭", emoji: "⬛", image: "/mining/Coal.png" },
  diamond_shard: { label: "ダイヤの欠片", emoji: "💎", image: "/mining/Diamond.png" },
  diamond: { label: "ダイヤモンド", emoji: "💠", image: "/mining/Diamond.png" },
  ancient_debris: { label: "古代の残骸", emoji: "🌑", image: "/mining/Ancient_Debris.png" },
  nether_quartz: { label: "ネザークォーツ", emoji: "⬜", image: "/mining/Nether_Quartz.png" },
  netherite_scrap: { label: "ネザライトの欠片", emoji: "📎", image: "/mining/Netherite_Scrap.webp" },
  netherite_ingot: { label: "ネザライトインゴット", emoji: "🛡️", image: "/mining/Netherite_Ingot.png" },
};

/** 装備・設備の画像（あれば表示） */
export const GEAR_IMAGE: Partial<Record<CraftedGearId, string>> = {
  workbench: "/mining/Crafting_Table.png",
  furnace: "/mining/Furnace.png",
  sword_wood: "/mining/Wooden_Sword.png",
  axe_wood: "/mining/Wooden_Axe.png",
  pickaxe_wood: "/mining/Wooden_Pickaxe.webp",
  sword_stone: "/mining/Stone_Sword.png",
  axe_stone: "/mining/Stone_Axe.png",
  pickaxe_stone: "/mining/Stone_Pickaxe.png",
  sword_iron: "/mining/Iron_Sword.png",
  axe_iron: "/mining/Iron_Axe.png",
  pickaxe_iron: "/mining/Iron_Pickaxe.png",
  helmet_iron: "/mining/Iron_Helmet.webp",
  chest_iron: "/mining/Iron_Chestplate.webp",
  leggings_iron: "/mining/Iron_Leggings.webp",
  boots_iron: "/mining/Iron_Boots.webp",
  sword_gold: "/mining/Golden_Sword.png",
  axe_gold: "/mining/Golden_Axe.png",
  pickaxe_gold: "/mining/Golden_Pickaxe.png",
  helmet_gold: "/mining/Golden_Helmet.webp",
  chest_gold: "/mining/Golden_Chestplate.webp",
  leggings_gold: "/mining/Golden_Leggings.webp",
  boots_gold: "/mining/Golden_Boots.webp",
  sword_diamond: "/mining/Diamond_Sword.png",
  axe_diamond: "/mining/Diamond_Axe.png",
  pickaxe_diamond: "/mining/Diamond_Pickaxe.png",
  helmet_diamond: "/mining/Diamond_Helmet.webp",
  chest_diamond: "/mining/Diamond_Chestplate.webp",
  leggings_diamond: "/mining/Diamond_Leggings.webp",
  boots_diamond: "/mining/Diamond_Boots.webp",
  sword_netherite: "/mining/Netherite_Sword.webp",
  axe_netherite: "/mining/Netherite_Axe.png",
  pickaxe_netherite: "/mining/Netherite_Pickaxe.webp",
  helmet_netherite: "/mining/Netherite_Helmet.webp",
  chest_netherite: "/mining/netherite_chestplate.png",
  leggings_netherite: "/mining/netherite_leggings.png",
  boots_netherite: "/mining/Netherite_Boots.webp",
};

export function materialImage(id: MaterialId): string | undefined {
  return MATERIAL_META[id].image;
}

export function gearImage(id: CraftedGearId): string | undefined {
  return GEAR_IMAGE[id];
}

export const GACHA_META: Record<
  GachaId,
  { label: string; emoji: string; specialty: MiningSpecialty }
> = {
  wood: { label: "もり", emoji: "🌲", specialty: "wood" },
  stone: { label: "いしのどうくつ", emoji: "⛰️", specialty: "cobble" },
  iron: { label: "てつのこうざん", emoji: "⛏️", specialty: "iron" },
  gold: { label: "きんのこうざん", emoji: "🌟", specialty: "gold" },
  diamond: { label: "ダイヤのしんそう", emoji: "💎", specialty: "diamond" },
  nether: { label: "ネザー", emoji: "🔥", specialty: "netherite" },
};

export const TOOL_KIND_LABEL: Record<ToolKind, string> = {
  sword: "剣",
  axe: "斧",
  pickaxe: "ツルハシ",
};

/** ほるどうぐ（剣・斧・ツルハシ）の効果説明 */
export const TOOL_EFFECT_BLURB: Record<ToolKind, string> = {
  axe: "もりで 素材が+1しやすい（量アップ）",
  sword: "3個が出やすい。鉄・金はインゴット直、ダイヤはダイヤ直が増える",
  pickaxe: "こうざんで 素材が+1しやすい。ネザーは古代の残骸が出やすい（強いツルハシほど出やすい）",
};

export const ARMOR_EFFECT_BLURB: Record<ArmorKind, string> = {
  helmet: "きょうのあたり日がわかる。最初の1回は+1かくてい",
  chest: "⚡こうかんが少しお得",
  leggings: "どこでも素材が+1しやすい",
  boots: "まれにチケットがもどる",
};

/** いま掘る場所に対して、そのほるどうぐが効くか一言 */
export function toolEffectForGacha(kind: ToolKind, gacha: GachaId): string {
  if (kind === "axe") {
    return gacha === "wood"
      ? "いまのもりで 素材+1 が出やすい"
      : "もりのときだけ量アップ（いまの場所では効かない）";
  }
  if (kind === "pickaxe") {
    if (gacha === "wood") return "こうざんのときだけ量アップ（いまの場所では効かない）";
    if (gacha === "nether") return "いまのネザーで 古代の残骸が出やすい";
    return "いまのこうざんで 素材+1 が出やすい";
  }
  // sword
  if (gacha === "iron" || gacha === "gold") return "3個率アップ＋インゴット直が増える";
  if (gacha === "diamond") return "3個率アップ＋ダイヤ直が増える";
  if (gacha === "nether") return "3個率アップ＋残骸が出やすい";
  return "3個が出やすくなる";
}

export const GEAR_TIER_LABEL: Record<GearTier, string> = {
  wood: "木",
  stone: "石",
  iron: "鉄",
  gold: "金",
  diamond: "ダイヤ",
  netherite: "ネザライト",
};

export const ARMOR_KIND_LABEL: Record<ArmorKind, string> = {
  helmet: "ヘルメット",
  chest: "むねあて",
  leggings: "すねあて",
  boots: "ブーツ",
};

/** カテゴリ → 採掘得意（ユーザー確定） */
export const CATEGORY_SPECIALTY: Record<string, MiningSpecialty> = {
  daily: "wood",
  pokemon: "wood",
  prefecture: "wood",
  doraemon: "cobble",
  saikyoou: "cobble",
  minecraft: "cobble",
  brainrot: "iron",
  youtube: "gold",
  sumanai: "diamond",
  kimitsu: "netherite",
};

export const SPECIALTY_META: Record<
  MiningSpecialty,
  { label: string; emoji: string; gachaHint: string }
> = {
  wood: { label: "原木・棒", emoji: "🌲", gachaHint: "もり" },
  cobble: { label: "丸石", emoji: "🪨", gachaHint: "いしのどうくつ" },
  iron: { label: "鉄", emoji: "⛏️", gachaHint: "てつのこうざん" },
  gold: { label: "金", emoji: "🌟", gachaHint: "きんのこうざん" },
  diamond: { label: "ダイヤ", emoji: "💎", gachaHint: "ダイヤのしんそう" },
  netherite: { label: "ネザー", emoji: "🔥", gachaHint: "ネザー" },
};

export function specialtyOfCategory(category: string): MiningSpecialty {
  return CATEGORY_SPECIALTY[category] ?? "wood";
}

export function specialtyBlurb(category: string): string {
  const spec = specialtyOfCategory(category);
  const meta = SPECIALTY_META[spec];
  return `${meta.emoji}${meta.label}（${meta.gachaHint}）`;
}
export function emptyMiningState(): MiningState {
  return {
    tickets: 0,
    miningPoints: 0,
    materials: {},
    crafted: {},
    unlockedGachas: ["wood"],
    bedCount: 1,
    partyIds: [null, null, null],
    equipped: {
      tool: null,
      helmet: null,
      chest: null,
      leggings: null,
      boots: null,
    },
    ticketStampedSessions: {},
    fullDayTicketClaimed: {},
    streakTicketClaimed: {},
    luckyBonusClaimedDate: null,
  };
}

export function normalizeMiningState(raw?: Partial<MiningState> | null): MiningState {
  const base = emptyMiningState();
  if (!raw || typeof raw !== "object") return base;

  const materials: Partial<Record<MaterialId, number>> = {};
  if (raw.materials && typeof raw.materials === "object") {
    for (const [k, v] of Object.entries(raw.materials)) {
      const n = Math.floor(Number(v));
      if (Number.isFinite(n) && n > 0) materials[k as MaterialId] = n;
    }
  }

  const crafted: Partial<Record<CraftedGearId, boolean>> = {};
  if (raw.crafted && typeof raw.crafted === "object") {
    for (const [k, v] of Object.entries(raw.crafted)) {
      if (v) crafted[k as CraftedGearId] = true;
    }
  }

  const unlocked: GachaId[] = Array.isArray(raw.unlockedGachas)
    ? raw.unlockedGachas.filter((id): id is GachaId =>
        id === "wood" || id === "stone" || id === "iron" || id === "gold" || id === "diamond" || id === "nether",
      )
    : ["wood"];
  if (!unlocked.includes("wood")) unlocked.unshift("wood");
  const unlockedGachas: GachaId[] = [...new Set(unlocked)];

  const partyIds: (string | null)[] = [null, null, null];
  if (Array.isArray(raw.partyIds)) {
    for (let i = 0; i < 3; i++) {
      const id = raw.partyIds[i];
      partyIds[i] = typeof id === "string" && id ? id : null;
    }
  }

  const filledParty = partyIds.filter(Boolean).length;
  const rawBeds = Math.floor(Number(raw.bedCount));
  const bedCount = Number.isFinite(rawBeds) && rawBeds > 0
    ? Math.min(MAX_BEDS, Math.max(1, rawBeds))
    : Math.min(MAX_BEDS, Math.max(1, filledParty || 1));

  for (let i = bedCount; i < MAX_BEDS; i++) {
    partyIds[i] = null;
  }

  const eq = (raw.equipped && typeof raw.equipped === "object")
    ? raw.equipped as MiningState["equipped"]
    : emptyMiningState().equipped;
  return {
    tickets: Math.max(0, Math.floor(Number(raw.tickets) || 0)),
    miningPoints: Math.max(0, Math.floor(Number(raw.miningPoints) || 0)),
    materials,
    crafted,
    unlockedGachas,
    bedCount,
    partyIds,
    equipped: {
      tool: eq.tool ?? null,
      helmet: eq.helmet ?? null,
      chest: eq.chest ?? null,
      leggings: eq.leggings ?? null,
      boots: eq.boots ?? null,
    },
    ticketStampedSessions:
      raw.ticketStampedSessions && typeof raw.ticketStampedSessions === "object"
        ? { ...raw.ticketStampedSessions }
        : {},
    fullDayTicketClaimed:
      raw.fullDayTicketClaimed && typeof raw.fullDayTicketClaimed === "object"
        ? { ...raw.fullDayTicketClaimed }
        : {},
    streakTicketClaimed:
      raw.streakTicketClaimed && typeof raw.streakTicketClaimed === "object"
        ? { ...raw.streakTicketClaimed }
        : {},
    luckyBonusClaimedDate:
      typeof raw.luckyBonusClaimedDate === "string" ? raw.luckyBonusClaimedDate : null,
  };
}

export function getMaterialCount(state: MiningState, id: MaterialId): number {
  return Math.max(0, Math.floor(state.materials[id] ?? 0));
}

export function gearLabel(id: CraftedGearId): string {
  if (id === "workbench") return "作業台";
  if (id === "furnace") return "かまど";
  const [kind, tier] = id.split("_") as [string, GearTier];
  if (kind === "sword" || kind === "axe" || kind === "pickaxe") {
    return `${GEAR_TIER_LABEL[tier]}の${TOOL_KIND_LABEL[kind]}`;
  }
  if (kind === "helmet" || kind === "chest" || kind === "leggings" || kind === "boots") {
    return `${GEAR_TIER_LABEL[tier]}の${ARMOR_KIND_LABEL[kind]}`;
  }
  return id;
}

export function partySlotCount(state: MiningState): number {
  return Math.min(MAX_BEDS, Math.max(1, Math.floor(state.bedCount) || 1));
}

export function parseToolId(id: CraftedGearId | null): { kind: ToolKind; tier: GearTier } | null {
  if (!id) return null;
  const m = /^(sword|axe|pickaxe)_(wood|stone|iron|gold|diamond|netherite)$/.exec(id);
  if (!m) return null;
  return { kind: m[1] as ToolKind, tier: m[2] as GearTier };
}

export function tierRank(tier: GearTier): number {
  const order: GearTier[] = ["wood", "stone", "iron", "gold", "diamond", "netherite"];
  return order.indexOf(tier);
}
