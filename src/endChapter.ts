/** エンド章：アイ探索・12はめ・エンドラ。DEV解放は refreshUnlocks 側 */

import { getBuddyEntry, type BuddyProgressMap } from "./buddyProgress";
import { isEndChapterDevEnabled, type CombatTier } from "./miningCombat";
import {
  applyEnemyCounter,
  canPlayerFight,
  chargeSpecialGauge,
  nextDragonHeavy,
  specialDamageFromTaps,
  SPECIAL_GAUGE_MAX,
  specialGaugeOf,
  syncPlayerHpForDate,
  withSpecialGauge,
} from "./playerCombat";
import {
  GACHA_META,
  getMaterialCount,
  parseToolId,
  writeMaterialCount,
  type CraftedGearId,
  type GachaId,
  type GearTier,
  type MiningState,
} from "./miningTypes";

export const END_PORTAL_EYE_SLOTS = 12;
export const DRAGON_MAX_HP = 2000;
export const CRYSTAL_COUNT = 8;
export const CRYSTAL_MAX_HP = 16;
export const CRYSTAL_HEAL_PER = 5;
export const BED_EXPLOSION_DAMAGE = 100;
export const PORTAL_HUNT_STOPS = 4;
export const FIFTH_STREAK_NEED = 3;

const SWORD_DAMAGE: Record<GearTier, number> = {
  wood: 4,
  stone: 5,
  iron: 6,
  gold: 4,
  diamond: 7,
  netherite: 8,
};

export type EndQuestEvent =
  | { kind: "marked"; place: GachaId }
  | { kind: "visited"; place: GachaId; count: number }
  | { kind: "fifth_ready"; place: GachaId }
  | { kind: "fifth_hit"; streak: number }
  | { kind: "fifth_reset" }
  | { kind: "found" };

export type DragonTarget = "dragon" | number;

export type DragonAttackResult = {
  state: MiningState;
  swings: number;
  damage: number;
  heal: number;
  target: DragonTarget;
  usedBed: boolean;
  defeated: boolean;
  crystalDestroyed: boolean;
  takenHearts: number;
  playerDied: boolean;
  countered: boolean;
  heavy: boolean;
  usedSpecial?: boolean;
};

export function emptyEndQuest(): NonNullable<MiningState["endQuest"]> {
  return {
    mark: null,
    visited: [],
    fifth: null,
    fifthStreak: 0,
    foundPortal: false,
    eyes: 0,
    linked: false,
    theEndUnlocked: false,
  };
}

export function emptyDragonFight(): NonNullable<MiningState["dragonFight"]> {
  return {
    crystals: Array.from({ length: CRYSTAL_COUNT }, () => CRYSTAL_MAX_HP),
    hp: DRAGON_MAX_HP,
    defeated: false,
  };
}

export function ensureEndQuest(state: MiningState): NonNullable<MiningState["endQuest"]> {
  return state.endQuest ?? emptyEndQuest();
}

export function ensureDragonFight(state: MiningState): MiningState {
  const cur = state.dragonFight;
  if (cur && cur.crystals.length === CRYSTAL_COUNT) {
    if (!cur.defeated && cur.hp === 1400) {
      return { ...state, dragonFight: { ...cur, hp: DRAGON_MAX_HP } };
    }
    return state;
  }
  return { ...state, dragonFight: emptyDragonFight() };
}

export function isEndSearchExcluded(gacha: GachaId): boolean {
  return gacha === "end_portal" || gacha === "the_end";
}

export function isEndChapterPlace(gacha: GachaId): boolean {
  return (
    gacha === "warped_forest"
    || gacha === "fortress"
    || gacha === "end_portal"
    || gacha === "the_end"
  );
}

export function isEndPortalGacha(gacha: GachaId): boolean {
  return gacha === "end_portal";
}

export function isTheEndGacha(gacha: GachaId): boolean {
  return gacha === "the_end";
}

/** ほりば一覧に出すか。エンドポータル／ジ・エンドは解放するまで出さない */
export function listsMiningDestination(state: MiningState, gid: GachaId): boolean {
  if (gid === "end_portal" || gid === "the_end") {
    return state.unlockedGachas.includes(gid);
  }
  if (gid === "warped_forest" || gid === "fortress") {
    return isEndChapterDevEnabled();
  }
  return true;
}

/** 持ち物スロットにエンダーアイを入れている */
export function isHoldingEnderEye(state: MiningState): boolean {
  return state.equipped.held === "ender_eye" && getMaterialCount(state, "ender_eye") >= 1;
}

/** ほりばにポータル探しのヒント（アイ画像）を出す */
export function showsEndHuntHint(state: MiningState): boolean {
  return isHoldingEnderEye(state) && !ensureEndQuest(state).foundPortal;
}

/** アイは持っているが、そうびの持ち物に入れてないときの案内 */
export function showsEnderEyeHoldHint(state: MiningState): boolean {
  return getMaterialCount(state, "ender_eye") >= 1
    && !isHoldingEnderEye(state)
    && !ensureEndQuest(state).foundPortal;
}

function bestSword(state: MiningState): CraftedGearId | null {
  const tiers: GearTier[] = ["netherite", "diamond", "gold", "iron", "stone", "wood"];
  for (const tier of tiers) {
    const id = `sword_${tier}` as CraftedGearId;
    if (state.crafted[id]) return id;
  }
  return null;
}

export function dragonSwordDamage(state: MiningState): number {
  const parsed = parseToolId(bestSword(state));
  if (!parsed || parsed.kind !== "sword") return 0;
  return SWORD_DAMAGE[parsed.tier];
}

/** なかま1人 floor(Lv × 3 / 10)。Lv1–3 は +0 */
export function partyDragonBonus(
  state: MiningState,
  buddyProgress?: BuddyProgressMap,
): number {
  let sum = 0;
  for (const id of state.partyIds) {
    if (!id) continue;
    const lv = getBuddyEntry(buddyProgress, id).level;
    sum += Math.floor(lv * 3 / 10);
  }
  return sum;
}

export function dragonHitDamage(
  state: MiningState,
  buddyProgress?: BuddyProgressMap,
): number {
  return dragonSwordDamage(state) + partyDragonBonus(state, buddyProgress);
}

export function dragonSwings(tier: CombatTier): number {
  if (tier === "jackpot") return 5;
  if (tier === "hit") return 3;
  return 1;
}

function cloneQuest(q: NonNullable<MiningState["endQuest"]>): NonNullable<MiningState["endQuest"]> {
  return {
    ...q,
    visited: [...q.visited],
  };
}

function huntPool(unlocked: GachaId[]): GachaId[] {
  return unlocked.filter((id) => !isEndSearchExcluded(id));
}

function pickMark(
  unlocked: GachaId[],
  exclude: GachaId[],
  rand: () => number,
): GachaId | null {
  const blocked = new Set(exclude);
  const pool = huntPool(unlocked).filter((id) => !blocked.has(id));
  if (pool.length) return pool[Math.floor(rand() * pool.length)] ?? null;
  const fallback = huntPool(unlocked);
  if (!fallback.length) return null;
  return fallback[Math.floor(rand() * fallback.length)] ?? null;
}

/**
 * チケット消費後のほり／戦闘に付ける。
 * アイは減らない。マークは振り直さない。
 */
export function applyEndQuestOnVisit(
  state: MiningState,
  gacha: GachaId,
  rand: () => number = Math.random,
): { state: MiningState; event: EndQuestEvent | null } {
  if (isEndSearchExcluded(gacha)) return { state, event: null };
  if (getMaterialCount(state, "ender_eye") < 1) return { state, event: null };

  const quest = cloneQuest(ensureEndQuest(state));
  if (quest.foundPortal) return { state, event: null };

  const unlocked = state.unlockedGachas;

  if (quest.visited.length >= PORTAL_HUNT_STOPS && quest.fifth && !quest.foundPortal) {
    if (gacha === quest.fifth) {
      quest.fifthStreak += 1;
      if (quest.fifthStreak >= FIFTH_STREAK_NEED) {
        quest.foundPortal = true;
        quest.mark = null;
        quest.fifth = null;
        quest.fifthStreak = 0;
        return { state: { ...state, endQuest: quest }, event: { kind: "found" } };
      }
      return {
        state: { ...state, endQuest: quest },
        event: { kind: "fifth_hit", streak: quest.fifthStreak },
      };
    }
    if (quest.fifthStreak > 0) {
      quest.fifthStreak = 0;
      return { state: { ...state, endQuest: quest }, event: { kind: "fifth_reset" } };
    }
    return { state, event: null };
  }

  if (!quest.mark) {
    const place = pickMark(unlocked, [gacha, ...quest.visited], rand);
    if (!place) return { state, event: null };
    quest.mark = place;
    return { state: { ...state, endQuest: quest }, event: { kind: "marked", place } };
  }

  if (gacha !== quest.mark) return { state, event: null };

  if (!quest.visited.includes(gacha)) quest.visited.push(gacha);
  const count = quest.visited.length;
  if (count < PORTAL_HUNT_STOPS) {
    quest.mark = pickMark(unlocked, [...quest.visited, gacha], rand);
    return {
      state: { ...state, endQuest: quest },
      event: { kind: "visited", place: gacha, count },
    };
  }

  const fifth = pickMark(unlocked, [...quest.visited, gacha], rand);
  quest.fifth = fifth;
  quest.mark = fifth;
  quest.fifthStreak = 0;
  return {
    state: { ...state, endQuest: quest },
    event: fifth ? { kind: "fifth_ready", place: fifth } : { kind: "visited", place: gacha, count },
  };
}

export function insertPortalEye(state: MiningState): { state: MiningState; error?: string; inserted: boolean; completed: boolean } {
  const quest = cloneQuest(ensureEndQuest(state));
  if (!quest.foundPortal) return { state, inserted: false, completed: false, error: "まだポータルをみつけてないよ" };
  if (quest.eyes >= END_PORTAL_EYE_SLOTS) {
    return { state: { ...state, endQuest: { ...quest, linked: true } }, inserted: false, completed: true };
  }
  if (getMaterialCount(state, "ender_eye") < 1) {
    return { state, inserted: false, completed: false, error: "エンダーアイがないよ" };
  }
  const materials = { ...state.materials };
  writeMaterialCount(materials, "ender_eye", getMaterialCount(state, "ender_eye") - 1);
  quest.eyes += 1;
  const completed = quest.eyes >= END_PORTAL_EYE_SLOTS;
  if (completed) quest.linked = true;
  return {
    state: { ...state, materials, endQuest: quest },
    inserted: true,
    completed,
  };
}

export function unlockTheEnd(state: MiningState): { state: MiningState; error?: string } {
  const quest = cloneQuest(ensureEndQuest(state));
  if (!quest.linked && quest.eyes < END_PORTAL_EYE_SLOTS) {
    return { state, error: "アイを12こはめてから入るよ" };
  }
  quest.linked = true;
  quest.theEndUnlocked = true;
  quest.eyes = END_PORTAL_EYE_SLOTS;
  return { state: { ...state, endQuest: quest } };
}

export function livingCrystalCount(fight: NonNullable<MiningState["dragonFight"]>): number {
  return fight.crystals.filter((hp) => hp > 0).length;
}

/** 壊した結晶の次（時計回り）に生きている結晶。全滅なら本体 */
export function nextLivingCrystal(crystals: number[], destroyedIndex: number): DragonTarget {
  const n = crystals.length;
  if (n < 1) return "dragon";
  const start = Math.max(0, Math.min(n - 1, Math.floor(destroyedIndex)));
  for (let k = 1; k <= n; k++) {
    const i = (start + k) % n;
    if ((crystals[i] ?? 0) > 0) return i;
  }
  return "dragon";
}

export function resolveDragonAttack(params: {
  state: MiningState;
  target: DragonTarget;
  tier?: CombatTier;
  useBed?: boolean;
  buddyProgress?: BuddyProgressMap;
  dateKey?: string;
  skipCounter?: boolean;
  useSpecial?: boolean;
}): DragonAttackResult | { error: string } {
  let state = ensureDragonFight(
    params.dateKey ? syncPlayerHpForDate(params.state, params.dateKey) : params.state,
  );
  const fight = state.dragonFight!;
  if (fight.defeated || fight.hp <= 0) return { error: "もうたおしたよ" };
  if (state.tickets < 1) return { error: "チケットが足りないよ" };
  if (!canPlayerFight(state)) return { error: "倒れているよ。チケットで起き上がろう" };
  if (params.useSpecial && specialGaugeOf(state) < SPECIAL_GAUGE_MAX) {
    return { error: "必殺がまだたまってないよ" };
  }

  if (params.useBed) {
    if (getMaterialCount(state, "spare_bed") < 1) return { error: "ベッドがないよ" };
    const materials = { ...state.materials };
    writeMaterialCount(materials, "spare_bed", getMaterialCount(state, "spare_bed") - 1);
    const hp = Math.max(0, fight.hp - BED_EXPLOSION_DAMAGE);
    const defeated = hp <= 0;
    let next: MiningState = {
      ...state,
      tickets: state.tickets - 1,
      materials,
      dragonFight: {
        crystals: [...fight.crystals],
        hp,
        defeated,
      },
    };
    const counter = defeated || params.skipCounter ? null : applyDragonCounter(next);
    if (counter) next = counter.state;
    return {
      state: next,
      swings: 0,
      damage: BED_EXPLOSION_DAMAGE,
      heal: 0,
      target: "dragon",
      usedBed: true,
      defeated,
      crystalDestroyed: false,
      takenHearts: counter?.takenHearts ?? 0,
      playerDied: counter?.died ?? false,
      countered: !!counter,
      heavy: counter?.heavy ?? false,
    };
  }

  if (dragonSwordDamage(state) <= 0) return { error: "剣を作ってからたたこう" };
  const tier = params.tier ?? "normal";
  const swings = dragonSwings(tier);
  const per = dragonHitDamage(state, params.buddyProgress);
  const damage = per * swings;
  const crystals = [...fight.crystals];
  let hp = fight.hp;
  let heal = 0;
  let crystalDestroyed = false;

  if (params.target === "dragon") {
    hp = Math.max(0, hp - damage);
    if (hp > 0) {
      heal = livingCrystalCount({ ...fight, crystals }) * CRYSTAL_HEAL_PER;
      hp = Math.min(DRAGON_MAX_HP, hp + heal);
    }
  } else {
    const i = Math.max(0, Math.min(CRYSTAL_COUNT - 1, Math.floor(params.target)));
    const before = crystals[i] ?? 0;
    if (before <= 0) return { error: "その結晶はもうないよ" };
    crystals[i] = Math.max(0, before - damage);
    crystalDestroyed = crystals[i] === 0;
  }

  const defeated = hp <= 0;
  const crafted = state.crafted;
  let next: MiningState = {
    ...state,
    tickets: state.tickets - 1,
    crafted,
    dragonFight: { crystals, hp, defeated },
  };
  next = params.useSpecial ? withSpecialGauge(next, 0) : chargeSpecialGauge(next);
  const counter = defeated || params.skipCounter ? null : applyDragonCounter(next);
  if (counter) next = counter.state;
  return {
    state: next,
    swings,
    damage,
    heal,
    target: params.target,
    usedBed: false,
    defeated,
    crystalDestroyed,
    takenHearts: counter?.takenHearts ?? 0,
    playerDied: counter?.died ?? false,
    countered: !!counter,
    heavy: counter?.heavy ?? false,
    usedSpecial: !!params.useSpecial,
  };
}

export function applyDragonSpecialFinish(params: {
  state: MiningState;
  target: DragonTarget;
  taps: number;
  buddyProgress?: BuddyProgressMap;
  dateKey?: string;
}): DragonAttackResult | { error: string } {
  let state = ensureDragonFight(
    params.dateKey ? syncPlayerHpForDate(params.state, params.dateKey) : params.state,
  );
  const fight = state.dragonFight!;
  if (fight.defeated || fight.hp <= 0) {
    return {
      state,
      swings: 0,
      damage: 0,
      heal: 0,
      target: params.target,
      usedBed: false,
      defeated: true,
      crystalDestroyed: false,
      takenHearts: 0,
      playerDied: false,
      countered: false,
      heavy: false,
      usedSpecial: true,
    };
  }
  const taps = Math.max(0, Math.floor(params.taps));
  const extra = specialDamageFromTaps(taps);
  const crystals = [...fight.crystals];
  let hp = fight.hp;
  let crystalDestroyed = false;
  if (params.target === "dragon") {
    hp = Math.max(0, hp - extra);
  } else {
    const i = Math.max(0, Math.min(CRYSTAL_COUNT - 1, Math.floor(params.target)));
    const before = crystals[i] ?? 0;
    crystals[i] = Math.max(0, before - extra);
    crystalDestroyed = before > 0 && crystals[i] === 0;
  }
  const defeated = hp <= 0;
  let next: MiningState = {
    ...state,
    dragonFight: { crystals, hp, defeated },
  };
  const counter = defeated ? null : applyDragonCounter(next);
  if (counter) next = counter.state;
  return {
    state: next,
    swings: Math.min(3, Math.max(1, taps)),
    damage: extra,
    heal: 0,
    target: params.target,
    usedBed: false,
    defeated,
    crystalDestroyed,
    takenHearts: counter?.takenHearts ?? 0,
    playerDied: counter?.died ?? false,
    countered: !!counter,
    heavy: counter?.heavy ?? false,
    usedSpecial: true,
  };
}

function applyDragonCounter(state: MiningState) {
  const { heavy, seq } = nextDragonHeavy(state);
  const hit = applyEnemyCounter({ ...state, dragonRageSeq: seq }, "dragon", heavy);
  return { ...hit, state: { ...hit.state, dragonRageSeq: seq }, heavy };
}

export function endQuestToast(event: EndQuestEvent | null): string | null {
  if (!event) return null;
  switch (event.kind) {
    case "marked":
      return `マークがついた！${GACHA_META[event.place].label}`;
    case "visited":
      return `${event.count}/${PORTAL_HUNT_STOPS} みつけた`;
    case "fifth_ready":
      return `5つ目は${GACHA_META[event.place].label}！連続3回ほろう`;
    case "fifth_hit": {
      const left = FIFTH_STREAK_NEED - event.streak;
      return left <= 0 ? "ポータルをみつけた！" : `あと${left}回！`;
    }
    case "fifth_reset":
      return "連続がリセットされた。5つ目を連続3回ほろう";
    case "found":
      return "ピカーン！エンドポータルをみつけた！";
  }
}

export function describeEndQuestChange(before: MiningState, after: MiningState): string | null {
  const b = ensureEndQuest(before);
  const a = ensureEndQuest(after);
  if (!b.foundPortal && a.foundPortal) return endQuestToast({ kind: "found" });
  if (b.fifthStreak > 0 && a.fifthStreak === 0 && !a.foundPortal && a.fifth) {
    return endQuestToast({ kind: "fifth_reset" });
  }
  if (a.fifthStreak > b.fifthStreak) return endQuestToast({ kind: "fifth_hit", streak: a.fifthStreak });
  if (!b.fifth && a.fifth) return endQuestToast({ kind: "fifth_ready", place: a.fifth });
  if (a.visited.length > b.visited.length) {
    const place = a.visited[a.visited.length - 1];
    if (place) return endQuestToast({ kind: "visited", place, count: a.visited.length });
  }
  if (!b.mark && a.mark) return endQuestToast({ kind: "marked", place: a.mark });
  return null;
}
