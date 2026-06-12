export type StickerCategory = "sumanai" | "hikakin" | "orochinyu" | "kimitsu" | "doraemon" | "brainrot";
export type RewardCategory = "daily" | StickerCategory;
export type RewardRarity = "low" | "high";

export interface EmojiReward {
  kind: "emoji";
  id: string;
  emoji: string;
  label: string;
  message: string;
  category: "daily";
  rarity: "low";
}

export interface StickerReward {
  kind: "sticker";
  id: string;
  label: string;
  message: string;
  image: string;
  category: StickerCategory;
  rarity: "high";
}

export type RewardItem = EmojiReward | StickerReward;

export const STICKER_CATEGORIES: { id: RewardCategory; label: string }[] = [
  { id: "daily", label: "ノーマル" },
  { id: "sumanai", label: "すまない先生" },
  { id: "hikakin", label: "ヒカキン" },
  { id: "orochinyu", label: "おろちんゆー" },
  { id: "kimitsu", label: "鬼滅の刃" },
  { id: "doraemon", label: "ドラえもん" },
  { id: "brainrot", label: "ブレインロット" },
];

const STICKER_ALBUM_KEY = "keigo-sticker-album-v1";

/** 日次ごほうび・低レアリティ（絵文字8種） */
export const DAILY_EMOJI_REWARDS: EmojiReward[] = [
  { kind: "emoji", id: "star", emoji: "⭐", label: "スター", message: "きょうも星みたいにかがやいた！", category: "daily", rarity: "low" },
  { kind: "emoji", id: "cat", emoji: "🐱", label: "ねこ", message: "にゃー！ごほうびゲット！", category: "daily", rarity: "low" },
  { kind: "emoji", id: "dog", emoji: "🐶", label: "いぬ", message: "わん！よくがんばったね！", category: "daily", rarity: "low" },
  { kind: "emoji", id: "cake", emoji: "🎂", label: "ケーキ", message: "おいしそうなケーキのごほうび！", category: "daily", rarity: "low" },
  { kind: "emoji", id: "gift", emoji: "🎁", label: "プレゼント", message: "サプライズプレゼント！", category: "daily", rarity: "low" },
  { kind: "emoji", id: "party", emoji: "🎉", label: "パーティー", message: "パーティーじかん！", category: "daily", rarity: "low" },
  { kind: "emoji", id: "rainbow", emoji: "🌈", label: "にじ", message: "にじ色のごほうび！", category: "daily", rarity: "low" },
  { kind: "emoji", id: "fire", emoji: "🔥", label: "ファイヤー", message: "メラメラパワー全開！", category: "daily", rarity: "low" },
];

/** ごほうびシール（50枚・高レアリティ・個人利用） */
export const STICKER_REWARDS: StickerReward[] = [
  { kind: "sticker", id: "warrior-baby", label: "ミスター赤ちゃん", message: "ミスター赤ちゃんゲット！", image: "/stickers/warrior-baby.png", category: "sumanai", rarity: "high" },
  { kind: "sticker", id: "blue-fist", label: "ミスター・ブルー", message: "ミスター・ブルー登場！", image: "/stickers/blue-fist.png", category: "sumanai", rarity: "high" },
  { kind: "sticker", id: "red-point", label: "ミスターレッド", message: "ミスターレッド！", image: "/stickers/red-point.png", category: "sumanai", rarity: "high" },
  { kind: "sticker", id: "cyan-jacket", label: "すまない先生", message: "すまない先生シール！", image: "/stickers/cyan-jacket.png", category: "sumanai", rarity: "high" },
  { kind: "sticker", id: "hacker", label: "ミスターブラック", message: "ミスターブラック！", image: "/stickers/hacker.png", category: "sumanai", rarity: "high" },
  { kind: "sticker", id: "banana-soldier", label: "ミスターバナナ", message: "ミスターバナナ！", image: "/stickers/banana-soldier.png", category: "sumanai", rarity: "high" },
  { kind: "sticker", id: "hammer-builder", label: "銀さん", message: "銀さんゲット！", image: "/stickers/hammer-builder.png", category: "sumanai", rarity: "high" },
  { kind: "sticker", id: "gold-prince", label: "ミスターマネー", message: "ミスターマネー！", image: "/stickers/gold-prince.png", category: "sumanai", rarity: "high" },
  { kind: "sticker", id: "glasses-boy", label: "ヒカキン", message: "ヒカキン！", image: "/stickers/glasses-boy.png", category: "hikakin", rarity: "high" },
  { kind: "sticker", id: "dot-cat", label: "おろちんゆー", message: "おろちんゆー！", image: "/stickers/dot-cat.png", category: "orochinyu", rarity: "high" },
  { kind: "sticker", id: "sakai-dino", label: "ペインさかい", message: "ペインさかい～！", image: "/stickers/sakai-dino.png", category: "orochinyu", rarity: "high" },
  { kind: "sticker", id: "tanjiro", label: "たんじろう", message: "たんじろうが応援！", image: "/stickers/tanjiro.png", category: "kimitsu", rarity: "high" },
  { kind: "sticker", id: "inosuke", label: "いのすけ", message: "いのすけ登場！", image: "/stickers/inosuke.png", category: "kimitsu", rarity: "high" },
  { kind: "sticker", id: "zenitsu", label: "ぜんいつ", message: "ぜんいつが来た！", image: "/stickers/zenitsu.png", category: "kimitsu", rarity: "high" },
  { kind: "sticker", id: "tengen", label: "てんげん", message: "派手なシール！", image: "/stickers/tengen.png", category: "kimitsu", rarity: "high" },
  { kind: "sticker", id: "muichiro", label: "むいちろう", message: "むいちろうゲット！", image: "/stickers/muichiro.png", category: "kimitsu", rarity: "high" },
  { kind: "sticker", id: "sanemi", label: "さねみ", message: "さねみシール！", image: "/stickers/sanemi.png", category: "kimitsu", rarity: "high" },
  { kind: "sticker", id: "akaza", label: "あかざ", message: "強敵シール！", image: "/stickers/akaza.png", category: "kimitsu", rarity: "high" },
  { kind: "sticker", id: "obanai", label: "おばない", message: "おばない登場！", image: "/stickers/obanai.png", category: "kimitsu", rarity: "high" },
  { kind: "sticker", id: "mitsuri", label: "みつり", message: "みつりがお祝い！", image: "/stickers/mitsuri.png", category: "kimitsu", rarity: "high" },
  { kind: "sticker", id: "gyomei", label: "ぎょうめい", message: "ぎょうめいシール！", image: "/stickers/gyomei.png", category: "kimitsu", rarity: "high" },
  { kind: "sticker", id: "rengoku", label: "れんごく", message: "れんごくさん！", image: "/stickers/rengoku.png", category: "kimitsu", rarity: "high" },
  { kind: "sticker", id: "muzan", label: "むざん", message: "ボスキャラシール！", image: "/stickers/muzan.png", category: "kimitsu", rarity: "high" },
  { kind: "sticker", id: "doma", label: "どうま", message: "どうまシール！", image: "/stickers/doma.png", category: "kimitsu", rarity: "high" },
  { kind: "sticker", id: "urokodaki", label: "うろこだきせんせい", message: "判断が遅い！！", image: "/stickers/urokodaki.png", category: "kimitsu", rarity: "high" },
  { kind: "sticker", id: "nezuko", label: "ねずこ", message: "ねずこちゃん！", image: "/stickers/nezuko.png", category: "kimitsu", rarity: "high" },
  { kind: "sticker", id: "sabito", label: "さびと", message: "さびとシール！", image: "/stickers/sabito.png", category: "kimitsu", rarity: "high" },
  { kind: "sticker", id: "daki-gyutaro", label: "だき＆ぎゅうたろう", message: "きょうだいシール！", image: "/stickers/daki-gyutaro.png", category: "kimitsu", rarity: "high" },
  { kind: "sticker", id: "spider-demon", label: "くもおに", message: "くもおに登場！", image: "/stickers/spider-demon.png", category: "kimitsu", rarity: "high" },
  { kind: "sticker", id: "giyu", label: "ぎゆう", message: "ぎゆうさん！", image: "/stickers/giyu.png", category: "kimitsu", rarity: "high" },
  { kind: "sticker", id: "murata", label: "むらた", message: "むらたがんばれ！", image: "/stickers/murata.png", category: "kimitsu", rarity: "high" },
  { kind: "sticker", id: "yushiro", label: "ゆしろう", message: "ゆしろう登場！", image: "/stickers/yushiro.png", category: "kimitsu", rarity: "high" },
  { kind: "sticker", id: "yoriichi", label: "よりいち", message: "伝説のシール！", image: "/stickers/yoriichi.png", category: "kimitsu", rarity: "high" },
  { kind: "sticker", id: "kokushibo", label: "こくしぼう", message: "上弦のシール！", image: "/stickers/kokushibo.png", category: "kimitsu", rarity: "high" },
  { kind: "sticker", id: "doraemon", label: "ドラえもん", message: "ドラえもんだ！", image: "/stickers/doraemon.png", category: "doraemon", rarity: "high" },
  { kind: "sticker", id: "nobita", label: "のびた", message: "のびたくん！", image: "/stickers/nobita.png", category: "doraemon", rarity: "high" },
  { kind: "sticker", id: "suneo", label: "スネ夫", message: "スネ夫ゲット！", image: "/stickers/suneo.png", category: "doraemon", rarity: "high" },
  { kind: "sticker", id: "gian", label: "ジャイアン", message: "歌のジャイアン！", image: "/stickers/gian.png", category: "doraemon", rarity: "high" },
  { kind: "sticker", id: "wood-log", label: "トゥントゥントゥンサフール", message: "トゥントゥントゥンサフール！", image: "/stickers/wood-log.png", category: "brainrot", rarity: "high" },
  { kind: "sticker", id: "shark-legs", label: "トララレロ・トラララ", message: "トララレロ・トラララ！", image: "/stickers/shark-legs.png", category: "brainrot", rarity: "high" },
  { kind: "sticker", id: "monkey-banana", label: "チンパンジーニ・バナニーニ", message: "チンパンジーニ・バナニーニ！", image: "/stickers/monkey-banana.png", category: "brainrot", rarity: "high" },
  { kind: "sticker", id: "cactus-elephant", label: "リリリ・ラリラ", message: "リリリ・ラリラ！", image: "/stickers/cactus-elephant.png", category: "brainrot", rarity: "high" },
  { kind: "sticker", id: "mystical-tree", label: "ブルブル・パタピム", message: "ブルブル・パタピム！", image: "/stickers/mystical-tree.png", category: "brainrot", rarity: "high" },
  { kind: "sticker", id: "teapot-man", label: "タタタタ・サフール", message: "タタタタ・サフール！", image: "/stickers/teapot-man.png", category: "brainrot", rarity: "high" },
  { kind: "sticker", id: "ninja-coffee", label: "カプチーノ・アサシーノ", message: "カプチーノ・アサシーノ！", image: "/stickers/ninja-coffee.png", category: "brainrot", rarity: "high" },
  { kind: "sticker", id: "shinobi-cup", label: "トゥントゥントゥントゥントゥントゥントゥントゥンアサシーノボネカ", message: "トゥントゥントゥンアサシーノボネカ！", image: "/stickers/shinobi-cup.png", category: "brainrot", rarity: "high" },
  { kind: "sticker", id: "brainrot-tower", label: "トリッピトロッパトララリリラトゥントゥントゥンサフールボネカトゥントゥントララレロトリッピトロッパクロコディーナ", message: "最強のブレインロット！", image: "/stickers/brainrot-tower.png", category: "brainrot", rarity: "high" },
  { kind: "sticker", id: "pasta-dragon", label: "カネロニ・ドラゴーニ", message: "カネロニ・ドラゴーニ！", image: "/stickers/pasta-dragon.png", category: "brainrot", rarity: "high" },
  { kind: "sticker", id: "tigro-fruitoni", label: "ティーグロリーグレ・フルトーニ", message: "ティーグロリーグレ・フルトーニ！", image: "/stickers/tigro-fruitoni.png", category: "brainrot", rarity: "high" },
  { kind: "sticker", id: "pussini-sushini", label: "プッシーニ・スッシーニ", message: "プッシーニ・スッシーニ！", image: "/stickers/pussini-sushini.png", category: "brainrot", rarity: "high" },
];

export const ALL_REWARDS: RewardItem[] = [...DAILY_EMOJI_REWARDS, ...STICKER_REWARDS];
export const TOTAL_REWARD_COUNT = ALL_REWARDS.length;

/** 日次：低レア30% / 高レア70% */
const DAILY_LOW_RARITY_WEIGHT = 0.30;

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
  const availableLow = DAILY_EMOJI_REWARDS.filter((r) => !exclude.has(r.id));
  const availableHigh = STICKER_REWARDS.filter((r) => !exclude.has(r.id));

  if (Math.random() < DAILY_LOW_RARITY_WEIGHT && availableLow.length > 0) {
    return pickRandom(availableLow);
  }
  if (availableHigh.length > 0) {
    return pickRandom(availableHigh);
  }
  if (availableLow.length > 0) {
    return pickRandom(availableLow);
  }
  return pickRandom(ALL_REWARDS);
}

export function pickTreatReward(collectedIds: string[], mode: "daily" | "weekly"): RewardItem {
  return mode === "weekly" ? pickStickerReward(collectedIds) : pickDailyReward(collectedIds);
}
