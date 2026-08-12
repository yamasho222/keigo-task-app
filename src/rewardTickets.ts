/** ごほうびチケット（親救済配布／子ども消費） */

import { RARITY_META, RARITY_ORDER, type RewardRarity } from "./rarityMeta";

export type RewardTicketKind = RewardRarity;

export type RewardTicketInventory = Record<RewardTicketKind, number>;

export const REWARD_TICKET_KINDS: readonly RewardTicketKind[] = RARITY_ORDER;

export const EMPTY_REWARD_TICKETS: RewardTicketInventory = {
  normal: 0,
  rare: 0,
  superRare: 0,
  ultraRare: 0,
  legendary: 0,
};

export function rewardTicketLabel(kind: RewardTicketKind): string {
  if (kind === "normal") return "ノーマルチケット";
  return `${RARITY_META[kind].label}確定チケット`;
}

export function rewardTicketShortLabel(kind: RewardTicketKind): string {
  if (kind === "normal") return "ノーマル";
  return `${RARITY_META[kind].compact}確定`;
}

export function normalizeRewardTickets(raw: unknown): RewardTicketInventory {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = { ...EMPTY_REWARD_TICKETS };
  for (const kind of REWARD_TICKET_KINDS) {
    const n = src[kind];
    out[kind] = typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }
  return out;
}

export function adjustRewardTicket(
  inv: RewardTicketInventory,
  kind: RewardTicketKind,
  delta: number,
): RewardTicketInventory {
  const d = Math.floor(delta);
  if (!Number.isFinite(d) || d === 0) return inv;
  return {
    ...inv,
    [kind]: Math.max(0, inv[kind] + d),
  };
}

export function totalRewardTickets(inv: RewardTicketInventory): number {
  return REWARD_TICKET_KINDS.reduce((sum, k) => sum + inv[k], 0);
}

/** 所持がある種類だけ（表示順はレア度） */
export function ownedRewardTicketKinds(inv: RewardTicketInventory): RewardTicketKind[] {
  return REWARD_TICKET_KINDS.filter((k) => inv[k] > 0);
}
