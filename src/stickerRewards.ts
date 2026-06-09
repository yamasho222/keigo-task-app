export interface StickerReward {
  id: string;
  label: string;
  message: string;
  image: string;
}

/** ごほうびシール（38枚・個人利用） */
export const STICKER_REWARDS: StickerReward[] = [
  { id: "warrior-baby", label: "せんしのあかちゃん", message: "ちびせんしゲット！", image: "/stickers/warrior-baby.png" },
  { id: "blue-fist", label: "ブルーヒーロー", message: "がんばれパンチ！", image: "/stickers/blue-fist.png" },
  { id: "red-point", label: "レッドリーダー", message: "1ばんうえをめざせ！", image: "/stickers/red-point.png" },
  { id: "cyan-jacket", label: "サイバーくん", message: "クールなシール！", image: "/stickers/cyan-jacket.png" },
  { id: "hacker", label: "ハッカーくん", message: "マスターハッカー！", image: "/stickers/hacker.png" },
  { id: "banana-soldier", label: "バナナせんし", message: "バナナパワー全開！", image: "/stickers/banana-soldier.png" },
  { id: "hammer-builder", label: "ハンマーくん", message: "ビルダーゲット！", image: "/stickers/hammer-builder.png" },
  { id: "gold-prince", label: "ゴールド王子", message: "王子様シール！", image: "/stickers/gold-prince.png" },
  { id: "tanjiro", label: "たんじろう", message: "たんじろうが応援！", image: "/stickers/tanjiro.png" },
  { id: "inosuke", label: "いのすけ", message: "いのすけ登場！", image: "/stickers/inosuke.png" },
  { id: "zenitsu", label: "ぜんいつ", message: "ぜんいつが来た！", image: "/stickers/zenitsu.png" },
  { id: "tengen", label: "てんげん", message: "派手なシール！", image: "/stickers/tengen.png" },
  { id: "muichiro", label: "むいちろう", message: "むいちろうゲット！", image: "/stickers/muichiro.png" },
  { id: "sanemi", label: "さねみ", message: "さねみシール！", image: "/stickers/sanemi.png" },
  { id: "akaza", label: "あかざ", message: "強敵シール！", image: "/stickers/akaza.png" },
  { id: "obanai", label: "おばない", message: "おばない登場！", image: "/stickers/obanai.png" },
  { id: "mitsuri", label: "みつり", message: "みつりがお祝い！", image: "/stickers/mitsuri.png" },
  { id: "gyomei", label: "ぎょうめい", message: "ぎょうめいシール！", image: "/stickers/gyomei.png" },
  { id: "rengoku", label: "れんごく", message: "れんごくさん！", image: "/stickers/rengoku.png" },
  { id: "muzan", label: "むざん", message: "ボスキャラシール！", image: "/stickers/muzan.png" },
  { id: "doraemon", label: "ドラえもん", message: "ドラえもんだ！", image: "/stickers/doraemon.png" },
  { id: "nobita", label: "のびた", message: "のびたくん！", image: "/stickers/nobita.png" },
  { id: "suneo", label: "スネ夫", message: "スネ夫ゲット！", image: "/stickers/suneo.png" },
  { id: "gian", label: "ジャイアン", message: "歌のジャイアン！", image: "/stickers/gian.png" },
  { id: "doma", label: "どうま", message: "どうまシール！", image: "/stickers/doma.png" },
  { id: "urokodaki", label: "うろこだきせんせい", message: "判断が遅い！！", image: "/stickers/urokodaki.png" },
  { id: "nezuko", label: "ねずこ", message: "ねずこちゃん！", image: "/stickers/nezuko.png" },
  { id: "sabito", label: "さびと", message: "さびとシール！", image: "/stickers/sabito.png" },
  { id: "daki-gyutaro", label: "だき＆ぎゅうたろう", message: "きょうだいシール！", image: "/stickers/daki-gyutaro.png" },
  { id: "spider-demon", label: "くもおに", message: "くもおに登場！", image: "/stickers/spider-demon.png" },
  { id: "giyu", label: "ぎゆう", message: "ぎゆうさん！", image: "/stickers/giyu.png" },
  { id: "glasses-boy", label: "がんばれくん", message: "がんばれ！", image: "/stickers/glasses-boy.png" },
  { id: "dot-cat", label: "ねこ？", message: "ふしぎなねこ！", image: "/stickers/dot-cat.png" },
  { id: "sakai-dino", label: "サカイだどぉ", message: "サカイだどぉ～！", image: "/stickers/sakai-dino.png" },
  { id: "murata", label: "むらた", message: "むらたがんばれ！", image: "/stickers/murata.png" },
  { id: "yushiro", label: "ゆしろう", message: "ゆしろう登場！", image: "/stickers/yushiro.png" },
  { id: "yoriichi", label: "よりいち", message: "伝説のシール！", image: "/stickers/yoriichi.png" },
  { id: "kokushibo", label: "こくしぼう", message: "上弦のシール！", image: "/stickers/kokushibo.png" },
];

export const REWARD_LOOKUP: Record<string, { label: string; image: string }> = Object.fromEntries(
  STICKER_REWARDS.map((r) => [r.id, { label: r.label, image: r.image }]),
);

export function pickStickerReward(collectedIds: string[]): StickerReward {
  const exclude = new Set(collectedIds);
  const available = STICKER_REWARDS.filter((r) => !exclude.has(r.id));
  const pool = available.length > 0 ? available : STICKER_REWARDS;
  return pool[Math.floor(Math.random() * pool.length)];
}
