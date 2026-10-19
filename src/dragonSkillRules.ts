import type { CampaignAction, CampaignTarget, DragonCampaign } from './dragonCampaignEngine';
import { SWORD_POWER, type SwordTier } from './campaignEquipment';

export const SKILL_KINDS = ['burst', 'gauge', 'repel', 'aim'] as const;
export type DragonSkillKind = typeof SKILL_KINDS[number];
/** Accept the removed trace identifier in old saves; never offer it for a new cast. */
export type SavedDragonSkillKind = DragonSkillKind | 'trace';
export const SAVED_SKILL_KINDS: readonly SavedDragonSkillKind[] = [...SKILL_KINDS, 'trace'];
export const playableSkill = (kind: SavedDragonSkillKind): DragonSkillKind => kind === 'trace' ? 'repel' : kind;
export const SKILL_NAMES: Record<DragonSkillKind, string> = { burst: 'れんだ', gauge: 'ゲージ', repel: 'ひっぱる', aim: 'ねらう' };
export const SKILL_TITLES: Record<DragonSkillKind, string> = { burst: 'れっかの つるぎ', gauge: 'いかずちの つるぎ', repel: 'そうりゅうの いちげき', aim: 'せんこうの いちげき' };
export const skillAt = (casts: number): DragonSkillKind => SKILL_KINDS[Math.max(0, Math.floor(casts)) % SKILL_KINDS.length];
export const SKILL_DURATION = 6000;
export const BURST_TAP_CAP = 31;
export type SkillPoint = { x: number; y: number };
export type DragonSkills = {
  version: 1; casts: number; last: SavedDragonSkillKind | null;
  pending: { token: string; target: CampaignTarget; mode: SavedDragonSkillKind | null } | null;
};
export function enableDragonSkills(state: DragonCampaign): DragonCampaign {
  return state.skills ? state : { ...state, skills: { version: 1, casts: 0, last: null, pending: null } };
}
export const isUltimateAction = (action: CampaignAction) => action.kind === 'ultimate' || action.kind === 'releaseSkill';
/** Completed casts remain in old saves for history, but never constrain the choice. */
export function skillOffers(casts: number, last?: SavedDragonSkillKind | null, unlocked?: readonly DragonSkillKind[]): DragonSkillKind[] {
  void casts; void last; return [...(unlocked ?? ['repel', 'aim', 'burst', 'gauge'])];
}
export function skillBonus(sword: SwordTier, score: number): number {
  // Existing sword ultimate is 8/12. Add a guaranteed 12/18 + scored 20/30.
  // Together this is diamond 20..40, netherite 30..60 before enchants/allies.
  const factor = SWORD_POWER[sword] / 4;
  return Math.round(factor * (12 + 20 * Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0)) / 100));
}
export const REPEL_COUNT = 10;
export const REPEL_INTERVAL = 500;
export const REPEL_LIFETIME = 1100;
export function repelTargets(elapsed: number): { id: number; x: number; y: number; age: number }[] {
  return Array.from({ length: REPEL_COUNT }, (_, id) => ({ id, x: [23, 74, 48, 24, 76, 50, 22, 73, 48, 51][id], y: [37, 43, 68, 65, 68, 35, 39, 42, 68, 43][id], age: elapsed - id * REPEL_INTERVAL }))
    .filter(target => target.age >= 0 && target.age < REPEL_LIFETIME);
}
export const repelScore = (hits: number) => Math.round(Math.max(0, Math.min(REPEL_COUNT, hits)) / REPEL_COUNT * 100);
/** Constant acceleration outwards, reversed velocity at MAX, deceleration back to zero. */
export function skillGaugePosition(elapsed: number): number {
  const leg = (Math.max(0, elapsed) % 2400) / 1200;
  const u = leg <= 1 ? leg : 2 - leg;
  return u * u;
}
export const gaugeScore = (position: number) => Math.round(Math.min(1, Math.max(0, position) / .9) * 100);
export const burstScore = (taps: number) => Math.round(Math.min(BURST_TAP_CAP, Math.max(0, Number.isFinite(taps) ? taps : 0)) / BURST_TAP_CAP * 100);
export function aimCursor(elapsed: number): number {
  const t = Math.max(0, elapsed) % 1600 / 800;
  return t <= 1 ? t : 2 - t;
}
export const AIM_CENTERS = [.5] as const;
export const AIM_COUNT = AIM_CENTERS.length;
/** One timed hit determines the full score; no old three-shot averaging. */
export const aimTotalScore = (shots: readonly number[]) => Math.round(Math.max(0, Math.min(100, Number.isFinite(shots[0]) ? shots[0] : 0)));
export function aimScore(cursor: number, center: number): number {
  return Math.round(Math.max(0, 1 - Math.max(0, Math.abs(cursor - center) - .06) / .29) * 100);
}
export const TRACE_PATH: SkillPoint[] = [{ x: 34, y: 178 }, { x: 93, y: 48 }, { x: 161, y: 161 }, { x: 231, y: 49 }, { x: 287, y: 176 }];
export const TRACE_CHECKPOINTS: SkillPoint[] = TRACE_PATH.flatMap((point, index) => {
  if (!index) return [point];
  const prev = TRACE_PATH[index - 1];
  return Array.from({ length: 6 }, (_, step) => ({ x: prev.x + (point.x - prev.x) * (step + 1) / 6, y: prev.y + (point.y - prev.y) * (step + 1) / 6 }));
});
function pointDistance(p: SkillPoint, a: SkillPoint, b: SkillPoint): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = dx * dx + dy * dy > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
/** Sequential, generous checkpoints; repeating the start or teleporting cannot farm points. */
export function advanceTrace(progress: number, from: SkillPoint, to: SkillPoint): number {
  if (![from.x, from.y, to.x, to.y].every(Number.isFinite) || Math.hypot(to.x - from.x, to.y - from.y) > 90) return progress;
  let next = progress;
  while (next < TRACE_CHECKPOINTS.length && pointDistance(TRACE_CHECKPOINTS[next], from, to) <= 22) next++;
  return next;
}
export const traceScore = (progress: number) => Math.round(Math.max(0, Math.min(TRACE_CHECKPOINTS.length, progress)) / TRACE_CHECKPOINTS.length * 100);
