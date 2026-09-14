/** DEV限定：歪んだ森／要塞の戦闘 */

import {
  GEAR_IMAGE,
  getMaterialCount,
  parseToolId,
  writeMaterialCount,
  type CraftedGearId,
  type GachaId,
  type GearTier,
  type MaterialId,
  type MiningState,
} from "./miningTypes";
import type { DigResult, HelmetRockHint } from "./miningProgress";
import {
  applyEnemyCounter,
  armorCutPercent,
  canPlayerFight,
  chargeSpecialGauge,
  specialDamageFromTaps,
  SPECIAL_GAUGE_MAX,
  specialGaugeOf,
  syncPlayerHpForDate,
  withSpecialGauge,
} from "./playerCombat";

function bestSword(state: MiningState): CraftedGearId | null {
  const tiers: GearTier[] = ["netherite", "diamond", "gold", "iron", "stone", "wood"];
  for (const tier of tiers) {
    const id = `sword_${tier}` as CraftedGearId;
    if (state.crafted[id]) return id;
  }
  return null;
}

export function isEndChapterDevEnabled(): boolean {
  return import.meta.env.DEV;
}

export type CombatGachaId = "warped_forest" | "fortress";

export function isCombatGacha(gacha: GachaId): gacha is CombatGachaId {
  return gacha === "warped_forest" || gacha === "fortress";
}

export const ENDERMAN_MAX_HP = 40;
export const BLAZE_MAX_HP = 20;

export const HEART_FULL_IMAGE = "/mining/Heart_Full.png";
export const HEART_HALF_IMAGE = "/mining/Heart_Half.png";
export const ENDERMAN_IMAGE = "/mining/Enderman.png";
export const BLAZE_IMAGE = "/mining/Blaze.webp";

export type CombatTier = "normal" | "hit" | "jackpot";

export type CombatMob = {
  hp: number;
};

export type CombatEncounter = {
  mobs: CombatMob[];
  wave?: number;
};

const SWORD_DAMAGE: Record<GearTier, number> = {
  wood: 4,
  stone: 5,
  iron: 6,
  gold: 4,
  diamond: 7,
  netherite: 8,
};

export function combatMaxHp(gacha: CombatGachaId): number {
  return gacha === "warped_forest" ? ENDERMAN_MAX_HP : BLAZE_MAX_HP;
}

export function combatKillDrop(gacha: CombatGachaId): MaterialId {
  return gacha === "warped_forest" ? "ender_pearl" : "blaze_rod";
}

export function combatCommonDrop(gacha: CombatGachaId): MaterialId {
  return gacha === "warped_forest" ? "warped_wart" : "netherrack";
}

export function combatHeartCount(gacha: CombatGachaId): number {
  return combatMaxHp(gacha) / 2;
}

export function livingMobs(encounter: CombatEncounter | undefined): CombatMob[] {
  return (encounter?.mobs ?? []).filter((m) => m.hp > 0);
}

export function freshCombatPair(gacha: CombatGachaId, wave = 0): CombatEncounter {
  const hp = combatMaxHp(gacha);
  return { wave, mobs: [{ hp }, { hp }] };
}

export function nextCombatWave(gacha: CombatGachaId, prevWave = 0): CombatEncounter {
  return freshCombatPair(gacha, prevWave + 1);
}

/** 表示用。倒した体も残す。未開始だけ満タン2体 */
export function visibleCombatEncounter(
  state: MiningState,
  gacha: CombatGachaId,
): CombatEncounter {
  const current = state.combatEncounters?.[gacha];
  if (!current?.mobs.length) return freshCombatPair(gacha, 0);
  return {
    wave: current.wave ?? 0,
    mobs: current.mobs.map((m) => ({ hp: m.hp })),
  };
}

export function ensureCombatEncounter(
  state: MiningState,
  gacha: CombatGachaId,
): CombatEncounter {
  const current = state.combatEncounters?.[gacha];
  if (livingMobs(current).length > 0) {
    return {
      wave: current?.wave ?? 0,
      mobs: (current?.mobs ?? []).map((m) => ({ hp: m.hp })),
    };
  }
  if (current && current.mobs.length > 0) {
    return nextCombatWave(gacha, current.wave ?? 0);
  }
  return freshCombatPair(gacha, 0);
}

/** 全滅したあと、次の2体を出す。生き残りがいるときは死体を残す */
export function settleCombatEncounter(
  state: MiningState,
  gacha: CombatGachaId,
): MiningState {
  const current = state.combatEncounters?.[gacha];
  if (!current?.mobs.length) return state;
  if (livingMobs(current).length > 0) return state;
  return {
    ...state,
    combatEncounters: {
      ...state.combatEncounters,
      [gacha]: nextCombatWave(gacha, current.wave ?? 0),
    },
  };
}

export function shuffleCombatTiers(rand: () => number = Math.random): CombatTier[] {
  const tiers: CombatTier[] = ["normal", "hit", "jackpot"];
  for (let i = tiers.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = tiers[i];
    tiers[i] = tiers[j];
    tiers[j] = tmp;
  }
  return tiers;
}

export function combatSwings(tier: CombatTier): { swings: number; both: boolean } {
  if (tier === "jackpot") return { swings: 4, both: true };
  if (tier === "hit") return { swings: 2, both: true };
  return { swings: 1, both: false };
}

export function combatCommonAmount(tier: CombatTier): number {
  if (tier === "jackpot") return 3;
  if (tier === "hit") return 2;
  return 1;
}

export type CombatResult = DigResult & {
  killed: number[];
  swings: number;
  both: boolean;
  swingDamage: number;
  targets: number[];
  takenHearts: number;
  playerDied: boolean;
  cutPercent: number;
  countered: boolean;
  counterFrom: number[];
  usedSpecial?: boolean;
};

export function swordSwingDamage(state: MiningState, gacha: CombatGachaId): number {
  const sword = bestSword(state);
  const parsed = parseToolId(sword);
  const base = parsed && parsed.kind === "sword" ? SWORD_DAMAGE[parsed.tier] : 0;
  const water =
    gacha === "warped_forest" && state.equipped.held === "water" ? 2 : 0;
  return base + water;
}

export function combatSwordId(state: MiningState): CraftedGearId | null {
  return bestSword(state);
}

export function combatSwordImage(state: MiningState): string {
  const id = combatSwordId(state);
  return (id && GEAR_IMAGE[id]) || "/mining/Diamond_Sword.png";
}

/** 1ハート=HP2。full / half / empty を左から並べる */
export function heartSlots(hp: number, hearts: number): Array<"full" | "half" | "empty"> {
  const maxHp = hearts * 2;
  const clamped = Math.max(0, Math.min(maxHp, Math.floor(hp)));
  const slots: Array<"full" | "half" | "empty"> = [];
  for (let i = 0; i < hearts; i++) {
    const remain = clamped - i * 2;
    if (remain >= 2) slots.push("full");
    else if (remain === 1) slots.push("half");
    else slots.push("empty");
  }
  return slots;
}

export function resolveCombatHelmetHint(
  state: MiningState,
  layout: CombatTier[],
  rand: () => number = Math.random,
): HelmetRockHint {
  const jackpot = layout.indexOf("jackpot");
  const normal = layout.indexOf("normal");
  const id = state.equipped.helmet;
  if (!id || !state.crafted[id]) return { kind: "none" };
  const m = /^helmet_(iron|gold|diamond|netherite)$/.exec(id);
  if (!m) return { kind: "none" };
  const tier = m[1];
  if (tier === "iron") return { kind: "none" };
  if (tier === "netherite" && jackpot >= 0) {
    return { kind: "hit", index: jackpot };
  }
  if (tier === "diamond" && normal >= 0) {
    return { kind: "miss", index: normal };
  }
  if (tier === "gold" && normal >= 0 && rand() < 0.4) {
    return { kind: "miss", index: normal };
  }
  return { kind: "none" };
}

function livingIndexes(mobs: CombatMob[]): number[] {
  return mobs.map((m, i) => (m.hp > 0 ? i : -1)).filter((i) => i >= 0);
}

function weakerIndex(mobs: CombatMob[]): number {
  const living = livingIndexes(mobs);
  let idx = living[0] ?? 0;
  for (const i of living) {
    if (mobs[i].hp < mobs[idx].hp) idx = i;
  }
  return idx;
}

export function resolveCombat(params: {
  state: MiningState;
  gacha: CombatGachaId;
  tier: CombatTier;
  dateKey?: string;
  skipCounter?: boolean;
  useSpecial?: boolean;
}): CombatResult | { error: string } {
  const { gacha, tier } = params;
  if (!isEndChapterDevEnabled()) {
    return { error: "まだひらいてないよ" };
  }
  let state = params.dateKey
    ? syncPlayerHpForDate(params.state, params.dateKey)
    : params.state;
  if (state.tickets < 1) return { error: "チケットが足りないよ" };
  if (!canPlayerFight(state)) return { error: "倒れているよ。チケットで起き上がろう" };
  const sword = combatSwordId(state);
  if (!sword) return { error: "剣を作ってからたたこう" };
  if (params.useSpecial && specialGaugeOf(state) < SPECIAL_GAUGE_MAX) {
    return { error: "必殺がまだたまってないよ" };
  }

  const swingDmg = swordSwingDamage(state, gacha);
  if (swingDmg <= 0) return { error: "剣を作ってからたたこう" };

  let encounter = ensureCombatEncounter(state, gacha);
  const beforeHp = encounter.mobs.map((m) => m.hp);
  const { swings, both } = combatSwings(tier);
  const dmg = swingDmg * swings;
  const living = livingIndexes(encounter.mobs);
  const targets = both ? living : [weakerIndex(encounter.mobs)];

  const killed: number[] = [];
  const mobs = encounter.mobs.map((m) => ({ hp: m.hp }));
  for (const i of targets) {
    mobs[i] = { hp: Math.max(0, mobs[i].hp - dmg) };
    if (beforeHp[i] > 0 && mobs[i].hp <= 0) killed.push(i);
  }
  encounter = { wave: encounter.wave, mobs };

  const materials = { ...state.materials };
  const drops: { material: MaterialId; amount: number }[] = [];
  const addDrop = (material: MaterialId, amount: number) => {
    if (amount <= 0) return;
    writeMaterialCount(materials, material, (materials[material] ?? 0) + amount);
    const existing = drops.find((d) => d.material === material);
    if (existing) existing.amount += amount;
    else drops.push({ material, amount });
  };

  const common = combatCommonAmount(tier);
  addDrop(combatCommonDrop(gacha), common);
  for (let n = 0; n < killed.length; n++) {
    addDrop(combatKillDrop(gacha), 1);
  }

  const breakdown: string[] = [];
  const hitReasons: string[] = [];
  if (tier === "jackpot") {
    breakdown.push("大当たり 2体に4振り");
    hitReasons.push("大当たり");
  } else if (tier === "hit") {
    breakdown.push("あたり 2体に2振り");
    hitReasons.push("あたり");
  } else {
    breakdown.push("普通 1体に1振り");
  }
  breakdown.push(`ダメージ ${dmg}`);
  if (killed.length) {
    breakdown.push(gacha === "warped_forest" ? "パールゲット！" : "棒ゲット！");
    hitReasons.push(gacha === "warped_forest" ? "エンダーパール" : "ブレイズロッド");
  }

  let next: MiningState = {
    ...state,
    tickets: state.tickets - 1,
    materials,
    equipped: { ...state.equipped, tool: sword },
    lastSelectedGacha: gacha,
    combatEncounters: {
      ...state.combatEncounters,
      [gacha]: encounter,
    },
  };
  next = params.useSpecial ? withSpecialGauge(next, 0) : chargeSpecialGauge(next);

  let takenHearts = 0;
  let playerDied = false;
  let countered = false;
  const survivors = livingIndexes(encounter.mobs);
  if (!params.skipCounter && survivors.length > 0) {
    const counter = applyEnemyCounter(
      next,
      gacha === "warped_forest" ? "enderman" : "blaze",
    );
    next = counter.state;
    takenHearts = counter.takenHearts;
    playerDied = counter.died;
    countered = true;
    if (takenHearts > 0) breakdown.push(`反撃 ${takenHearts}`);
    if (playerDied) breakdown.push("倒された！");
  }

  return {
    state: next,
    drops,
    breakdown,
    hitReasons,
    ticketRefunded: false,
    usedTool: sword,
    baseCount: common,
    killed,
    swings,
    both,
    swingDamage: swingDmg,
    targets,
    takenHearts,
    playerDied,
    cutPercent: armorCutPercent(state),
    countered,
    counterFrom: countered ? survivors : [],
    usedSpecial: !!params.useSpecial,
  };
}

export function applyCombatSpecialFinish(params: {
  state: MiningState;
  gacha: CombatGachaId;
  taps: number;
  dateKey?: string;
}): CombatResult | { error: string } {
  const { gacha } = params;
  let state = params.dateKey
    ? syncPlayerHpForDate(params.state, params.dateKey)
    : params.state;
  const sword = combatSwordId(state);
  if (!sword) return { error: "剣を作ってからたたこう" };
  const taps = Math.max(0, Math.floor(params.taps));
  const extra = specialDamageFromTaps(taps);
  let encounter = ensureCombatEncounter(state, gacha);
  const beforeHp = encounter.mobs.map((m) => m.hp);
  const targets = livingIndexes(encounter.mobs);
  const killed: number[] = [];
  const mobs = encounter.mobs.map((m) => ({ hp: m.hp }));
  for (const i of targets) {
    mobs[i] = { hp: Math.max(0, mobs[i].hp - extra) };
    if (beforeHp[i] > 0 && mobs[i].hp <= 0) killed.push(i);
  }
  encounter = { wave: encounter.wave, mobs };
  const materials = { ...state.materials };
  const drops: { material: MaterialId; amount: number }[] = [];
  for (let n = 0; n < killed.length; n++) {
    const mat = combatKillDrop(gacha);
    writeMaterialCount(materials, mat, (materials[mat] ?? 0) + 1);
    const existing = drops.find((d) => d.material === mat);
    if (existing) existing.amount += 1;
    else drops.push({ material: mat, amount: 1 });
  }
  let next: MiningState = {
    ...state,
    materials,
    combatEncounters: {
      ...state.combatEncounters,
      [gacha]: encounter,
    },
  };
  const survivors = livingIndexes(encounter.mobs);
  let takenHearts = 0;
  let playerDied = false;
  let countered = false;
  if (survivors.length > 0) {
    const counter = applyEnemyCounter(
      next,
      gacha === "warped_forest" ? "enderman" : "blaze",
    );
    next = counter.state;
    takenHearts = counter.takenHearts;
    playerDied = counter.died;
    countered = true;
  }
  return {
    state: next,
    drops,
    breakdown: [`必殺 ${taps}タップ ${extra}ダメ`],
    hitReasons: taps > 0 ? ["必殺"] : [],
    ticketRefunded: false,
    usedTool: sword,
    baseCount: 0,
    killed,
    swings: Math.min(3, Math.max(1, taps)),
    both: targets.length > 1,
    swingDamage: extra,
    targets,
    takenHearts,
    playerDied,
    cutPercent: armorCutPercent(state),
    countered,
    counterFrom: countered ? survivors : [],
    usedSpecial: true,
  };
}

export const WARPED_WART_TO_POINTS = 2;

export function exchangeWarpedWartForPoints(
  state: MiningState,
): { state: MiningState; error?: string } {
  const have = getMaterialCount(state, "warped_wart");
  if (have < 1) {
    return { state, error: "ウォートが足りないよ" };
  }
  return {
    state: {
      ...state,
      miningPoints: state.miningPoints + WARPED_WART_TO_POINTS,
      materials: (() => {
        const materials = { ...state.materials };
        writeMaterialCount(materials, "warped_wart", have - 1);
        return materials;
      })(),
    },
  };
}
