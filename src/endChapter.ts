/** エンド章：アイ探索・12はめ・エンドラ。DEV解放は refreshUnlocks 側 */

import { getBuddyEntry, type BuddyProgressMap } from "./buddyProgress";
import type { CombatTier } from "./miningCombat";
import { END_SEARCH_PLACES, END_SEARCH_FINAL_PLACES, END_SEARCH_STOPS, END_ROUTE_VERSION, migrateEndQuest, portalEyeSlots } from "./endJourneyProgress";
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
export const PORTAL_HUNT_STOPS = END_SEARCH_STOPS;

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
    routeVersion: END_ROUTE_VERSION,
    mark: null,
    visited: [],
    fifth: null,
    fifthStreak: 0,
    enderEyeHintVisits: 0,
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
  return migrateEndQuest(state.endQuest ?? emptyEndQuest(), state.unlockedGachas, isHoldingEnderEye(state));
}

/** Assign the first mark at equip/load time, without charging a ticket. */
export function prepareEndSearch(state: MiningState): MiningState {
  const quest = ensureEndQuest(state);
  return quest === state.endQuest ? state : { ...state, endQuest: quest };
}

/** Called once on entering the mining screen, never on opening/reopening its sheets.
 * A short debounce prevents back/open spam from revealing every hint at once.
 */
export function noteEndQuestVisit(state: MiningState, key: string, now: number): MiningState {
  const prepared = prepareEndSearch(state);
  const q = ensureEndQuest(prepared);
  if (!key || !Number.isFinite(now) || (q.routeVersion ?? 0) > END_ROUTE_VERSION || q.foundPortal || isHoldingEnderEye(state) || getMaterialCount(state, "ender_eye") < 1
    || q.hintVisitKey === key || (q.hintVisitAt !== undefined && now >= q.hintVisitAt && now - q.hintVisitAt < 30_000)) return prepared;
  return { ...prepared, endQuest: { ...q, hintVisitKey: key, hintVisitAt: now,
    enderEyeHintVisits: Math.min(7, q.enderEyeHintVisits + 1) } };
}

export function ensureDragonFight(state: MiningState): MiningState {
  const cur = state.dragonFight;
  if (cur && cur.crystals.length === CRYSTAL_COUNT) return state;
  return { ...state, dragonFight: emptyDragonFight() };
}

export function isEndSearchExcluded(gacha: GachaId): boolean {
  return !END_SEARCH_PLACES.includes(gacha);
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
    return state.unlockedGachas.includes(gid) || (gid === "fortress"
      ? state.unlockedGachas.includes("nether") : state.unlockedGachas.includes("fortress"));
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
    && ensureEndQuest(state).enderEyeHintVisits >= 3
    && !ensureEndQuest(state).foundPortal;
}

/** エンダーアイを持ち物に入れるまでの、段階的なヒント文言 */
export function enderEyeHoldHintText(state: MiningState): string {
  const visits = ensureEndQuest(state).enderEyeHintVisits;
  if (visits >= 7) return "そうびの空いているところで、何かが待っている…";
  if (visits >= 5) return "そうびのほうで、ふしぎな気配がする…";
  if (visits >= 3) return "このエンダーアイ、ほりばに来るとそわそわしてる…";
  return "";
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
  if (tier === "jackpot") return 8;
  if (tier === "hit") return 2;
  return 1;
}

function cloneQuest(q: NonNullable<MiningState["endQuest"]>): NonNullable<MiningState["endQuest"]> {
  return {
    ...q,
    visited: [...q.visited],
  };
}

function pickMark(
  unlocked: GachaId[],
  exclude: GachaId[],
  rand: () => number,
): GachaId | null {
  const blocked = new Set(exclude);
  const allowed = exclude.length >= PORTAL_HUNT_STOPS - 1 ? END_SEARCH_FINAL_PLACES : END_SEARCH_PLACES;
  const pool = unlocked.filter((id) => allowed.includes(id) && !blocked.has(id));
  if (pool.length) return pool[Math.floor(rand() * pool.length)] ?? null;
  return null;
}

/**
 * チケット消費後の採掘に付ける（戦闘場所は除外）。
 * アイは減らない。マークは振り直さない。
 */
export function applyEndQuestOnVisit(
  state: MiningState,
  gacha: GachaId,
  rand: () => number = Math.random,
): { state: MiningState; event: EndQuestEvent | null } {
  if (isEndSearchExcluded(gacha)) return { state, event: null };
  if (getMaterialCount(state, "ender_eye") < 1) return { state, event: null };

  state = prepareEndSearch(state);
  const quest = cloneQuest(ensureEndQuest(state));
  if (quest.foundPortal || (quest.routeVersion ?? 0) > END_ROUTE_VERSION) return { state, event: null };

  if (!isHoldingEnderEye(state)) {
    return { state, event: null };
  }
  const unlocked = state.unlockedGachas;

  if (!quest.mark) {
    const place = pickMark(unlocked, quest.visited, rand);
    if (!place) return { state, event: null };
    quest.mark = place;
    return { state: { ...state, endQuest: quest }, event: { kind: "marked", place } };
  }

  if (gacha !== quest.mark) return { state, event: null };

  if (!quest.visited.includes(gacha)) quest.visited.push(gacha);
  const count = quest.visited.length;
  if (count < PORTAL_HUNT_STOPS) {
    quest.mark = pickMark(unlocked, quest.visited, rand);
    return {
      state: { ...state, endQuest: quest },
      event: { kind: "visited", place: gacha, count },
    };
  }

  quest.foundPortal = true;
  quest.fifth = null;
  quest.mark = null;
  quest.fifthStreak = 0;
  return {
    state: { ...state, endQuest: quest },
    event: { kind: "found" },
  };
}

export function insertPortalEye(state: MiningState, slot?: number): { state: MiningState; error?: string; inserted: boolean; completed: boolean } {
  const quest = cloneQuest(ensureEndQuest(state));
  if ((quest.routeVersion ?? 0) > END_ROUTE_VERSION) return { state, inserted: false, completed: false, error: "新しいバージョンで開いてね" };
  if (!quest.foundPortal) return { state, inserted: false, completed: false, error: "まだポータルをみつけてないよ" };
  if (quest.eyes >= END_PORTAL_EYE_SLOTS) {
    return { state: { ...state, endQuest: { ...quest, linked: true } }, inserted: false, completed: true };
  }
  if (getMaterialCount(state, "ender_eye") < 1) {
    return { state, inserted: false, completed: false, error: "エンダーアイがないよ" };
  }
  const slots = portalEyeSlots(quest);
  const target = slot ?? Array.from({ length: 12 }, (_, i) => i).find((i) => !slots.includes(i));
  if (target === undefined || !Number.isInteger(target) || target < 0 || target >= 12 || slots.includes(target)) {
    return { state, inserted: false, completed: false, error: "空いている枠をえらんでね" };
  }
  const materials = { ...state.materials };
  writeMaterialCount(materials, "ender_eye", getMaterialCount(state, "ender_eye") - 1);
  quest.eyes += 1;
  quest.eyeSlots = [...slots, target];
  quest.lastEyeSlot = target;
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
  if ((quest.routeVersion ?? 0) > END_ROUTE_VERSION) return { state, error: "新しいバージョンで開いてね" };
  if (!quest.linked && quest.eyes < END_PORTAL_EYE_SLOTS) {
    return { state, error: "アイを12こはめてから入るよ" };
  }
  quest.linked = true;
  quest.theEndUnlocked = true;
  quest.eyes = END_PORTAL_EYE_SLOTS;
  quest.eyeSlots = Array.from({ length: END_PORTAL_EYE_SLOTS }, (_, i) => i);
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
  consumeTicket?: boolean;
  attackNumber?: number;
  useSpecial?: boolean;
}): DragonAttackResult | { error: string } {
  const state = ensureDragonFight(
    params.dateKey ? syncPlayerHpForDate(params.state, params.dateKey) : params.state,
  );
  const fight = state.dragonFight!;
  if (fight.defeated || fight.hp <= 0) return { error: "もうたおしたよ" };
  if (state.tickets < 1 && params.consumeTicket !== false) return { error: "チケットが足りないよ" };
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
      tickets: Math.max(0, state.tickets - (params.consumeTicket === false ? 0 : 1)),
      materials,
      dragonFight: {
        crystals: [...fight.crystals],
        hp,
        defeated,
      },
    };
    if (defeated) next = { ...next, crafted: { ...next.crafted, elytra: true } };
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
  const fullDamage = dragonHitDamage(state, params.buddyProgress);
  const roundedPer = Math.max(
    1,
    params.attackNumber && params.attackNumber % 2 === 1
      ? Math.ceil(fullDamage / 2)
      : Math.floor(fullDamage / 2),
  );
  const damage = roundedPer * swings;
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
  const crafted = defeated ? { ...state.crafted, elytra: true } : state.crafted;
  let next: MiningState = {
    ...state,
    tickets: Math.max(0, state.tickets - (params.consumeTicket === false ? 0 : 1)),
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
  const state = ensureDragonFight(
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
  if (defeated) next = { ...next, crafted: { ...next.crafted, elytra: true } };
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
    case "found":
      return "ピカーン！エンドポータルをみつけた！";
  }
}

export function describeEndQuestChange(before: MiningState, after: MiningState): string | null {
  const b = ensureEndQuest(before);
  const a = ensureEndQuest(after);
  if (!b.foundPortal && a.foundPortal) return endQuestToast({ kind: "found" });
  if (a.visited.length > b.visited.length) {
    const place = a.visited[a.visited.length - 1];
    if (place) return endQuestToast({ kind: "visited", place, count: a.visited.length });
  }
  if (!b.mark && a.mark) return endQuestToast({ kind: "marked", place: a.mark });
  return null;
}
