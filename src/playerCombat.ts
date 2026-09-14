/** プレイヤーHP・防具軽減・敵の反撃 */

import type { ArmorKind, MiningState } from "./miningTypes";

export const PLAYER_MAX_HEARTS = 10;
export const PLAYER_MAX_HP = PLAYER_MAX_HEARTS * 2;
export const SPECIAL_GAUGE_MAX = 5;
export const SPECIAL_TAP_MS = 10_000;
export const SPECIAL_TAP_DAMAGE = 2;

export type EnemyAttackKind = "blaze" | "enderman" | "dragon";
export type ArmorCombatTier = "iron" | "gold" | "diamond" | "netherite";

const NAKED_ATTACK: Record<EnemyAttackKind, number> = {
  blaze: 2,
  enderman: 3,
  dragon: 5,
};

/** 部位ごとの軽減率。ネザライト4部位で合計1（0ダメ） */
const ARMOR_CUT: Record<ArmorCombatTier, Record<ArmorKind, number>> = {
  gold: { helmet: 0.04, chest: 0.10, leggings: 0.06, boots: 0.02 },
  iron: { helmet: 0.04, chest: 0.12, leggings: 0.10, boots: 0.04 },
  diamond: { helmet: 0.09, chest: 0.24, leggings: 0.18, boots: 0.09 },
  netherite: { helmet: 0.15, chest: 0.40, leggings: 0.30, boots: 0.15 },
};

const ARMOR_SLOTS: ArmorKind[] = ["helmet", "chest", "leggings", "boots"];

export function roundHalfHeart(hearts: number): number {
  return Math.round(hearts * 2) / 2;
}

export function equippedCombatArmorTier(
  state: MiningState,
  slot: ArmorKind,
): ArmorCombatTier | null {
  const id = state.equipped[slot];
  if (!id || !state.crafted[id]) return null;
  const m = new RegExp(`^${slot}_(iron|gold|diamond|netherite)$`).exec(id);
  if (!m) return null;
  return m[1] as ArmorCombatTier;
}

export function armorReductionRate(state: MiningState): number {
  let sum = 0;
  for (const slot of ARMOR_SLOTS) {
    const tier = equippedCombatArmorTier(state, slot);
    if (!tier) continue;
    sum += ARMOR_CUT[tier][slot];
  }
  return Math.min(1, sum);
}

export function armorCutPercent(state: MiningState): number {
  return Math.round(armorReductionRate(state) * 100);
}

export function incomingHearts(
  state: MiningState,
  kind: EnemyAttackKind,
  heavy = false,
): number {
  const atk = NAKED_ATTACK[kind] * (heavy && kind === "dragon" ? 2 : 1);
  return roundHalfHeart(atk * (1 - armorReductionRate(state)));
}

export function playerHpOf(state: MiningState): number {
  const n = Math.floor(Number(state.playerHp));
  if (!Number.isFinite(n)) return PLAYER_MAX_HP;
  return Math.max(0, Math.min(PLAYER_MAX_HP, n));
}

export function canPlayerFight(state: MiningState): boolean {
  return playerHpOf(state) > 0;
}

export function syncPlayerHpForDate(state: MiningState, dateKey: string): MiningState {
  const hp = playerHpOf(state);
  const dated = typeof state.playerHpDate === "string" ? state.playerHpDate : "";
  if (dateKey && dated === dateKey && state.playerHp === hp) return state;
  if (dateKey && dated === dateKey) {
    return { ...state, playerHp: hp, playerHpDate: dateKey };
  }
  if (!dateKey) {
    return { ...state, playerHp: hp, playerHpDate: dated };
  }
  return { ...state, playerHp: PLAYER_MAX_HP, playerHpDate: dateKey };
}

export function specialGaugeOf(state: MiningState): number {
  const n = Math.floor(Number(state.specialGauge));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(SPECIAL_GAUGE_MAX, n));
}

export function withSpecialGauge(state: MiningState, n: number): MiningState {
  return { ...state, specialGauge: Math.max(0, Math.min(SPECIAL_GAUGE_MAX, Math.floor(n))) };
}

export function chargeSpecialGauge(state: MiningState): MiningState {
  return withSpecialGauge(state, specialGaugeOf(state) + 1);
}

export function specialGaugeReady(state: MiningState): boolean {
  return specialGaugeOf(state) >= SPECIAL_GAUGE_MAX;
}

export function specialDamageFromTaps(taps: number): number {
  return Math.max(0, Math.floor(taps)) * SPECIAL_TAP_DAMAGE;
}

export function beginSpecialAttack(
  state: MiningState,
  dateKey?: string,
): { state: MiningState; error?: string } {
  const next = dateKey ? syncPlayerHpForDate(state, dateKey) : state;
  if (next.tickets < 1) return { state: next, error: "チケットが足りないよ" };
  if (!canPlayerFight(next)) return { state: next, error: "倒れているよ。チケットで起き上がろう" };
  if (specialGaugeOf(next) < SPECIAL_GAUGE_MAX) return { state: next, error: "必殺がまだたまってないよ" };
  return {
    state: withSpecialGauge({
      ...next,
      tickets: next.tickets - 1,
      specialHintSeen: true,
    }, 0),
  };
}

export function applyEnemyCounter(
  state: MiningState,
  kind: EnemyAttackKind,
  heavy = false,
): { state: MiningState; takenHearts: number; died: boolean; heavy: boolean } {
  const takenHearts = incomingHearts(state, kind, heavy);
  const takenHp = Math.round(takenHearts * 2);
  const nextHp = Math.max(0, playerHpOf(state) - takenHp);
  const next: MiningState = nextHp <= 0
    ? { ...state, playerHp: nextHp, specialGauge: 0 }
    : { ...state, playerHp: nextHp };
  return {
    state: next,
    takenHearts,
    died: nextHp <= 0,
    heavy,
  };
}

export function nextDragonHeavy(state: MiningState): { heavy: boolean; seq: number } {
  const seq = Math.max(0, Math.floor(Number(state.dragonRageSeq) || 0)) + 1;
  return { heavy: seq % 4 === 0, seq };
}

export function revivePlayer(state: MiningState): { state: MiningState; error?: string } {
  if (playerHpOf(state) > 0) return { state, error: "まだ倒れてないよ" };
  if (state.tickets < 1) return { state, error: "チケットが足りないよ" };
  return {
    state: {
      ...state,
      tickets: state.tickets - 1,
      playerHp: PLAYER_MAX_HP,
      specialGauge: 0,
    },
  };
}
