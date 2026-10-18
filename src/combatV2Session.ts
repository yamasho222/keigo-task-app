import { applyCombatSpecialFinish } from "./miningCombat";
import { applyEndQuestOnVisit } from "./endChapter";
import { refreshUnlocks } from "./miningProgress";
import type { MiningState } from "./miningTypes";
import { withCombatV2Session } from "./combatV2Migration";
import { combatAffinity, combatRandom, nextCombatIntent, v2AttackDamage, v2Drop, v2FullDamage, v2HasWater, v2IncomingHp, v2MaxMobHp, v2Sword } from "./combatV2Rules";
import { COMBAT_V2_RULES as R, type CombatV2Command, type CombatV2Event, type CombatV2Location, type CombatV2Result, type CombatV2Session } from "./combatV2Types";

function newSession(state: MiningState, location: CombatV2Location, dateKey: string, seed: number): CombatV2Session {
  const progress = state.combatProgress?.[location];
  const legacy = !state.combatV2?.sharedLegacyClaimed
    && (!state.pendingReviveLocation || state.pendingReviveLocation === location);
  const max = v2MaxMobHp(location);
  const old = state.combatEncounters?.[location];
  const hp = legacy && state.playerHpDate === dateKey ? Math.max(0, state.playerHp ?? 20) : 20;
  // Old deaths do not acquire the new day's lock retroactively.
  const initialHp = hp || 20;
  const next = nextCombatIntent(seed >>> 0, 0, false, state);
  const mobs: [number, number] = old ? [old.mobs[0]?.hp ?? 0, old.mobs[1]?.hp ?? 0] : [max, max];
  return {
    version: 2, id: `${location}-${dateKey}-${seed >>> 0}`, revision: 0, dateKey,
    status: mobs.every((n) => n <= 0) ? "cleared" : "choosing", hp: initialHp,
    gauge: legacy && hp > 0 ? Math.max(0, Math.min(5, state.specialGauge ?? 0)) : 0,
    remainingActions: progress?.freeFirstAttack ? (progress.attackStep === 1 ? 1 : 2) : progress?.attackStep === 1 ? 1 : 0,
    wave: old?.wave ?? 0, mobs, bag: 0, intent: next.intent, turn: 0, seed: next.seed, lastUnknown: false,
    failures: 0, waterRetryUsed: false, waterKnown: v2HasWater(state, location), lastOperationId: "",
  };
}

function advanceIntent(s: CombatV2Session, state: MiningState): void {
  s.turn += 1;
  const next = nextCombatIntent(s.seed, s.turn, s.intent.unknown, state);
  s.lastUnknown = s.intent.unknown;
  s.intent = next.intent;
  s.seed = next.seed;
}
function secureBag(state: MiningState, s: CombatV2Session, location: CombatV2Location, event: CombatV2Event): MiningState {
  const drop = v2Drop(location);
  const next = refreshUnlocks({ ...state, materials: { ...state.materials, [drop]: (state.materials[drop] ?? 0) + s.bag } });
  event.secured = s.bag;
  s.bag = 0;
  return next;
}
function defeat(s: CombatV2Session, event: CombatV2Event): void {
  event.lost = s.bag;
  s.bag = 0;
  s.status = "defeated";
  s.remainingActions = 0;
  s.gauge = 0;
  s.failures += 1;
}
function damageMobs(s: CombatV2Session, targets: number[], damage: number, e: CombatV2Event): void {
  e.targets = targets;
  e.damage = damage;
  for (const target of targets) {
    const before = s.mobs[target];
    s.mobs[target] = Math.max(0, before - damage);
    if (before > 0 && s.mobs[target] === 0) {
      e.killed.push(target);
      s.bag += 1;
    }
  }
}
function finishSpecial(state: MiningState, s: CombatV2Session, location: CombatV2Location, e: CombatV2Event): MiningState {
  const p = s.pendingSpecial!;
  e.kind = "special";
  damageMobs(s, [0, 1].filter((i) => s.mobs[i] > 0), p.baseDamage + p.taps * R.specialTapDamage, e);
  // A legacy paid special retains its old counter; v2 specials interrupt the counter.
  if (p.legacy && s.mobs.some((hp) => hp > 0)) {
    e.takenHp = v2IncomingHp(state, location, "even");
    s.hp = Math.max(0, s.hp - e.takenHp);
  }
  delete s.pendingSpecial;
  s.status = "choosing";
  if (s.hp === 0) defeat(s, e);
  else if (s.mobs.every((hp) => hp === 0)) {
    s.status = "cleared";
    state = secureBag(state, s, location, e);
  } else advanceIntent(s, state);
  return state;
}

export function canUseCombatV2(state: MiningState, location: CombatV2Location, kind: "act" | "heal" | "beginSpecial" | "return" | "next" | "retryWater"): boolean {
  const s = state.combatV2?.sessions[location];
  if (!s || s.status === "special") return false;
  if (kind === "retryWater") return s.status === "defeated" && !s.waterRetryUsed && !s.waterKnown && v2HasWater(state, location);
  if (kind === "return") return s.status === "choosing" || s.status === "cleared";
  if (kind === "next") return s.status === "cleared";
  if (s.hp <= 0 || (s.status !== "choosing" && s.status !== "cleared")) return false;
  if (kind === "heal") return s.hp < R.maxHp && state.tickets > 0;
  return s.status === "choosing" && !!v2Sword(state)
    && (state.tickets > 0 || s.remainingActions > 0)
    && (kind !== "beginSpecial" || s.gauge >= R.maxGauge);
}

/** One deterministic command updates tickets, combat, loot and unlocks atomically. */
export function transitionCombatV2(input: MiningState, command: CombatV2Command): CombatV2Result {
  const { location, dateKey, now, id } = command;
  let state = input;
  let current = state.combatV2?.sessions[location];
  if (!id || !Number.isSafeInteger(now) || now < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return { state: input, error: "操作の情報を確認できないよ" };
  if (current?.lastOperationId === id) return { state: input };
  if ((current?.revision ?? 0) !== command.expectedRevision || (current && current.id !== command.sessionId)) return { state: input, error: "記録が更新されたよ。もう一度えらんでね" };
  if (!current) {
    if (command.kind !== "enter" || !state.unlockedGachas.includes(location)) return { state: input, error: "まず場所をえらぼう" };
    // Settle a previously paid legacy special under the legacy rules once before migration.
    const oldSpecial = state.combatProgress?.[location]?.pendingSpecial;
    if (oldSpecial && now >= oldSpecial.startedAtMs + R.specialMs) {
      const result = applyCombatSpecialFinish({ state, gacha: location, taps: oldSpecial.taps });
      if ("error" in result) return { state: input, error: result.error };
      state = refreshUnlocks(result.state);
    }
    const seed = [...`${location}:${dateKey}:${id}`].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 710214);
    current = newSession(state, location, dateKey, seed);
    if (oldSpecial && now < oldSpecial.startedAtMs + R.specialMs) {
      current.status = "special";
      current.gauge = 0;
      current.pendingSpecial = {
        operationId: `legacy-${id}`, startedAt: oldSpecial.startedAtMs,
        deadline: oldSpecial.startedAtMs + R.specialMs, taps: 0,
        // Preserve every already-earned legacy tap, even when it exceeded the v2 cap.
        baseDamage: oldSpecial.taps * R.specialTapDamage, legacy: true,
      };
    }
    const progress = { ...state.combatProgress };
    delete progress[location];
    state = { ...state, combatProgress: progress, specialGauge: state.combatV2?.sharedLegacyClaimed || state.pendingReviveLocation === "the_end" ? state.specialGauge : 0 };
  }
  const s = structuredClone(current);
  const e: CombatV2Event = { id, kind: "sync", targets: [], damage: 0, takenHp: 0, killed: [], secured: 0, lost: 0, paid: false, previousHp: s.hp, previousMobs: [...s.mobs] };
  if (command.kind === "sync") {
    if (s.pendingSpecial && (now >= s.pendingSpecial.deadline || s.dateKey !== dateKey)) state = finishSpecial(state, s, location, e);
    if (s.dateKey !== dateKey) {
      s.dateKey = dateKey;
      s.hp = R.maxHp;
      if (s.status === "defeated" || s.status === "returned") s.status = s.mobs.every((hp) => hp === 0) ? "cleared" : "choosing";
    }
    if (JSON.stringify(s) === JSON.stringify(current)) return { state: input };
  } else if (command.kind === "enter") {
    if (input.combatV2?.sessions[location]) return { state: input };
    e.kind = "enter";
  } else {
    if (s.dateKey !== dateKey) return { state: input, error: "日付が変わったよ。記録を更新してね" };
    if (command.kind === "tap") {
      const p = s.pendingSpecial;
      if (!p || now >= p.deadline || now < p.startedAt || p.taps >= R.maxTaps
        || (p.lastTapAt !== undefined && now - p.lastTapAt < R.minTapInterval)) return { state: input };
      p.taps += 1;
      p.lastTapAt = now;
    } else if (command.kind === "finishSpecial") {
      if (!s.pendingSpecial || now < s.pendingSpecial.deadline) return { state: input };
      state = finishSpecial(state, s, location, e);
    } else {
      if (!canUseCombatV2({ ...state, combatV2: { version: 2, sharedLegacyClaimed: true, sessions: { ...state.combatV2?.sessions, [location]: s } } }, location, command.kind)) {
        return { state: input, error: s.status === "defeated" || s.status === "returned" ? "ここは また あした。ほかの場所であそべるよ" : "今はその操作はできないよ" };
      }
      if (command.kind === "heal") {
        state = { ...state, tickets: state.tickets - 1 };
        s.hp = Math.min(R.maxHp, s.hp + R.healHp);
        e.kind = "heal"; e.paid = true;
      } else if (command.kind === "return") {
        state = secureBag(state, s, location, e);
        s.status = "returned"; s.remainingActions = 0; e.kind = "return";
      } else if (command.kind === "retryWater") {
        s.hp = R.maxHp; s.status = s.mobs.every((n) => n === 0) ? "cleared" : "choosing";
        s.waterRetryUsed = true; s.waterKnown = true; e.kind = "retryWater";
      } else if (command.kind === "next") {
        s.wave += 1; const max = v2MaxMobHp(location); s.mobs = [max, max]; s.status = "choosing";
        advanceIntent(s, state); e.kind = "next";
      } else {
        if (s.remainingActions === 0) {
          state = { ...state, tickets: state.tickets - 1 };
          s.remainingActions = R.actionsPerTicket;
          e.paid = true;
        }
        const second = s.remainingActions === 1;
        s.remainingActions -= 1;
        if (v2HasWater(state, location)) s.waterKnown = true;
        if (e.paid) {
          const questRoll = combatRandom(s.seed); s.seed = questRoll.seed;
          state = applyEndQuestOnVisit(state, location, () => questRoll.value).state;
        }
        if (command.kind === "beginSpecial") {
          s.status = "special"; s.gauge = 0;
          s.pendingSpecial = { operationId: id, startedAt: now, deadline: now + R.specialMs, taps: 0, baseDamage: v2FullDamage(state, location) * R.specialBaseMultiplier };
        } else if (command.kind === "act") {
          const affinity = combatAffinity(command.action, s.intent.actual);
          Object.assign(e, { kind: "act", action: command.action, enemy: s.intent.actual, affinity });
          const target = [0, 1].filter((i) => s.mobs[i] > 0).sort((a, b) => s.mobs[a] - s.mobs[b])[0];
          damageMobs(s, [target], v2AttackDamage(state, location, second, affinity), e);
          if (affinity === "advantage") s.gauge = Math.min(R.maxGauge, s.gauge + 1);
          if (s.mobs.some((hp) => hp > 0)) {
            e.takenHp = v2IncomingHp(state, location, affinity);
            s.hp = Math.max(0, s.hp - e.takenHp);
          }
          if (s.hp === 0) defeat(s, e);
          else if (s.mobs.every((hp) => hp === 0)) {
            s.status = "cleared";
            state = secureBag(state, s, location, e);
          } else advanceIntent(s, state);
        }
      }
    }
  }
  s.revision += 1; s.lastOperationId = id;
  // Tap progress must not replace the latest visible action result.
  if (command.kind !== "tap" && command.kind !== "beginSpecial") s.lastEvent = e;
  return { state: withCombatV2Session(state, location, s) };
}
