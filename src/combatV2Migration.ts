import type { MiningState } from "./miningTypes";
import { COMBAT_ACTIONS, type CombatV2Store, type CombatV2Session } from "./combatV2Types";

/** Fail closed: never silently replace a future/corrupt save with an empty game. */
export function readCombatV2(raw: unknown): CombatV2Store | undefined {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== "object") throw new Error("戦闘の記録を読み取れません。記録を残して停止しました。");
  const store = raw as CombatV2Store;
  if (store.version !== 2) throw new Error("この戦闘の記録は別のバージョンです。更新が必要です。");
  if (!store.sessions || typeof store.sessions !== "object" || typeof store.sharedLegacyClaimed !== "boolean") throw new Error("戦闘の記録の形式が正しくありません。");
  const integer = (n: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => typeof n === "number" && Number.isSafeInteger(n) && n >= min && n <= max;
  for (const [location, value] of Object.entries(store.sessions)) {
    if (location !== "fortress" && location !== "warped_forest") throw new Error("未対応の戦闘場所です。");
    const s = value as CombatV2Session;
    if (!s || s.version !== 2 || typeof s.id !== "string" || !integer(s.revision, 0)
      || typeof s.dateKey !== "string" || !["choosing", "special", "cleared", "returned", "defeated"].includes(s.status)
      || !integer(s.hp, 0, 20) || !integer(s.gauge, 0, 5) || !integer(s.remainingActions, 0, 2)
      || !integer(s.wave, 0) || !integer(s.bag, 0, 2) || !integer(s.turn, 0) || !integer(s.seed, 0, 4294967295)
      || !integer(s.failures, 0) || !Array.isArray(s.mobs) || s.mobs.length !== 2 || s.mobs.some((hp) => !integer(hp, 0, location === "fortress" ? 20 : 40))
      || !s.intent || !COMBAT_ACTIONS.includes(s.intent.actual) || !Array.isArray(s.intent.candidates)
      || s.intent.candidates.some((a) => !COMBAT_ACTIONS.includes(a)) || new Set(s.intent.candidates).size !== s.intent.candidates.length
      || typeof s.intent.unknown !== "boolean" || (s.intent.unknown ? s.intent.candidates.length !== 0 : !s.intent.candidates.includes(s.intent.actual))
      || typeof s.lastOperationId !== "string" || typeof s.lastUnknown !== "boolean"
      || typeof s.waterRetryUsed !== "boolean" || typeof s.waterKnown !== "boolean"
      || (s.status === "special") !== !!s.pendingSpecial) throw new Error("戦闘の記録に不整合があります。上書きせずに停止しました。");
    const p = s.pendingSpecial;
    if (p && (!integer(p.startedAt, 0) || !integer(p.deadline, p.startedAt) || !integer(p.taps, 0, 10)
      || !integer(p.baseDamage, 0) || typeof p.operationId !== "string"
      || (p.lastTapAt !== undefined && !integer(p.lastTapAt, p.startedAt, p.deadline)))) throw new Error("必殺技の途中記録に不整合があります。");
    const allDefeated = s.mobs.every((hp) => hp === 0);
    if ((s.status === "cleared" && (!allDefeated || s.bag !== 0))
      || (s.status === "choosing" && (allDefeated || s.hp === 0))
      || (s.status === "special" && (s.hp === 0 || s.gauge !== 0 || allDefeated))
      || (s.status === "defeated" && (s.hp !== 0 || s.bag !== 0 || s.remainingActions !== 0 || s.gauge !== 0))
      || (s.status === "returned" && (s.hp === 0 || s.bag !== 0 || s.remainingActions !== 0))) throw new Error("戦闘の終了状態とHPが一致しません。");
    const e = s.lastEvent;
    if (e && (typeof e.id !== "string" || !["act", "special", "heal", "return", "next", "enter", "retryWater", "sync"].includes(e.kind)
      || !integer(e.damage, 0) || !integer(e.takenHp, 0) || !integer(e.secured, 0, 2) || !integer(e.lost, 0, 2) || !integer(e.previousHp, 0, 20)
      || !Array.isArray(e.targets) || e.targets.some((i) => i !== 0 && i !== 1) || !Array.isArray(e.killed) || e.killed.some((i) => i !== 0 && i !== 1)
      || (e.kind === "act" && (!COMBAT_ACTIONS.includes(e.action!) || !COMBAT_ACTIONS.includes(e.enemy!) || !["advantage", "even", "disadvantage"].includes(e.affinity!))))) throw new Error("戦闘結果の記録を確認できません。");
  }
  return structuredClone(store);
}

export function withCombatV2Session(state: MiningState, location: "fortress" | "warped_forest", session: CombatV2Session): MiningState {
  return {
    ...state,
    combatV2: {
      version: 2,
      sharedLegacyClaimed: true,
      sessions: { ...state.combatV2?.sessions, [location]: session },
    },
  };
}
