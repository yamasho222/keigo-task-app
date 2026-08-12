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
  | "netherite_ingot"
  | "sugar_cane"
  | "paper"
  | "leather"
  | "water"
  | "lava"
  | "obsidian"
  | "lapis"
  | "book";

/** パーティ枠＝ベッド数（1〜3） */
export const MAX_BEDS = 3;
export const BED_IMAGE = "/mining/White_Bed.png";

export type GachaId =
  | "wood"
  | "farm"
  | "stone"
  | "river"
  | "iron"
  | "coal"
  | "gold"
  | "lava_cave"
  | "diamond"
  | "lapis_cave"
  | "nether";

export type GearSlot = "tool" | "helmet" | "chest" | "leggings" | "boots";

export type ToolKind = "sword" | "axe" | "pickaxe";

export type GearTier = "wood" | "stone" | "iron" | "gold" | "diamond" | "netherite";

export type ArmorKind = "helmet" | "chest" | "leggings" | "boots";

/** まほうの付与先（種類ごと1つ） */
export type EnchantTarget = ToolKind | ArmorKind;

export type EnchantId =
  | "efficiency"
  | "fortune"
  | "refund"
  | "bargain"
  | "prospect"
  | "bonus_star";

export type EnchantLevel = 1 | 2 | 3;

export interface GearEnchant {
  id: EnchantId;
  level: EnchantLevel;
}

export type CraftedGearId =
  | `${ToolKind}_${GearTier}`
  | `${ArmorKind}_${Exclude<GearTier, "wood" | "stone">}`
  | "workbench"
  | "furnace"
  | "bucket_iron"
  | "enchanting_table";

export type MiningSpecialty =
  | "wood"
  | "cobble"
  | "iron"
  | "coal"
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
  /** 早ねボーナス権利（キー: 宣言した夜の日付） */
  bedtimeTicketEligibleNight: Record<string, boolean>;
  /** 早ねボーナス付与済み（キー: 宣言した夜の日付） */
  bedtimeTicketClaimed: Record<string, boolean>;
  /** ヘルメットのあたり日おまけを使った日付 */
  luckyBonusClaimedDate?: string | null;
  /** 前回選んだ／掘った行き先（再入場の初期表示用） */
  lastSelectedGacha?: GachaId | null;
  /** 種類ごとのまほう */
  enchants: Partial<Record<EnchantTarget, GearEnchant>>;
  /** アカウント初回のまほう決定を使ったか */
  firstEnchantClaimed?: boolean;
  /** 鉱山バージョンアップ告知を見たか */
  miningVersionNoticeSeen?: boolean;
  /** テーブル後の分岐カード（はやく／つよく）を見たか */
  miningRouteBranchSeen?: boolean;
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
  diamond_shard: { label: "ダイヤの欠片", emoji: "💠", image: "/mining/Diamond_Nugget.png" },
  diamond: { label: "ダイヤモンド", emoji: "💎", image: "/mining/Diamond.png" },
  ancient_debris: { label: "古代の残骸", emoji: "🌑", image: "/mining/Ancient_Debris.png" },
  nether_quartz: { label: "ネザークォーツ", emoji: "⬜", image: "/mining/Nether_Quartz.png" },
  netherite_scrap: { label: "ネザライトの欠片", emoji: "📎", image: "/mining/Netherite_Scrap.webp" },
  netherite_ingot: { label: "ネザライトインゴット", emoji: "🛡️", image: "/mining/Netherite_Ingot.png" },
  sugar_cane: { label: "さとうきび", emoji: "🎋" },
  paper: { label: "紙", emoji: "📄" },
  leather: { label: "皮", emoji: "🟤" },
  water: { label: "水", emoji: "💧" },
  lava: { label: "ようがん", emoji: "🌋" },
  obsidian: { label: "黒曜石", emoji: "⬛" },
  lapis: { label: "ラピスラズリ", emoji: "🔵" },
  book: { label: "本", emoji: "📖" },
};

/** 装備・設備の画像（あれば表示） */
export const GEAR_IMAGE: Partial<Record<CraftedGearId, string>> = {
  workbench: "/mining/Crafting_Table.png",
  furnace: "/mining/Furnace.png",
  bucket_iron: "/mining/Iron_Ingot.png",
  enchanting_table: "/mining/Crafting_Table.png",
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

export const GACHA_ORDER: GachaId[] = [
  "wood",
  "farm",
  "stone",
  "river",
  "iron",
  "coal",
  "gold",
  "lava_cave",
  "diamond",
  "lapis_cave",
  "nether",
];

/** こううん日の抽選から外す（バケツ専用など） */
export const LUCKY_GACHA_EXCLUDE: ReadonlySet<GachaId> = new Set(["lava_cave"]);

export const GACHA_META: Record<
  GachaId,
  { label: string; emoji: string; specialty: MiningSpecialty; badge?: string }
> = {
  wood: { label: "もり", emoji: "🌲", specialty: "wood" },
  farm: { label: "農場", emoji: "🌾", specialty: "wood", badge: "羊毛・皮" },
  stone: { label: "いしのどうくつ", emoji: "⛰️", specialty: "cobble" },
  river: { label: "かわ", emoji: "🌊", specialty: "cobble", badge: "さとうきび／水" },
  iron: { label: "てつのこうざん", emoji: "⛏️", specialty: "iron" },
  coal: { label: "せきたんのやま", emoji: "⬛", specialty: "coal" },
  gold: { label: "きんのこうざん", emoji: "🌟", specialty: "gold" },
  lava_cave: { label: "ようがんどうくつ", emoji: "🌋", specialty: "iron", badge: "バケツひつよう" },
  diamond: { label: "ダイヤのしんそう", emoji: "💎", specialty: "diamond" },
  lapis_cave: { label: "ラピスどうくつ", emoji: "🔵", specialty: "diamond", badge: "ラピスだけ" },
  nether: { label: "ネザー", emoji: "🔥", specialty: "netherite" },
};

/**
 * 掘り演出用の正面ブロック画像（`public/mining/` 直下）。
 * 未配置時は色面フォールバック。
 */
export const DIG_BLOCK_IMAGE: Record<GachaId, string> = {
  wood: "/mining/tree.png",
  farm: "/mining/White_Wool.png",
  stone: "/mining/Stone.png",
  river: "/mining/Oak_Genboku.png",
  iron: "/mining/Iron_Ore.png",
  coal: "/mining/Coal_Ore.png",
  gold: "/mining/Gold_Ore.webp",
  lava_cave: "/mining/Netherrack.webp",
  diamond: "/mining/Diamond_Ore.png",
  lapis_cave: "/mining/Diamond_Ore.png",
  nether: "/mining/Netherrack.webp",
};

export const ENCHANT_META: Record<
  EnchantId,
  { label: string; blurb: string; weight: number }
> = {
  efficiency: { label: "こうりつ", blurb: "たまに素材がもう1こ", weight: 1 },
  fortune: { label: "大あたり", blurb: "たまにきほんが3こ", weight: 1 },
  refund: { label: "もどり", blurb: "たまに🎫がもどる", weight: 2 },
  bargain: { label: "やすうり", blurb: "こうかん所が安くなる", weight: 4 },
  prospect: { label: "あたり日", blurb: "こううんのほりばで得しやすい", weight: 2 },
  bonus_star: { label: "⭐おまけ", blurb: "たまにこうかん⭐がもらえる", weight: 4 },
};

export const ENCHANT_TARGET_LABEL: Record<EnchantTarget, string> = {
  sword: "剣",
  axe: "斧",
  pickaxe: "ツルハシ",
  helmet: "ヘルメット",
  chest: "むねあて",
  leggings: "レギンス",
  boots: "ブーツ",
};

export const TOOL_KIND_LABEL: Record<ToolKind, string> = {
  sword: "剣",
  axe: "斧",
  pickaxe: "ツルハシ",
};

/** ほるどうぐ（剣・斧・ツルハシ）の効果説明（クラフトカード・そうび用・子ども向け） */
export const TOOL_EFFECT_BLURB: Record<ToolKind, string> = {
  axe: "もりでたくさんほれやすい",
  sword: "たまにたくさん／レアが出やすい",
  pickaxe: "こうざんでたくさんほれやすい",
};

/** 装備画面のデフォルト一言（子ども向け） */
export const ARMOR_EFFECT_SHORT: Record<ArmorKind, string> = {
  helmet: "きょうのラッキー場所がわかる",
  chest: "こうかんがお得",
  leggings: "たまに素材+1",
  boots: "まれに🎫もどる",
};

/** 折りたたみ用のくわしい説明 */
export const ARMOR_EFFECT_BLURB: Record<ArmorKind, string> = {
  helmet: "きょうのこううん日がわかる。最初の1回は+1かくてい",
  chest: "こうかん⭐でのこうかんが少しお得",
  leggings: "こううんで素材が+1しやすい",
  boots: "まれにチケットがもどる",
};

/** いま掘る場所に対して、そのほるどうぐが効くか一言 */
export function toolEffectForGacha(kind: ToolKind, gacha: GachaId): string {
  if (kind === "axe") {
    if (gacha === "wood" || gacha === "farm") return "いま効く：たくさんほれる";
    return "もり・農場のときだけ効く";
  }
  if (kind === "pickaxe") {
    if (gacha === "wood" || gacha === "farm") return "こうざんのときだけ効く";
    if (gacha === "lava_cave") return "バケツでようがんをくむ";
    if (gacha === "nether") return "いま効く：残骸が出やすい";
    if (gacha === "coal") return "いま効く：石炭+1";
    if (gacha === "lapis_cave") return "いま効く：ラピス";
    return "いま効く：たくさんほれる";
  }
  if (gacha === "iron" || gacha === "gold") return "たまに+3／インゴット直";
  if (gacha === "diamond") return "たまに+3／ダイヤ直";
  if (gacha === "nether") return "たまに+3（残骸はツルハシ向き）";
  return "たまに素材+3";
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
  leggings: "レギンス",
  boots: "ブーツ",
};

/** カテゴリ → 採掘得意（ユーザー確定） */
export const CATEGORY_SPECIALTY: Record<string, MiningSpecialty> = {
  pokemon: "wood",
  prefecture: "wood",
  doraemon: "cobble",
  saikyoou: "cobble",
  minecraft: "cobble",
  brainrot: "coal",
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
  coal: { label: "石炭", emoji: "⬛", gachaHint: "せきたんのやま" },
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
    bedtimeTicketEligibleNight: {},
    bedtimeTicketClaimed: {},
    luckyBonusClaimedDate: null,
    lastSelectedGacha: null,
    enchants: {},
    firstEnchantClaimed: false,
    miningVersionNoticeSeen: false,
    miningRouteBranchSeen: false,
  };
}

const ALL_GACHA_IDS: GachaId[] = [
  "wood",
  "farm",
  "stone",
  "river",
  "iron",
  "coal",
  "gold",
  "lava_cave",
  "diamond",
  "lapis_cave",
  "nether",
];

function isGachaId(id: unknown): id is GachaId {
  return typeof id === "string" && (ALL_GACHA_IDS as string[]).includes(id);
}

const ALL_ENCHANT_IDS: EnchantId[] = [
  "efficiency",
  "fortune",
  "refund",
  "bargain",
  "prospect",
  "bonus_star",
];

const ALL_ENCHANT_TARGETS: EnchantTarget[] = [
  "sword",
  "axe",
  "pickaxe",
  "helmet",
  "chest",
  "leggings",
  "boots",
];

function isEnchantId(id: unknown): id is EnchantId {
  return typeof id === "string" && (ALL_ENCHANT_IDS as string[]).includes(id);
}

function isEnchantTarget(id: unknown): id is EnchantTarget {
  return typeof id === "string" && (ALL_ENCHANT_TARGETS as string[]).includes(id);
}

function normalizeBoolRecord(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v) out[k] = true;
  }
  return out;
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
    ? raw.unlockedGachas.filter((id): id is GachaId => isGachaId(id))
    : ["wood"];
  if (!unlocked.includes("wood")) unlocked.unshift("wood");
  const unlockedGachas: GachaId[] = [...new Set(unlocked)];

  const lastSelectedRaw = raw.lastSelectedGacha;
  const lastSelectedGacha =
    isGachaId(lastSelectedRaw) && unlockedGachas.includes(lastSelectedRaw)
      ? lastSelectedRaw
      : null;

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
    ticketStampedSessions: normalizeBoolRecord(raw.ticketStampedSessions),
    fullDayTicketClaimed: normalizeBoolRecord(raw.fullDayTicketClaimed),
    streakTicketClaimed:
      raw.streakTicketClaimed && typeof raw.streakTicketClaimed === "object"
        ? { ...raw.streakTicketClaimed }
        : {},
    bedtimeTicketEligibleNight: normalizeBoolRecord(raw.bedtimeTicketEligibleNight),
    bedtimeTicketClaimed: normalizeBoolRecord(raw.bedtimeTicketClaimed),
    luckyBonusClaimedDate:
      typeof raw.luckyBonusClaimedDate === "string" ? raw.luckyBonusClaimedDate : null,
    lastSelectedGacha,
    enchants: normalizeEnchants(raw.enchants),
    firstEnchantClaimed: !!raw.firstEnchantClaimed,
    miningVersionNoticeSeen: !!raw.miningVersionNoticeSeen,
    miningRouteBranchSeen: !!raw.miningRouteBranchSeen,
  };
}

function normalizeEnchants(raw: unknown): Partial<Record<EnchantTarget, GearEnchant>> {
  if (!raw || typeof raw !== "object") return {};
  const out: Partial<Record<EnchantTarget, GearEnchant>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isEnchantTarget(k) || !v || typeof v !== "object") continue;
    const rec = v as { id?: unknown; level?: unknown };
    if (!isEnchantId(rec.id)) continue;
    const level = Math.floor(Number(rec.level));
    if (level !== 1 && level !== 2 && level !== 3) continue;
    out[k] = { id: rec.id, level };
  }
  return out;
}

export function getMaterialCount(state: MiningState, id: MaterialId): number {
  return Math.max(0, Math.floor(state.materials[id] ?? 0));
}

export function gearLabel(id: CraftedGearId): string {
  if (id === "workbench") return "作業台";
  if (id === "furnace") return "かまど";
  if (id === "bucket_iron") return "鉄のバケツ";
  if (id === "enchanting_table") return "エンチャントテーブル";
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

export function enchantTargetOfGear(id: CraftedGearId): EnchantTarget | null {
  const tool = parseToolId(id);
  if (tool) return tool.kind;
  const m = /^(helmet|chest|leggings|boots)_/.exec(id);
  return m ? (m[1] as ArmorKind) : null;
}

export function tierRank(tier: GearTier): number {
  const order: GearTier[] = ["wood", "stone", "iron", "gold", "diamond", "netherite"];
  return order.indexOf(tier);
}
