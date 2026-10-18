import type { CampaignEquipment } from './campaignEquipment';

export type DragonEffects = { version: 1; burn: number; stun: number; water: number; light: number };
export const emptyDragonEffects = (): DragonEffects => ({ version: 1, burn: 0, stun: 0, water: 0, light: 0 });
export function validDragonEffects(raw: unknown): raw is DragonEffects {
  if (!raw || typeof raw !== 'object') return false;
  const value = raw as DragonEffects;
  return value.version === 1 && ([['burn', 3], ['stun', 2], ['water', 2], ['light', 4]] as const)
    .every(([key, max]) => Number.isInteger(value[key]) && value[key] >= 0 && value[key] <= max);
}

export type AllyHit = { id: string; amount: number };
/** Separate saved draws: menu, criticals and skill scores cannot reroll allies. */
export function rollAllyAttack(buddies: CampaignEquipment['buddies'], seed: number): { seed: number; hits: AllyHit[]; total: number } {
  const hits: AllyHit[] = [];
  const seen = new Set<string>();
  for (const buddy of buddies.slice(0, 3)) {
    if (seen.has(buddy.id)) continue;
    seen.add(buddy.id);
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const roll = seed / 4294967296;
    const amount = buddy.level <= 4 ? 1 : buddy.level <= 8 ? roll < .8 ? 1 : 2 : roll < .75 ? 1 : roll < .95 ? 2 : 3;
    hits.push({ id: buddy.id, amount });
  }
  return { seed, hits, total: hits.reduce((sum, hit) => sum + hit.amount, 0) };
}

/** Split actual post-barrier/capped ally damage without inventing overkill. */
export function capAllyHits(hits: AllyHit[], actual: number): AllyHit[] {
  return hits.map(hit => { const amount = Math.min(actual, hit.amount); actual -= amount; return { ...hit, amount }; }).filter(hit => hit.amount > 0);
}
