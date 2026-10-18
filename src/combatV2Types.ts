import type { MiningState } from "./miningTypes";

export type CombatV2Location = "fortress" | "warped_forest";
export type CombatAction = "guard" | "cut" | "charge";
export type CombatAffinity = "advantage" | "even" | "disadvantage";
export type CombatV2Status = "choosing" | "special" | "cleared" | "returned" | "defeated";
export interface CombatIntent {
  actual: CombatAction;
  candidates: CombatAction[];
  unknown: boolean;
}
export interface CombatV2Special {
  operationId: string;
  startedAt: number;
  deadline: number;
  taps: number;
  baseDamage: number;
  legacy?: boolean;
  lastTapAt?: number;
}
export interface CombatV2Event {
  id: string;
  kind: "act" | "special" | "heal" | "return" | "next" | "enter" | "retryWater" | "sync";
  action?: CombatAction;
  enemy?: CombatAction;
  affinity?: CombatAffinity;
  targets: number[];
  damage: number;
  takenHp: number;
  killed: number[];
  secured: number;
  lost: number;
  paid: boolean;
  previousHp: number;
  previousMobs?: [number, number];
}
export interface CombatV2Session {
  version: 2;
  id: string;
  revision: number;
  dateKey: string;
  status: CombatV2Status;
  hp: number;
  gauge: number;
  remainingActions: number;
  wave: number;
  mobs: [number, number];
  bag: number;
  intent: CombatIntent;
  turn: number;
  seed: number;
  lastUnknown: boolean;
  failures: number;
  waterRetryUsed: boolean;
  waterKnown: boolean;
  pendingSpecial?: CombatV2Special;
  lastEvent?: CombatV2Event;
  lastOperationId: string;
}
export interface CombatV2Store {
  version: 2;
  sharedLegacyClaimed: boolean;
  sessions: Partial<Record<CombatV2Location, CombatV2Session>>;
}
export type CombatV2Command = {
  location: CombatV2Location;
  id: string;
  sessionId?: string;
  expectedRevision: number;
  dateKey: string;
  now: number;
} & (
  | { kind: "enter" | "sync" | "heal" | "return" | "next" | "beginSpecial" | "finishSpecial" | "tap" | "retryWater" }
  | { kind: "act"; action: CombatAction }
);
export interface CombatV2Result {
  state: MiningState;
  error?: string;
}

export const COMBAT_ACTIONS: CombatAction[] = ["guard", "cut", "charge"];
export const COMBAT_ACTION_LABEL: Record<CombatAction, string> = {
  guard: "まもる", cut: "きる", charge: "ためる",
};
export const COMBAT_HAND: Record<CombatAction, string> = {
  guard: "✊", cut: "✌️", charge: "✋",
};
export const COMBAT_V2_RULES = {
  maxHp: 20,
  maxGauge: 5,
  actionsPerTicket: 2,
  healHp: 10,
  specialMs: 5_000,
  specialBaseMultiplier: 2,
  specialTapDamage: 4,
  maxTaps: 10,
  // Filter repeated physical/keyboard events without requiring rapid tapping.
  minTapInterval: 100,
  certainty: 0.6,
  twoChoices: 0.3,
} as const;
