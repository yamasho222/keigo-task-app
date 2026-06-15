export type StickerCategory = "sumanai" | "youtube" | "kimitsu" | "doraemon" | "brainrot" | "saikyoou" | "minecraft";
export type RewardCategory = "daily" | StickerCategory;
export type RewardRarity = "normal" | "rare" | "superRare" | "ultraRare";
export type StickerRarity = "normal" | "rare" | "superRare" | "ultraRare";

export interface EmojiReward {
  kind: "emoji";
  id: string;
  emoji: string;
  label: string;
  message: string;
  category: "daily";
  rarity: "normal";
}

export interface StickerReward {
  kind: "sticker";
  id: string;
  label: string;
  message: string;
  image: string;
  category: StickerCategory;
  rarity: StickerRarity;
}

export type RewardItem = EmojiReward | StickerReward;

export const STICKER_CATEGORIES: { id: RewardCategory; label: string }[] = [
  { id: "daily", label: "ノーマル" },
  { id: "sumanai", label: "すまない先生" },
  { id: "youtube", label: "YouTube" },
  { id: "kimitsu", label: "鬼滅の刃" },
  { id: "doraemon", label: "ドラえもん" },
  { id: "brainrot", label: "ブレインロット" },
  { id: "saikyoou", label: "最強王図鑑" },
  { id: "minecraft", label: "マインクラフト" },
];

export const RARITY_LABELS: Record<RewardRarity, string> = {
  normal: "ノーマル",
  rare: "レア",
  superRare: "スーパーレア",
  ultraRare: "ウルトラレア",
};

const STICKER_ALBUM_KEY = "keigo-sticker-album-v1";

/** 日次ごほうび・ノーマル（絵文字8種） */
export const DAILY_EMOJI_REWARDS: EmojiReward[] = [
  { kind: "emoji", id: "star", emoji: "⭐", label: "スター", message: "きょうも星みたいにかがやいた！", category: "daily", rarity: "normal" },
  { kind: "emoji", id: "cat", emoji: "🐱", label: "ねこ", message: "にゃー！ごほうびゲット！", category: "daily", rarity: "normal" },
  { kind: "emoji", id: "dog", emoji: "🐶", label: "いぬ", message: "わん！よくがんばったね！", category: "daily", rarity: "normal" },
  { kind: "emoji", id: "cake", emoji: "🎂", label: "ケーキ", message: "おいしそうなケーキのごほうび！", category: "daily", rarity: "normal" },
  { kind: "emoji", id: "gift", emoji: "🎁", label: "プレゼント", message: "サプライズプレゼント！", category: "daily", rarity: "normal" },
  { kind: "emoji", id: "party", emoji: "🎉", label: "パーティー", message: "パーティーじかん！", category: "daily", rarity: "normal" },
  { kind: "emoji", id: "rainbow", emoji: "🌈", label: "にじ", message: "にじ色のごほうび！", category: "daily", rarity: "normal" },
  { kind: "emoji", id: "fire", emoji: "🔥", label: "ファイヤー", message: "メラメラパワー全開！", category: "daily", rarity: "normal" },
];

/** ごほうびシール（82枚） */
export const STICKER_REWARDS: StickerReward[] = [
  { kind: "sticker", id: "warrior-baby", label: "ミスター赤ちゃん", message: "ミスター赤ちゃんゲット！", image: "/stickers/warrior-baby.png", category: "sumanai", rarity: "rare" },
  { kind: "sticker", id: "blue-fist", label: "ミスター・ブルー", message: "ミスター・ブルー登場！", image: "/stickers/blue-fist.png", category: "sumanai", rarity: "rare" },
  { kind: "sticker", id: "red-point", label: "ミスターレッド", message: "ミスターレッド！", image: "/stickers/red-point.png", category: "sumanai", rarity: "rare" },
  { kind: "sticker", id: "cyan-jacket", label: "すまない先生", message: "すまない先生シール！", image: "/stickers/cyan-jacket.png", category: "sumanai", rarity: "ultraRare" },
  { kind: "sticker", id: "hacker", label: "ミスターブラック", message: "ミスターブラック！", image: "/stickers/hacker.png", category: "sumanai", rarity: "superRare" },
  { kind: "sticker", id: "banana-soldier", label: "ミスターバナナ", message: "ミスターバナナ！", image: "/stickers/banana-soldier.png", category: "sumanai", rarity: "superRare" },
  { kind: "sticker", id: "hammer-builder", label: "銀さん", message: "銀さんゲット！", image: "/stickers/hammer-builder.png", category: "sumanai", rarity: "rare" },
  { kind: "sticker", id: "gold-prince", label: "ミスターマネー", message: "ミスターマネー！", image: "/stickers/gold-prince.png", category: "sumanai", rarity: "rare" },
  { kind: "sticker", id: "glasses-boy", label: "ヒカキン", message: "ヒカキン！", image: "/stickers/glasses-boy.png", category: "youtube", rarity: "superRare" },
  { kind: "sticker", id: "dot-cat", label: "おろちんゆー", message: "おろちんゆー！", image: "/stickers/dot-cat.png", category: "youtube", rarity: "ultraRare" },
  { kind: "sticker", id: "sakai-dino", label: "ペインさかい", message: "ペインさかい～！", image: "/stickers/sakai-dino.png", category: "youtube", rarity: "rare" },
  { kind: "sticker", id: "mori-konnyaku", label: "森こんにゃく", message: "森こんにゃく！", image: "/stickers/mori-konnyaku.png", category: "youtube", rarity: "superRare" },
  { kind: "sticker", id: "zenichi", label: "ぜんいち", message: "ぜんいち！", image: "/stickers/zenichi.png", category: "youtube", rarity: "superRare" },
  { kind: "sticker", id: "maikky", label: "マイッキー", message: "マイッキー！", image: "/stickers/maikky.png", category: "youtube", rarity: "rare" },
  { kind: "sticker", id: "tanjiro", label: "たんじろう", message: "たんじろうが応援！", image: "/stickers/tanjiro.png", category: "kimitsu", rarity: "ultraRare" },
  { kind: "sticker", id: "inosuke", label: "いのすけ", message: "いのすけ登場！", image: "/stickers/inosuke.png", category: "kimitsu", rarity: "superRare" },
  { kind: "sticker", id: "zenitsu", label: "ぜんいつ", message: "ぜんいつが来た！", image: "/stickers/zenitsu.png", category: "kimitsu", rarity: "superRare" },
  { kind: "sticker", id: "tengen", label: "てんげん", message: "派手なシール！", image: "/stickers/tengen.png", category: "kimitsu", rarity: "superRare" },
  { kind: "sticker", id: "muichiro", label: "むいちろう", message: "むいちろうゲット！", image: "/stickers/muichiro.png", category: "kimitsu", rarity: "rare" },
  { kind: "sticker", id: "sanemi", label: "さねみ", message: "さねみシール！", image: "/stickers/sanemi.png", category: "kimitsu", rarity: "rare" },
  { kind: "sticker", id: "akaza", label: "あかざ", message: "強敵シール！", image: "/stickers/akaza.png", category: "kimitsu", rarity: "rare" },
  { kind: "sticker", id: "obanai", label: "おばない", message: "おばない登場！", image: "/stickers/obanai.png", category: "kimitsu", rarity: "rare" },
  { kind: "sticker", id: "mitsuri", label: "みつり", message: "みつりがお祝い！", image: "/stickers/mitsuri.png", category: "kimitsu", rarity: "rare" },
  { kind: "sticker", id: "gyomei", label: "ぎょうめい", message: "ぎょうめいシール！", image: "/stickers/gyomei.png", category: "kimitsu", rarity: "rare" },
  { kind: "sticker", id: "rengoku", label: "れんごく", message: "れんごくさん！", image: "/stickers/rengoku.png", category: "kimitsu", rarity: "ultraRare" },
  { kind: "sticker", id: "muzan", label: "むざん", message: "ボスキャラシール！", image: "/stickers/muzan.png", category: "kimitsu", rarity: "ultraRare" },
  { kind: "sticker", id: "doma", label: "どうま", message: "どうまシール！", image: "/stickers/doma.png", category: "kimitsu", rarity: "rare" },
  { kind: "sticker", id: "urokodaki", label: "うろこだきせんせい", message: "判断が遅い！！", image: "/stickers/urokodaki.png", category: "kimitsu", rarity: "rare" },
  { kind: "sticker", id: "nezuko", label: "ねずこ", message: "ねずこちゃん！", image: "/stickers/nezuko.png", category: "kimitsu", rarity: "superRare" },
  { kind: "sticker", id: "sabito", label: "さびと", message: "さびとシール！", image: "/stickers/sabito.png", category: "kimitsu", rarity: "rare" },
  { kind: "sticker", id: "daki-gyutaro", label: "だき＆ぎゅうたろう", message: "きょうだいシール！", image: "/stickers/daki-gyutaro.png", category: "kimitsu", rarity: "rare" },
  { kind: "sticker", id: "spider-demon", label: "くもおに", message: "くもおに登場！", image: "/stickers/spider-demon.png", category: "kimitsu", rarity: "rare" },
  { kind: "sticker", id: "giyu", label: "ぎゆう", message: "ぎゆうさん！", image: "/stickers/giyu.png", category: "kimitsu", rarity: "superRare" },
  { kind: "sticker", id: "murata", label: "むらた", message: "むらたがんばれ！", image: "/stickers/murata.png", category: "kimitsu", rarity: "rare" },
  { kind: "sticker", id: "yushiro", label: "ゆしろう", message: "ゆしろう登場！", image: "/stickers/yushiro.png", category: "kimitsu", rarity: "rare" },
  { kind: "sticker", id: "yoriichi", label: "よりいち", message: "伝説のシール！", image: "/stickers/yoriichi.png", category: "kimitsu", rarity: "superRare" },
  { kind: "sticker", id: "kokushibo", label: "こくしぼう", message: "上弦のシール！", image: "/stickers/kokushibo.png", category: "kimitsu", rarity: "superRare" },
  { kind: "sticker", id: "doraemon", label: "ドラえもん", message: "ドラえもんだ！", image: "/stickers/doraemon.png", category: "doraemon", rarity: "superRare" },
  { kind: "sticker", id: "nobita", label: "のびた", message: "のびたくん！", image: "/stickers/nobita.png", category: "doraemon", rarity: "rare" },
  { kind: "sticker", id: "suneo", label: "スネ夫", message: "スネ夫ゲット！", image: "/stickers/suneo.png", category: "doraemon", rarity: "rare" },
  { kind: "sticker", id: "gian", label: "ジャイアン", message: "歌のジャイアン！", image: "/stickers/gian.png", category: "doraemon", rarity: "rare" },
  { kind: "sticker", id: "shizuka", label: "しずかちゃん", message: "しずかちゃんだ！", image: "/stickers/shizuka.png", category: "doraemon", rarity: "rare" },
  { kind: "sticker", id: "wood-log", label: "トゥントゥントゥンサフール", message: "トゥントゥントゥンサフール！", image: "/stickers/wood-log.png", category: "brainrot", rarity: "superRare" },
  { kind: "sticker", id: "shark-legs", label: "トララレロ・トラララ", message: "トララレロ・トラララ！", image: "/stickers/shark-legs.png", category: "brainrot", rarity: "rare" },
  { kind: "sticker", id: "monkey-banana", label: "チンパンジーニ・バナニーニ", message: "チンパンジーニ・バナニーニ！", image: "/stickers/monkey-banana.png", category: "brainrot", rarity: "rare" },
  { kind: "sticker", id: "chimpanzini-kingini", label: "チンパンジーニ・キンギーニ", message: "チンパンジーニ・キンギーニ！", image: "/stickers/chimpanzini-kingini.png", category: "brainrot", rarity: "superRare" },
  { kind: "sticker", id: "cactus-elephant", label: "リリリ・ラリラ", message: "リリリ・ラリラ！", image: "/stickers/cactus-elephant.png", category: "brainrot", rarity: "rare" },
  { kind: "sticker", id: "mystical-tree", label: "ブルブル・パタピム", message: "ブルブル・パタピム！", image: "/stickers/mystical-tree.png", category: "brainrot", rarity: "rare" },
  { kind: "sticker", id: "teapot-man", label: "タタタタ・サフール", message: "タタタタ・サフール！", image: "/stickers/teapot-man.png", category: "brainrot", rarity: "rare" },
  { kind: "sticker", id: "ninja-coffee", label: "カプチーノ・アサシーノ", message: "カプチーノ・アサシーノ！", image: "/stickers/ninja-coffee.png", category: "brainrot", rarity: "rare" },
  { kind: "sticker", id: "shinobi-cup", label: "トゥントゥントゥントゥントゥントゥントゥントゥンアサシーノボネカ", message: "トゥントゥントゥンアサシーノボネカ！", image: "/stickers/shinobi-cup.png", category: "brainrot", rarity: "superRare" },
  { kind: "sticker", id: "brainrot-tower", label: "トリッピトロッパトララリリラトゥントゥントゥンサフールボネカトゥントゥントララレロトリッピトロッパクロコディーナ", message: "最強のブレインロット！", image: "/stickers/brainrot-tower.png", category: "brainrot", rarity: "superRare" },
  { kind: "sticker", id: "pasta-dragon", label: "カネロニ・ドラゴーニ", message: "カネロニ・ドラゴーニ！", image: "/stickers/pasta-dragon.png", category: "brainrot", rarity: "rare" },
  { kind: "sticker", id: "tigro-fruitoni", label: "ティーグロリーグレ・フルトーニ", message: "ティーグロリーグレ・フルトーニ！", image: "/stickers/tigro-fruitoni.png", category: "brainrot", rarity: "rare" },
  { kind: "sticker", id: "pussini-sushini", label: "プッシーニ・スッシーニ", message: "プッシーニ・スッシーニ！", image: "/stickers/pussini-sushini.png", category: "brainrot", rarity: "rare" },
  { kind: "sticker", id: "chocolatini-panchonchoni", label: "チョコラティーニ・パンチョンチョーニ", message: "チョコラティーニ・パンチョンチョーニ！", image: "/stickers/chocolatini-panchonchoni.png", category: "brainrot", rarity: "rare" },
  { kind: "sticker", id: "bombaclot-crococlot", label: "ボンバクロット・クロコクロット", message: "ボンバクロット・クロコクロット！", image: "/stickers/bombaclot-crococlot.png", category: "brainrot", rarity: "rare" },
  { kind: "sticker", id: "meowl", label: "ミャウル", message: "ミャウル！", image: "/stickers/meowl.png", category: "brainrot", rarity: "superRare" },
  { kind: "sticker", id: "ryukku-nyukku-ryuuku", label: "リュック・ニュック・リューク", message: "リュック・ニュック・リューク！", image: "/stickers/ryukku-nyukku-ryuuku.png", category: "brainrot", rarity: "ultraRare" },
  { kind: "sticker", id: "ouryu", label: "応龍", message: "応龍！", image: "/stickers/ouryu.png", category: "saikyoou", rarity: "ultraRare" },
  { kind: "sticker", id: "fire-drake", label: "ファイアドレイク", message: "ファイアドレイク！", image: "/stickers/fire-drake.png", category: "saikyoou", rarity: "superRare" },
  { kind: "sticker", id: "heracles", label: "ヘラクレス", message: "ヘラクレス！", image: "/stickers/heracles.png", category: "saikyoou", rarity: "superRare" },
  { kind: "sticker", id: "saikyo-lion", label: "ライオン", message: "ライオン！", image: "/stickers/saikyo-lion.png", category: "saikyoou", rarity: "rare" },
  { kind: "sticker", id: "hercules-beetle", label: "ヘラクレスオオカブト", message: "ヘラクレスオオカブト！", image: "/stickers/hercules-beetle.png", category: "saikyoou", rarity: "rare" },
  { kind: "sticker", id: "hornet", label: "オオスズメバチ", message: "オオスズメバチ！", image: "/stickers/hornet.png", category: "saikyoou", rarity: "rare" },
  { kind: "sticker", id: "shiva", label: "シヴァ", message: "シヴァ！", image: "/stickers/shiva.png", category: "saikyoou", rarity: "superRare" },
  { kind: "sticker", id: "shachi", label: "シャチ", message: "シャチ！", image: "/stickers/shachi.png", category: "saikyoou", rarity: "rare" },
  { kind: "sticker", id: "mc-villager", label: "村人", message: "村人！", image: "/stickers/mc-villager.png", category: "minecraft", rarity: "normal" },
  { kind: "sticker", id: "mc-sheep", label: "ヒツジ", message: "ヒツジ！", image: "/stickers/mc-sheep.png", category: "minecraft", rarity: "normal" },
  { kind: "sticker", id: "mc-pig", label: "ブタ", message: "ブタ！", image: "/stickers/mc-pig.png", category: "minecraft", rarity: "normal" },
  { kind: "sticker", id: "mc-iron-golem", label: "アイアンゴーレム", message: "アイアンゴーレム！", image: "/stickers/mc-iron-golem.png", category: "minecraft", rarity: "rare" },
  { kind: "sticker", id: "mc-enderman", label: "エンダーマン", message: "エンダーマン！", image: "/stickers/mc-enderman.png", category: "minecraft", rarity: "rare" },
  { kind: "sticker", id: "mc-creeper", label: "クリーパー", message: "クリーパー！", image: "/stickers/mc-creeper.png", category: "minecraft", rarity: "rare" },
  { kind: "sticker", id: "mc-charged-creeper", label: "帯電クリーパー", message: "帯電クリーパー！", image: "/stickers/mc-charged-creeper.png", category: "minecraft", rarity: "superRare" },
  { kind: "sticker", id: "mc-zombie", label: "ゾンビ", message: "ゾンビ！", image: "/stickers/mc-zombie.png", category: "minecraft", rarity: "normal" },
  { kind: "sticker", id: "mc-warden", label: "ウォーデン", message: "ウォーデン！", image: "/stickers/mc-warden.png", category: "minecraft", rarity: "ultraRare" },
  { kind: "sticker", id: "mc-wither", label: "ウィザー", message: "ウィザー！", image: "/stickers/mc-wither.png", category: "minecraft", rarity: "superRare" },
  { kind: "sticker", id: "mc-ender-dragon", label: "エンダードラゴン", message: "エンダードラゴン！", image: "/stickers/mc-ender-dragon.png", category: "minecraft", rarity: "ultraRare" },
  { kind: "sticker", id: "mc-skeleton", label: "スケルトン", message: "スケルトン！", image: "/stickers/mc-skeleton.png", category: "minecraft", rarity: "normal" },
  { kind: "sticker", id: "mc-chicken", label: "ニワトリ", message: "ニワトリ！", image: "/stickers/mc-chicken.png", category: "minecraft", rarity: "normal" },
  { kind: "sticker", id: "mc-drowned", label: "ドラウンド", message: "ドラウンド！", image: "/stickers/mc-drowned.png", category: "minecraft", rarity: "rare" },
  { kind: "sticker", id: "mc-spider", label: "クモ", message: "クモ！", image: "/stickers/mc-spider.png", category: "minecraft", rarity: "normal" },
];

export const ALL_REWARDS: RewardItem[] = [...DAILY_EMOJI_REWARDS, ...STICKER_REWARDS];
export const TOTAL_REWARD_COUNT = ALL_REWARDS.length;

/** 日次：ノーマル30% / シール70%（N35%・R45%・SR15%・UR5%） */
export const DAILY_NORMAL_WEIGHT = 0.30;

export const STICKER_TIER_WEIGHTS: Record<StickerRarity, number> = {
  normal: 0.35,
  rare: 0.45,
  superRare: 0.15,
  ultraRare: 0.05,
};

export const WEEKLY_HIGH_TIER_WEIGHTS: Record<"superRare" | "ultraRare", number> = {
  superRare: 0.85,
  ultraRare: 0.15,
};

/** 単発特別ミッション: レア以上のみ */
export const ONE_OFF_SPECIAL_TIER_WEIGHTS: Record<"rare" | "superRare" | "ultraRare", number> = {
  rare: 0.70,
  superRare: 0.25,
  ultraRare: 0.05,
};

export interface RewardLookupEntry {
  label: string;
  category: RewardCategory;
  rarity: RewardRarity;
  emoji?: string;
  image?: string;
}

export const REWARD_LOOKUP: Record<string, RewardLookupEntry> = Object.fromEntries(
  ALL_REWARDS.map((r) => [
    r.id,
    r.kind === "emoji"
      ? { label: r.label, category: r.category, rarity: r.rarity, emoji: r.emoji }
      : { label: r.label, category: r.category, rarity: r.rarity, image: r.image },
  ]),
);

function pickRandom<T>(pool: T[]): T {
  return pool[Math.floor(Math.random() * pool.length)];
}

function rollWeightedTier<T extends string>(weights: Record<T, number>): T {
  const roll = Math.random();
  let acc = 0;
  for (const [tier, weight] of Object.entries(weights) as [T, number][]) {
    acc += weight;
    if (roll < acc) return tier;
  }
  return Object.keys(weights)[0] as T;
}

function pickFromStickerTier(collectedIds: string[], tier: StickerRarity): StickerReward {
  const exclude = new Set(dedupeStickerIds(collectedIds));
  const inTier = STICKER_REWARDS.filter((r) => r.rarity === tier);
  const available = inTier.filter((r) => !exclude.has(r.id));
  const pool = available.length > 0 ? available : inTier;
  if (pool.length === 0) return pickStickerReward(collectedIds);
  return pickRandom(pool);
}

function pickFromStickerTiers(collectedIds: string[], weights: Record<StickerRarity, number>): StickerReward {
  return pickFromStickerTier(collectedIds, rollWeightedTier(weights));
}

export function dedupeStickerIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ids) {
    if (!REWARD_LOOKUP[id] || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

export function loadStickerAlbum(): string[] {
  try {
    const raw = localStorage.getItem(STICKER_ALBUM_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return dedupeStickerIds(parsed as string[]);
    }
  } catch { /* ignore */ }
  return [];
}

export function saveStickerAlbum(ids: string[]): void {
  const deduped = dedupeStickerIds(ids);
  localStorage.setItem(STICKER_ALBUM_KEY, JSON.stringify(deduped));
}

export function mergeStickerAlbums(...sources: string[][]): string[] {
  return dedupeStickerIds(sources.flat());
}

export function groupCollectedByCategory(ids: string[]): { category: RewardCategory; label: string; ids: string[] }[] {
  const unique = dedupeStickerIds(ids);
  return STICKER_CATEGORIES
    .map((cat) => ({
      category: cat.id,
      label: cat.label,
      ids: unique.filter((id) => REWARD_LOOKUP[id]?.category === cat.id),
    }))
    .filter((g) => g.ids.length > 0);
}

export interface AlbumCategoryGroup {
  category: RewardCategory;
  label: string;
  rewards: RewardItem[];
  collectedCount: number;
  totalCount: number;
}

export function getAlbumCategoryGroups(collectedIds: string[]): AlbumCategoryGroup[] {
  const collected = new Set(dedupeStickerIds(collectedIds));
  return STICKER_CATEGORIES.map((cat) => {
    const rewards = ALL_REWARDS.filter((r) => r.category === cat.id);
    return {
      category: cat.id,
      label: cat.label,
      rewards,
      collectedCount: rewards.filter((r) => collected.has(r.id)).length,
      totalCount: rewards.length,
    };
  });
}

export function pickStickerReward(collectedIds: string[]): StickerReward {
  const exclude = new Set(dedupeStickerIds(collectedIds));
  const available = STICKER_REWARDS.filter((r) => !exclude.has(r.id));
  const pool = available.length > 0 ? available : STICKER_REWARDS;
  return pickRandom(pool);
}

export function pickDailyReward(collectedIds: string[]): RewardItem {
  const exclude = new Set(dedupeStickerIds(collectedIds));
  const availableNormal = DAILY_EMOJI_REWARDS.filter((r) => !exclude.has(r.id));

  if (Math.random() < DAILY_NORMAL_WEIGHT && availableNormal.length > 0) {
    return pickRandom(availableNormal);
  }
  return pickFromStickerTiers(collectedIds, STICKER_TIER_WEIGHTS);
}

export function pickFullDayBonusReward(collectedIds: string[]): StickerReward {
  return pickFromStickerTiers(collectedIds, STICKER_TIER_WEIGHTS);
}

export function pickSpecialMissionReward(collectedIds: string[]): StickerReward {
  return pickFromStickerTiers(collectedIds, STICKER_TIER_WEIGHTS);
}

export function pickOneOffSpecialReward(collectedIds: string[]): StickerReward {
  const tier = rollWeightedTier(ONE_OFF_SPECIAL_TIER_WEIGHTS);
  return pickFromStickerTier(collectedIds, tier);
}

export function pickWeeklyReward(collectedIds: string[]): StickerReward {
  const tier = rollWeightedTier(WEEKLY_HIGH_TIER_WEIGHTS);
  return pickFromStickerTier(collectedIds, tier);
}

/** DEV: 指定ティアから1枚抽選 */
export function pickStickerByTier(collectedIds: string[], tier: StickerRarity): StickerReward {
  return pickFromStickerTier(collectedIds, tier);
}

export function getStickerById(id: string): StickerReward | undefined {
  return STICKER_REWARDS.find((r) => r.id === id);
}

export function getStickersByCategory(category: StickerCategory): StickerReward[] {
  return STICKER_REWARDS.filter((r) => r.category === category);
}

/** カットイン昇格演出用の偽ノーマル絵文字 */
export function pickDecoyNormalReward(): EmojiReward {
  return pickRandom(DAILY_EMOJI_REWARDS);
}

export function pickTreatReward(collectedIds: string[], mode: TreatMode): RewardItem {
  if (mode === "fullDayBonus") return pickFullDayBonusReward(collectedIds);
  if (mode === "weekly") return pickWeeklyReward(collectedIds);
  if (mode === "specialMission") return pickSpecialMissionReward(collectedIds);
  if (mode === "oneOffSpecial") return pickOneOffSpecialReward(collectedIds);
  return pickDailyReward(collectedIds);
}

export type TreatMode = "daily" | "weekly" | "fullDayBonus" | "specialMission" | "oneOffSpecial";
