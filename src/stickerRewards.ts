import {
  type StickerRarity,
  type RewardRarity,
  RARITY_META,
  TIER_WEIGHTS_DAILY,
  TIER_WEIGHTS_DEADLINE_RARE_PLUS,
  TIER_WEIGHTS_DEADLINE_SR_PLUS,
  TIER_WEIGHTS_DEADLINE_UR_PLUS,
  TIER_WEIGHTS_FULL_DAY,
  TIER_WEIGHTS_ONE_OFF_SPECIAL,
  TIER_WEIGHTS_ONE_OFF_SPECIAL_UR_PLUS,
  TIER_WEIGHTS_SEVEN_DAY,
  TIER_WEIGHTS_THREE_DAY,
} from "./rarityMeta";
import type { SpecialRewardFloor } from "./sharedTasks";

export type { StickerRarity, RewardRarity } from "./rarityMeta";

export type StickerCategory = "sumanai" | "youtube" | "kimitsu" | "doraemon" | "brainrot" | "saikyoou" | "minecraft" | "pokemon" | "prefecture";
export type RewardCategory = StickerCategory;

/** 都道府県シールの地方サブカテゴリ */
export type PrefectureRegion =
  | "hokkaido-tohoku"
  | "kanto"
  | "hokushinetsu"
  | "tokai"
  | "kinki"
  | "chugoku"
  | "shikoku"
  | "kyushu-okinawa";

export const PREFECTURE_SUBCATEGORIES: { id: PrefectureRegion; label: string }[] = [
  { id: "hokkaido-tohoku", label: "北海道・東北地方" },
  { id: "kanto", label: "関東地方" },
  { id: "hokushinetsu", label: "北信越地方" },
  { id: "tokai", label: "東海地方" },
  { id: "kinki", label: "近畿地方" },
  { id: "chugoku", label: "中国地方" },
  { id: "shikoku", label: "四国地方" },
  { id: "kyushu-okinawa", label: "九州・沖縄地方" },
];

export interface StickerReward {
  kind: "sticker";
  id: string;
  label: string;
  message: string;
  image: string;
  category: StickerCategory;
  rarity: StickerRarity;
  /** 横長画像を1:1枠の中央で切り抜き表示（GIFアニメーション保持） */
  imageFit?: "contain" | "cover";
  /** 都道府県など、カテゴリ内の地方分け */
  subcategory?: PrefectureRegion;
}

export type RewardItem = StickerReward;

export const STICKER_CATEGORIES: { id: RewardCategory; label: string }[] = [
  { id: "sumanai", label: "すまない先生" },
  { id: "youtube", label: "YouTube" },
  { id: "kimitsu", label: "鬼滅の刃" },
  { id: "doraemon", label: "ドラえもん" },
  { id: "brainrot", label: "ブレインロット" },
  { id: "saikyoou", label: "最強王図鑑" },
  { id: "minecraft", label: "マインクラフト" },
  { id: "pokemon", label: "ポケモン" },
  { id: "prefecture", label: "都道府県" },
];

export const RARITY_LABELS: Record<RewardRarity, string> = Object.fromEntries(
  Object.entries(RARITY_META).map(([k, v]) => [k, v.label]),
) as Record<RewardRarity, string>;

const STICKER_ALBUM_KEY = "keigo-sticker-album-v1";

function stickerAlbumKey(childId?: string | null): string {
  return childId ? `${STICKER_ALBUM_KEY}:${childId}` : STICKER_ALBUM_KEY;
}

/** ごほうびシール */
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
  { kind: "sticker", id: "lr-brainrod", label: "ブレインロッド大集合", message: "ブレインロッド大集合！", image: "/stickers/lr-brainrod.gif", category: "brainrot", rarity: "legendary", imageFit: "cover" },
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
  { kind: "sticker", id: "ur-enderdragon", label: "エンダードラゴン", message: "エンダードラゴン！", image: "/stickers/ur-enderdragon.gif", category: "minecraft", rarity: "ultraRare", imageFit: "cover" },
  { kind: "sticker", id: "mc-skeleton", label: "スケルトン", message: "スケルトン！", image: "/stickers/mc-skeleton.png", category: "minecraft", rarity: "normal" },
  { kind: "sticker", id: "mc-chicken", label: "ニワトリ", message: "ニワトリ！", image: "/stickers/mc-chicken.png", category: "minecraft", rarity: "normal" },
  { kind: "sticker", id: "mc-drowned", label: "ドラウンド", message: "ドラウンド！", image: "/stickers/mc-drowned.png", category: "minecraft", rarity: "rare" },
  { kind: "sticker", id: "mc-spider", label: "クモ", message: "クモ！", image: "/stickers/mc-spider.png", category: "minecraft", rarity: "normal" },
  { kind: "sticker", id: "lr-rengoku", label: "れんごく", message: "心を燃やせ！煉獄さん伝説！", image: "/stickers/lr-rengoku.gif", category: "kimitsu", rarity: "legendary", imageFit: "cover" },
  { kind: "sticker", id: "lr-tanjiro", label: "たんじろう", message: "たんじろう伝説！", image: "/stickers/lr-tanjiro.gif", category: "kimitsu", rarity: "legendary", imageFit: "cover" },
  { kind: "sticker", id: "lr-zenitu", label: "ぜんいつ", message: "ぜんいつ伝説！", image: "/stickers/lr-zenitu.gif", category: "kimitsu", rarity: "legendary", imageFit: "cover" },
  { kind: "sticker", id: "lr-tengen", label: "LR宇髄天元", message: "宇髄天元伝説！", image: "/stickers/lr-tengen.gif", category: "kimitsu", rarity: "legendary", imageFit: "cover" },
  { kind: "sticker", id: "lr-inosuke", label: "LR伊之助", message: "伊之助伝説！", image: "/stickers/lr-inosuke.gif", category: "kimitsu", rarity: "legendary", imageFit: "cover" },
  { kind: "sticker", id: "lr-tanjiro2", label: "たんじろう", message: "ヒノカミ神楽！たんじろう伝説！", image: "/stickers/lr-tanjiro2.gif", category: "kimitsu", rarity: "legendary", imageFit: "cover" },
  { kind: "sticker", id: "lr-zenitsu2", label: "ぜんいつ", message: "霹靂一閃！ぜんいつ伝説！", image: "/stickers/lr-zenitsu2.gif", category: "kimitsu", rarity: "legendary", imageFit: "cover" },
  { kind: "sticker", id: "lr-tengen2", label: "てんげん", message: "派手に行くぜ！天元伝説！", image: "/stickers/lr-tengen2.gif", category: "kimitsu", rarity: "legendary", imageFit: "cover" },
  { kind: "sticker", id: "lr-himejima", label: "ぎょうめい", message: "岩柱！ぎょうめい伝説！", image: "/stickers/lr-himejima.gif", category: "kimitsu", rarity: "legendary", imageFit: "cover" },
  { kind: "sticker", id: "lr-mitsuri", label: "みつり", message: "恋柱！みつり伝説！", image: "/stickers/lr-mitsuri.gif", category: "kimitsu", rarity: "legendary", imageFit: "cover" },
  { kind: "sticker", id: "lr-muichiro", label: "むいちろう", message: "霞柱！むいちろう伝説！", image: "/stickers/lr-muichiro.gif", category: "kimitsu", rarity: "legendary", imageFit: "cover" },
  { kind: "sticker", id: "lr-sanemi", label: "さねみ", message: "風柱！さねみ伝説！", image: "/stickers/lr-sanemi.gif", category: "kimitsu", rarity: "legendary", imageFit: "cover" },
  { kind: "sticker", id: "ur-shinobu", label: "しのぶ", message: "蟲柱！しのぶさん！", image: "/stickers/ur-shinobu.gif", category: "kimitsu", rarity: "ultraRare", imageFit: "cover" },
  { kind: "sticker", id: "ur-nezuko", label: "ねずこ", message: "キラキラねずこちゃん！", image: "/stickers/ur-nezuko.gif", category: "kimitsu", rarity: "ultraRare", imageFit: "cover" },
  { kind: "sticker", id: "ur-mitsuri", label: "みつり", message: "みつりちゃん登場！", image: "/stickers/ur-mitsuri.gif", category: "kimitsu", rarity: "ultraRare", imageFit: "cover" },
  { kind: "sticker", id: "sr-muichiro", label: "むいちろう", message: "むいちろうシール！", image: "/stickers/sr-muichiro.gif", category: "kimitsu", rarity: "superRare", imageFit: "cover" },
  { kind: "sticker", id: "lr-gekkouga", label: "ゲッコウガ", message: "ゲッコウガ伝説！", image: "/stickers/lr-gekkouga.gif", category: "pokemon", rarity: "legendary", imageFit: "cover" },
  { kind: "sticker", id: "lr-megarucario", label: "メガルカリオ", message: "メガルカリオ伝説！", image: "/stickers/lr-megarucario.gif", category: "pokemon", rarity: "legendary", imageFit: "cover" },
  { kind: "sticker", id: "ur-fire", label: "ファイヤー", message: "ファイヤー！", image: "/stickers/ur-fire.png", category: "pokemon", rarity: "ultraRare" },
  { kind: "sticker", id: "ur-thunder", label: "サンダー", message: "サンダー！", image: "/stickers/ur-thunder.png", category: "pokemon", rarity: "ultraRare" },
  { kind: "sticker", id: "ur-freezer", label: "フリーザー", message: "フリーザー！", image: "/stickers/ur-freezer.png", category: "pokemon", rarity: "ultraRare" },
  { kind: "sticker", id: "gengar", label: "ゲンガー", message: "ゲンガー！", image: "/stickers/gengar.png", category: "pokemon", rarity: "superRare" },
  { kind: "sticker", id: "dragonite", label: "カイリュー", message: "カイリュー！", image: "/stickers/dragonite.png", category: "pokemon", rarity: "superRare" },
  { kind: "sticker", id: "lucario", label: "ルカリオ", message: "ルカリオ！", image: "/stickers/lucario.png", category: "pokemon", rarity: "superRare" },
  { kind: "sticker", id: "flareon", label: "ブースター", message: "ブースター！", image: "/stickers/flareon.png", category: "pokemon", rarity: "rare" },
  { kind: "sticker", id: "vaporeon", label: "シャワーズ", message: "シャワーズ！", image: "/stickers/vaporeon.png", category: "pokemon", rarity: "rare" },
  { kind: "sticker", id: "jolteon", label: "サンダース", message: "サンダース！", image: "/stickers/jolteon.png", category: "pokemon", rarity: "rare" },
  { kind: "sticker", id: "pikachu", label: "ピカチュウ", message: "ピカチュウ！", image: "/stickers/pikachu.png", category: "pokemon", rarity: "rare" },
  { kind: "sticker", id: "eevee", label: "イーブイ", message: "イーブイ！", image: "/stickers/eevee.png", category: "pokemon", rarity: "rare" },
  { kind: "sticker", id: "poppo", label: "ポッポ", message: "ポッポ！", image: "/stickers/poppo.png", category: "pokemon", rarity: "normal" },
  { kind: "sticker", id: "yadon", label: "ヤドン", message: "ヤドン！", image: "/stickers/yadon.png", category: "pokemon", rarity: "normal" },
  { kind: "sticker", id: "koiking", label: "コイキング", message: "コイキング！", image: "/stickers/koiking.png", category: "pokemon", rarity: "normal" },
  { kind: "sticker", id: "caterpie", label: "キャタピー", message: "キャタピー！", image: "/stickers/caterpie.png", category: "pokemon", rarity: "normal" },
  { kind: "sticker", id: "psyduck", label: "コダック", message: "コダック！", image: "/stickers/psyduck.png", category: "pokemon", rarity: "normal" },
  // 都道府県（01–47・地方サブカテゴリ付き）
  { kind: "sticker", id: "pref-hokkaido", label: "北海道", message: "北海道ゲット！", image: "/stickers/01_hokkaido_LR_v2.png", category: "prefecture", subcategory: "hokkaido-tohoku", rarity: "legendary" },
  { kind: "sticker", id: "pref-aomori", label: "青森", message: "青森ゲット！", image: "/stickers/02_aomori_SR_v2.png", category: "prefecture", subcategory: "hokkaido-tohoku", rarity: "superRare" },
  { kind: "sticker", id: "pref-iwate", label: "岩手", message: "岩手ゲット！", image: "/stickers/03_iwate_N_v2.png", category: "prefecture", subcategory: "hokkaido-tohoku", rarity: "normal" },
  { kind: "sticker", id: "pref-miyagi", label: "宮城", message: "宮城ゲット！", image: "/stickers/04_miyagi_UR_v2.png", category: "prefecture", subcategory: "hokkaido-tohoku", rarity: "ultraRare" },
  { kind: "sticker", id: "pref-akita", label: "秋田", message: "秋田ゲット！", image: "/stickers/05_akita_R_v2.png", category: "prefecture", subcategory: "hokkaido-tohoku", rarity: "rare" },
  { kind: "sticker", id: "pref-yamagata", label: "山形", message: "山形ゲット！", image: "/stickers/06_yamagata_N_v2.png", category: "prefecture", subcategory: "hokkaido-tohoku", rarity: "normal" },
  { kind: "sticker", id: "pref-fukushima", label: "福島", message: "福島ゲット！", image: "/stickers/07_fukushima_R_v2.png", category: "prefecture", subcategory: "hokkaido-tohoku", rarity: "rare" },
  { kind: "sticker", id: "pref-ibaraki", label: "茨城", message: "茨城ゲット！", image: "/stickers/08_ibaraki_N_kanto.png", category: "prefecture", subcategory: "kanto", rarity: "normal" },
  { kind: "sticker", id: "pref-tochigi", label: "栃木", message: "栃木ゲット！", image: "/stickers/09_tochigi_SR_kanto.png", category: "prefecture", subcategory: "kanto", rarity: "superRare" },
  { kind: "sticker", id: "pref-gunma", label: "群馬", message: "群馬ゲット！", image: "/stickers/10_gunma_R_kanto.png", category: "prefecture", subcategory: "kanto", rarity: "rare" },
  { kind: "sticker", id: "pref-saitama", label: "埼玉", message: "埼玉ゲット！", image: "/stickers/11_saitama_R_kanto.png", category: "prefecture", subcategory: "kanto", rarity: "rare" },
  { kind: "sticker", id: "pref-chiba", label: "千葉", message: "千葉ゲット！", image: "/stickers/12_chiba_SR_kanto.png", category: "prefecture", subcategory: "kanto", rarity: "superRare" },
  { kind: "sticker", id: "pref-tokyo", label: "東京", message: "東京ゲット！", image: "/stickers/13_tokyo_LR_kanto.png", category: "prefecture", subcategory: "kanto", rarity: "legendary" },
  { kind: "sticker", id: "pref-kanagawa", label: "神奈川", message: "神奈川ゲット！", image: "/stickers/14_kanagawa_UR_kanto.png", category: "prefecture", subcategory: "kanto", rarity: "ultraRare" },
  { kind: "sticker", id: "pref-niigata", label: "新潟", message: "新潟ゲット！", image: "/stickers/15_niigata_N_tokai-hokushinetsu.png", category: "prefecture", subcategory: "hokushinetsu", rarity: "normal" },
  { kind: "sticker", id: "pref-toyama", label: "富山", message: "富山ゲット！", image: "/stickers/16_toyama_R_tokai-hokushinetsu.png", category: "prefecture", subcategory: "hokushinetsu", rarity: "rare" },
  { kind: "sticker", id: "pref-ishikawa", label: "石川", message: "石川ゲット！", image: "/stickers/17_ishikawa_UR_tokai-hokushinetsu.png", category: "prefecture", subcategory: "hokushinetsu", rarity: "ultraRare" },
  { kind: "sticker", id: "pref-fukui", label: "福井", message: "福井ゲット！", image: "/stickers/18_fukui_SR_tokai-hokushinetsu.png", category: "prefecture", subcategory: "hokushinetsu", rarity: "superRare" },
  { kind: "sticker", id: "pref-yamanashi", label: "山梨", message: "山梨ゲット！", image: "/stickers/19_yamanashi_N_tokai-hokushinetsu.png", category: "prefecture", subcategory: "hokushinetsu", rarity: "normal" },
  { kind: "sticker", id: "pref-nagano", label: "長野", message: "長野ゲット！", image: "/stickers/20_nagano_R_tokai-hokushinetsu.png", category: "prefecture", subcategory: "hokushinetsu", rarity: "rare" },
  { kind: "sticker", id: "pref-gifu", label: "岐阜", message: "岐阜ゲット！", image: "/stickers/21_gifu_R_tokai-hokushinetsu.png", category: "prefecture", subcategory: "tokai", rarity: "rare" },
  { kind: "sticker", id: "pref-shizuoka", label: "静岡", message: "静岡ゲット！", image: "/stickers/22_shizuoka_UR_tokai-hokushinetsu.png", category: "prefecture", subcategory: "tokai", rarity: "ultraRare" },
  { kind: "sticker", id: "pref-aichi", label: "愛知", message: "愛知ゲット！", image: "/stickers/23_aichi_LR_tokai-hokushinetsu.png", category: "prefecture", subcategory: "tokai", rarity: "legendary" },
  { kind: "sticker", id: "pref-mie", label: "三重", message: "三重ゲット！", image: "/stickers/24_mie_SR_tokai-hokushinetsu.png", category: "prefecture", subcategory: "tokai", rarity: "superRare" },
  { kind: "sticker", id: "pref-shiga", label: "滋賀", message: "滋賀ゲット！", image: "/stickers/25_shiga_N_kinki.png", category: "prefecture", subcategory: "kinki", rarity: "normal" },
  { kind: "sticker", id: "pref-kyoto", label: "京都", message: "京都ゲット！", image: "/stickers/26_kyoto_LR_kinki.png", category: "prefecture", subcategory: "kinki", rarity: "legendary" },
  { kind: "sticker", id: "pref-osaka", label: "大阪", message: "大阪ゲット！", image: "/stickers/27_osaka_LR_kinki.png", category: "prefecture", subcategory: "kinki", rarity: "legendary" },
  { kind: "sticker", id: "pref-hyogo", label: "兵庫", message: "兵庫ゲット！", image: "/stickers/28_hyogo_R_kinki.png", category: "prefecture", subcategory: "kinki", rarity: "rare" },
  { kind: "sticker", id: "pref-nara", label: "奈良", message: "奈良ゲット！", image: "/stickers/29_nara_SR_kinki.png", category: "prefecture", subcategory: "kinki", rarity: "superRare" },
  { kind: "sticker", id: "pref-wakayama", label: "和歌山", message: "和歌山ゲット！", image: "/stickers/30_wakayama_N_kinki.png", category: "prefecture", subcategory: "kinki", rarity: "normal" },
  { kind: "sticker", id: "pref-tottori", label: "鳥取", message: "鳥取ゲット！", image: "/stickers/31_tottori_N_chugoku-shikoku.png", category: "prefecture", subcategory: "chugoku", rarity: "normal" },
  { kind: "sticker", id: "pref-shimane", label: "島根", message: "島根ゲット！", image: "/stickers/32_shimane_N_chugoku-shikoku.png", category: "prefecture", subcategory: "chugoku", rarity: "normal" },
  { kind: "sticker", id: "pref-okayama", label: "岡山", message: "岡山ゲット！", image: "/stickers/33_okayama_SR_chugoku-shikoku.png", category: "prefecture", subcategory: "chugoku", rarity: "superRare" },
  { kind: "sticker", id: "pref-hiroshima", label: "広島", message: "広島ゲット！", image: "/stickers/34_hiroshima_UR_chugoku-shikoku.png", category: "prefecture", subcategory: "chugoku", rarity: "ultraRare" },
  { kind: "sticker", id: "pref-yamaguchi", label: "山口", message: "山口ゲット！", image: "/stickers/35_yamaguchi_R_chugoku-shikoku.png", category: "prefecture", subcategory: "chugoku", rarity: "rare" },
  { kind: "sticker", id: "pref-tokushima", label: "徳島", message: "徳島ゲット！", image: "/stickers/36_tokushima_N_chugoku-shikoku.png", category: "prefecture", subcategory: "shikoku", rarity: "normal" },
  { kind: "sticker", id: "pref-kagawa", label: "香川", message: "香川ゲット！", image: "/stickers/37_kagawa_SR_chugoku-shikoku.png", category: "prefecture", subcategory: "shikoku", rarity: "superRare" },
  { kind: "sticker", id: "pref-ehime", label: "愛媛", message: "愛媛ゲット！", image: "/stickers/38_ehime_R_chugoku-shikoku.png", category: "prefecture", subcategory: "shikoku", rarity: "rare" },
  { kind: "sticker", id: "pref-kochi", label: "高知", message: "高知ゲット！", image: "/stickers/39_kochi_UR_chugoku-shikoku.png", category: "prefecture", subcategory: "shikoku", rarity: "ultraRare" },
  { kind: "sticker", id: "pref-fukuoka", label: "福岡", message: "福岡ゲット！", image: "/stickers/40_fukuoka_UR_kyushu-okinawa.png", category: "prefecture", subcategory: "kyushu-okinawa", rarity: "ultraRare" },
  { kind: "sticker", id: "pref-saga", label: "佐賀", message: "佐賀ゲット！", image: "/stickers/41_saga_N_kyushu-okinawa.png", category: "prefecture", subcategory: "kyushu-okinawa", rarity: "normal" },
  { kind: "sticker", id: "pref-nagasaki", label: "長崎", message: "長崎ゲット！", image: "/stickers/42_nagasaki_R_kyushu-okinawa.png", category: "prefecture", subcategory: "kyushu-okinawa", rarity: "rare" },
  { kind: "sticker", id: "pref-kumamoto", label: "熊本", message: "熊本ゲット！", image: "/stickers/43_kumamoto_SR_kyushu-okinawa.png", category: "prefecture", subcategory: "kyushu-okinawa", rarity: "superRare" },
  { kind: "sticker", id: "pref-oita", label: "大分", message: "大分ゲット！", image: "/stickers/44_oita_N_kyushu-okinawa.png", category: "prefecture", subcategory: "kyushu-okinawa", rarity: "normal" },
  { kind: "sticker", id: "pref-miyazaki", label: "宮崎", message: "宮崎ゲット！", image: "/stickers/45_miyazaki_N_kyushu-okinawa.png", category: "prefecture", subcategory: "kyushu-okinawa", rarity: "normal" },
  { kind: "sticker", id: "pref-kagoshima", label: "鹿児島", message: "鹿児島ゲット！", image: "/stickers/46_kagoshima_SR_kyushu-okinawa.png", category: "prefecture", subcategory: "kyushu-okinawa", rarity: "superRare" },
  { kind: "sticker", id: "pref-okinawa", label: "沖縄", message: "沖縄ゲット！", image: "/stickers/47_okinawa_LR_kyushu-okinawa.png", category: "prefecture", subcategory: "kyushu-okinawa", rarity: "legendary" },
];

export const ALL_REWARDS: RewardItem[] = STICKER_REWARDS;
export const TOTAL_REWARD_COUNT = ALL_REWARDS.length;

/** @deprecated TIER_WEIGHTS_DAILY を参照 */
export const STICKER_TIER_WEIGHTS = TIER_WEIGHTS_DAILY;

/** @deprecated TIER_WEIGHTS_SEVEN_DAY を参照 */
export const WEEKLY_HIGH_TIER_WEIGHTS = TIER_WEIGHTS_SEVEN_DAY;

/** @deprecated TIER_WEIGHTS_ONE_OFF_SPECIAL を参照 */
export const ONE_OFF_SPECIAL_TIER_WEIGHTS = TIER_WEIGHTS_ONE_OFF_SPECIAL;

const SPECIAL_MISSION_RARE_PLUS_WEIGHTS: Record<"rare" | "superRare" | "ultraRare" | "legendary", number> = {
  rare: 0.56,
  superRare: 0.31,
  ultraRare: 0.12,
  legendary: 0.01,
};

const SPECIAL_MISSION_SR_PLUS_WEIGHTS: Record<"superRare" | "ultraRare" | "legendary", number> = {
  superRare: 0.67,
  ultraRare: 0.30,
  legendary: 0.03,
};

const ONE_OFF_SPECIAL_SR_PLUS_WEIGHTS: Record<"superRare" | "ultraRare" | "legendary", number> = {
  superRare: 0.81,
  ultraRare: 0.18,
  legendary: 0.01,
};

export interface RewardLookupEntry {
  label: string;
  category: RewardCategory;
  rarity: RewardRarity;
  image: string;
  imageFit?: "contain" | "cover";
}

export const REWARD_LOOKUP: Record<string, RewardLookupEntry> = Object.fromEntries(
  ALL_REWARDS.map((r) => [
    r.id,
    { label: r.label, category: r.category, rarity: r.rarity, image: r.image, imageFit: r.imageFit },
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

/** レア度内は所持・未所持を問わず均等抽選 */
function pickFromStickerTier(_collectedIds: string[], tier: StickerRarity): StickerReward {
  const inTier = STICKER_REWARDS.filter((r) => r.rarity === tier);
  if (inTier.length === 0) return pickStickerReward();
  return pickRandom(inTier);
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

export function loadStickerAlbum(childId?: string | null): string[] {
  try {
    const raw = localStorage.getItem(stickerAlbumKey(childId));
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return dedupeStickerIds(parsed as string[]);
    }
  } catch { /* ignore */ }
  return [];
}

export function saveStickerAlbum(ids: string[], childId?: string | null): void {
  const deduped = dedupeStickerIds(ids);
  localStorage.setItem(stickerAlbumKey(childId), JSON.stringify(deduped));
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

export interface AlbumSubcategoryGroup {
  id: string;
  label: string;
  rewards: RewardItem[];
  collectedCount: number;
  totalCount: number;
}

export interface AlbumCategoryGroup {
  category: RewardCategory;
  label: string;
  rewards: RewardItem[];
  collectedCount: number;
  totalCount: number;
  /** 都道府県など、カテゴリ内の地方見出し */
  subgroups?: AlbumSubcategoryGroup[];
}

function compareRewardsByRarityDesc(a: RewardItem, b: RewardItem): number {
  const rankDiff = RARITY_META[b.rarity].rank - RARITY_META[a.rarity].rank;
  if (rankDiff !== 0) return rankDiff;
  return a.label.localeCompare(b.label, "ja");
}

/** 都道府県は定義順（県番号順）を維持 */
function buildPrefectureSubgroups(
  rewards: RewardItem[],
  collected: Set<string>,
): AlbumSubcategoryGroup[] {
  return PREFECTURE_SUBCATEGORIES.map((sub) => {
    const subRewards = rewards.filter(
      (r) => r.kind === "sticker" && r.subcategory === sub.id,
    );
    return {
      id: sub.id,
      label: sub.label,
      rewards: subRewards,
      collectedCount: subRewards.filter((r) => collected.has(r.id)).length,
      totalCount: subRewards.length,
    };
  }).filter((g) => g.totalCount > 0);
}

export function getAlbumCategoryGroups(collectedIds: string[]): AlbumCategoryGroup[] {
  const collected = new Set(dedupeStickerIds(collectedIds));
  return STICKER_CATEGORIES.map((cat) => {
    const categoryRewards = ALL_REWARDS.filter((r) => r.category === cat.id);
    const isPrefecture = cat.id === "prefecture";
    const rewards = isPrefecture
      ? categoryRewards
      : [...categoryRewards].sort(compareRewardsByRarityDesc);
    const subgroups = isPrefecture
      ? buildPrefectureSubgroups(rewards, collected)
      : undefined;
    return {
      category: cat.id,
      label: cat.label,
      rewards,
      collectedCount: rewards.filter((r) => collected.has(r.id)).length,
      totalCount: rewards.length,
      subgroups,
    };
  });
}

/** 全シールから均等抽選（所持・未所持は問わない） */
export function pickStickerReward(_collectedIds?: string[]): StickerReward {
  return pickRandom(STICKER_REWARDS);
}

export function pickDailyReward(collectedIds: string[]): StickerReward {
  return pickFromStickerTiers(collectedIds, TIER_WEIGHTS_DAILY);
}

export function pickFullDayBonusReward(collectedIds: string[]): StickerReward {
  return pickFromStickerTier(collectedIds, rollWeightedTier(TIER_WEIGHTS_FULL_DAY));
}

export function pickThreeDayReward(collectedIds: string[]): StickerReward {
  return pickFromStickerTier(collectedIds, rollWeightedTier(TIER_WEIGHTS_THREE_DAY));
}

export function pickDeadlineReward(
  collectedIds: string[],
  rewardFloor: SpecialRewardFloor = "rare",
): StickerReward {
  if (rewardFloor === "ultraRare") {
    return pickFromStickerTier(collectedIds, rollWeightedTier(TIER_WEIGHTS_DEADLINE_UR_PLUS));
  }
  const tier = rewardFloor === "superRare"
    ? rollWeightedTier(TIER_WEIGHTS_DEADLINE_SR_PLUS)
    : rollWeightedTier(TIER_WEIGHTS_DEADLINE_RARE_PLUS);
  return pickFromStickerTier(collectedIds, tier);
}

export function pickSpecialMissionReward(
  collectedIds: string[],
  rewardFloor: SpecialRewardFloor = "rare",
): StickerReward {
  if (rewardFloor === "ultraRare") {
    return pickFromStickerTier(collectedIds, rollWeightedTier(TIER_WEIGHTS_ONE_OFF_SPECIAL_UR_PLUS));
  }
  if (rewardFloor === "superRare") {
    return pickFromStickerTier(collectedIds, rollWeightedTier(SPECIAL_MISSION_SR_PLUS_WEIGHTS));
  }
  return pickFromStickerTier(collectedIds, rollWeightedTier(SPECIAL_MISSION_RARE_PLUS_WEIGHTS));
}

export function pickOneOffSpecialReward(
  collectedIds: string[],
  rewardFloor: SpecialRewardFloor = "rare",
): StickerReward {
  if (rewardFloor === "ultraRare") {
    return pickFromStickerTier(collectedIds, rollWeightedTier(TIER_WEIGHTS_ONE_OFF_SPECIAL_UR_PLUS));
  }
  const tier = rewardFloor === "superRare"
    ? rollWeightedTier(ONE_OFF_SPECIAL_SR_PLUS_WEIGHTS)
    : rollWeightedTier(TIER_WEIGHTS_ONE_OFF_SPECIAL);
  return pickFromStickerTier(collectedIds, tier);
}

/** かぶり連続で天井武装する回数 */
export const PITY_DUPLICATE_THRESHOLD = 20;
/** 天井武装時、未所持を引く確率 */
export const PITY_UNCOLLECTED_CHANCE = 0.5;

/** 子ども向け表示名（内部キーは duplicateTokens のまま） */
export const DUPLICATE_TOKEN_LABEL = "ダブりコイン";

/** かぶり時に得られるダブりコイン枚数（レア度別） */
export const DUPLICATE_TOKEN_BY_RARITY: Readonly<Record<RewardRarity, number>> = {
  normal: 1,
  rare: 3,
  superRare: 6,
  ultraRare: 10,
  legendary: 20,
};

export function getDuplicateTokensForRarity(rarity: RewardRarity): number {
  return DUPLICATE_TOKEN_BY_RARITY[rarity] ?? 1;
}

/** ダブりコインで交換できるレア（ノーマルは対象外） */
export type DuplicateTokenExchangeTier = "rare" | "superRare" | "ultraRare" | "legendary";

export const DUPLICATE_TOKEN_EXCHANGE_TIERS: readonly DuplicateTokenExchangeTier[] = [
  "rare", "superRare", "ultraRare", "legendary",
] as const;

/** 案A: R50 / SR90 / UR140 / LR220（ノーマル交換なし） */
export const DUPLICATE_TOKEN_COSTS: Record<DuplicateTokenExchangeTier, number> = {
  rare: 50,
  superRare: 90,
  ultraRare: 140,
  legendary: 220,
};

export function countUncollectedStickersByRarity(
  collectedIds: string[],
  rarity: StickerRarity,
): number {
  const exclude = new Set(dedupeStickerIds(collectedIds));
  return STICKER_REWARDS.filter((r) => r.rarity === rarity && !exclude.has(r.id)).length;
}

export function pickUncollectedByRarity(
  collectedIds: string[],
  rarity: StickerRarity,
): StickerReward | null {
  const exclude = new Set(dedupeStickerIds(collectedIds));
  const pool = STICKER_REWARDS.filter((r) => r.rarity === rarity && !exclude.has(r.id));
  if (pool.length === 0) return null;
  return pickRandom(pool);
}

/** 未所持シールから1枚。minFloor 以上を優先し、無ければ未所持全体 */
export function pickUncollectedReward(
  collectedIds: string[],
  minFloor?: SpecialRewardFloor,
): StickerReward | null {
  const exclude = new Set(dedupeStickerIds(collectedIds));
  let pool = STICKER_REWARDS.filter((r) => !exclude.has(r.id));
  if (pool.length === 0) return null;
  if (minFloor) {
    const minRank = RARITY_META[minFloor].rank;
    const floored = pool.filter((r) => RARITY_META[r.rarity].rank >= minRank);
    if (floored.length > 0) pool = floored;
  }
  return pickRandom(pool);
}

/** 7日連続ごほうび — ウルトラレア以上確定 */
export function pickWeeklyReward(collectedIds: string[]): StickerReward {
  return pickFromStickerTier(collectedIds, rollWeightedTier(TIER_WEIGHTS_SEVEN_DAY));
}

/** 15日連続 — レジェンドレア確定 */
export function pickFifteenDayReward(collectedIds: string[]): StickerReward {
  return pickFromStickerTier(collectedIds, "legendary");
}

/** 30日連続の2枠目 — 未入手UR以上確定（UR→LRの順で未入手、なければ所持込みUR以上） */
export function pickThirtyDayBonusReward(collectedIds: string[]): StickerReward {
  return pickUncollectedByRarity(collectedIds, "ultraRare")
    ?? pickUncollectedByRarity(collectedIds, "legendary")
    ?? pickFromStickerTier(collectedIds, rollWeightedTier(TIER_WEIGHTS_DEADLINE_UR_PLUS));
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

/** カットイン昇格演出用の偽ノーマルシール */
export function pickDecoyNormalReward(): StickerReward {
  const pool = STICKER_REWARDS.filter((r) => r.rarity === "normal");
  return pickRandom(pool.length > 0 ? pool : STICKER_REWARDS);
}

/** LR カットイン用の偽 UR シール */
export function pickDecoyUltraRareReward(): StickerReward {
  const pool = STICKER_REWARDS.filter((r) => r.rarity === "ultraRare");
  return pickRandom(pool);
}

/** 30日連続の抽選スロット（15日は常にLR1枠） */
export type StreakRewardPick = "lrGuaranteed" | "urPlusUncollected";

export function pickTreatReward(
  collectedIds: string[],
  mode: TreatMode,
  options?: {
    rewardFloor?: SpecialRewardFloor;
    forceUncollectedChance?: number;
    streakPick?: StreakRewardPick;
  },
): RewardItem {
  const chance = options?.forceUncollectedChance ?? 0;
  if (chance > 0 && mode !== "weekly" && mode !== "fifteenDayStreak" && mode !== "thirtyDayStreak" && Math.random() < chance) {
    const uncollected = pickUncollectedReward(collectedIds, options?.rewardFloor);
    if (uncollected) return uncollected;
  }
  if (mode === "fullDayBonus") return pickFullDayBonusReward(collectedIds);
  if (mode === "threeDayStreak") return pickThreeDayReward(collectedIds);
  if (mode === "deadline") return pickDeadlineReward(collectedIds, options?.rewardFloor ?? "rare");
  if (mode === "weekly") return pickWeeklyReward(collectedIds);
  if (mode === "fifteenDayStreak") return pickFifteenDayReward(collectedIds);
  if (mode === "thirtyDayStreak") {
    if (options?.streakPick === "urPlusUncollected") return pickThirtyDayBonusReward(collectedIds);
    return pickFifteenDayReward(collectedIds);
  }
  if (mode === "specialMission") return pickSpecialMissionReward(collectedIds, options?.rewardFloor ?? "rare");
  if (mode === "oneOffSpecial") return pickOneOffSpecialReward(collectedIds, options?.rewardFloor ?? "rare");
  return pickDailyReward(collectedIds);
}

export type TreatMode =
  | "daily"
  | "weekly"
  | "fullDayBonus"
  | "threeDayStreak"
  | "deadline"
  | "specialMission"
  | "oneOffSpecial"
  | "fifteenDayStreak"
  | "thirtyDayStreak";
