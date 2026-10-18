import { SKILL_KINDS, playableSkill, type DragonSkillKind, type DragonSkills } from './dragonSkillRules';
import { emptyDragonEffects, type DragonEffects } from './dragonBattleEffects';

export type BattleSkillAction = { kind: 'beginSkill' } | { kind: 'cancelSkill' }
  | { kind: 'chooseSkill'; token: string; mode: DragonSkillKind }
  | { kind: 'releaseSkill'; token: string; score: number };
export type BattleSkillState = { skills?: DragonSkills; unlockedSkills?: DragonSkillKind[]; effects?: DragonEffects };
export const newBattleSkills = (): DragonSkills => ({ version: 1, casts: 0, last: null, pending: null });
export const unlockedBattleSkills = (locations: readonly string[]): DragonSkillKind[] => locations.includes('the_end')
  ? ['repel', 'aim', 'burst', 'gauge'] : locations.includes('warped_forest') ? ['repel', 'aim'] : ['repel'];
export const isBattleSkillAction = (kind: string) => ['beginSkill', 'chooseSkill', 'releaseSkill', 'cancelSkill'].includes(kind);
export const isBattleUltimate = (kind?: string) => kind === 'ultimate' || kind === 'releaseSkill';
export function enableBattleSkills<T extends BattleSkillState>(run: T, unlocked: DragonSkillKind[]): T {
  return { ...run, skills: run.skills ?? newBattleSkills(), unlockedSkills: [...unlocked] };
}
export function validSkillUnlocks(raw: unknown): raw is DragonSkillKind[] {
  return Array.isArray(raw) && raw.length > 0 && raw.length <= 4 && new Set(raw).size === raw.length
    && raw.every(kind => SKILL_KINDS.includes(kind));
}
export function validSmallBattleSkills(run: BattleSkillState & { phase: string; gauge: number; handsLeft: number; tickets: number }) {
  if (run.unlockedSkills !== undefined && !validSkillUnlocks(run.unlockedSkills)) return false;
  const s = run.skills;
  if (s === undefined) return true;
  if (!s || s.version !== 1 || !Number.isSafeInteger(s.casts) || s.casts < 0 || s.casts > 1e7 || s.last !== null && ![...SKILL_KINDS, 'trace'].includes(s.last)) return false;
  const p = s.pending;
  return p === null || !!p && run.phase === 'battle' && run.gauge === 3 && (run.handsLeft > 0 || run.tickets > 0)
    && p.target === 'body' && typeof p.token === 'string' && p.token.length > 0 && p.token.length <= 600
    && (p.mode === null || [...SKILL_KINDS, 'trace'].includes(p.mode));
}
/** The picker is free. Once a game is selected, its saved token locks the cast. */
export function prepareBattleSkill<T extends BattleSkillState & { phase: string; hp: number; gauge: number; handsLeft: number; tickets: number; turn: number }>(
  input: T, action: BattleSkillAction,
): { state: T; error?: string; cast?: { score: number; mode: DragonSkillKind } } {
  const reject = (error: string) => ({ state: input, error });
  const skills = input.skills, pending = skills?.pending;
  if (!skills || input.phase !== 'battle' || input.hp <= 0 || input.gauge < 3 || input.handsLeft === 0 && input.tickets < 1) return reject('ひっさつの じゅんびを しよう。');
  const offers = input.unlockedSkills ?? ['repel'];
  if (action.kind === 'beginSkill') {
    if (pending) return reject('はじめた ひっさつを はなとう。');
    return { state: { ...input, skills: { ...skills, pending: { token: `battle:${input.turn}:${skills.casts}`, target: 'body', mode: offers.length === 1 ? offers[0] : null } } } };
  }
  if (!pending) return reject('ひっさつの きろくを たしかめてね。');
  if (action.kind === 'cancelSkill') {
    if (pending.mode) return reject('はじめた ひっさつを はなとう。');
    return { state: { ...input, skills: { ...skills, pending: null } } };
  }
  if (action.token !== pending.token) return reject('ひっさつの きろくを たしかめてね。');
  if (action.kind === 'chooseSkill') {
    if (pending.mode || !offers.includes(action.mode)) return reject('おぼえた ひっさつを えらぼう。');
    return { state: { ...input, skills: { ...skills, pending: { ...pending, mode: action.mode } } } };
  }
  if (!pending.mode || !Number.isInteger(action.score) || action.score < 0 || action.score > 100) return reject('ひっさつの きろくを たしかめてね。');
  return { state: { ...input, skills: { ...skills, casts: skills.casts + 1, last: pending.mode, pending: null } }, cast: { mode: playableSkill(pending.mode), score: action.score } };
}
export const smallSkillBonus = (baseUltimate: number, score: number) => Math.round(baseUltimate * score / 100);
export function grantBattleEffect(effects: DragonEffects | undefined, mode: DragonSkillKind, hp: number, maxHp: number) {
  const next = { ...(effects ?? emptyDragonEffects()) };
  let healed = 0;
  if (mode === 'burst') next.burn = 3;
  if (mode === 'gauge') next.stun = 1;
  if (mode === 'repel') next.water = 2;
  if (mode === 'aim') { healed = Math.min(4, maxHp - hp); next.light = Math.max(next.light, 4 - healed); }
  return { effects: next, healed };
}
export function absorbBattleDamage(effects: DragonEffects | undefined, incoming: number) {
  const next = { ...(effects ?? emptyDragonEffects()) };
  let damage = incoming;
  if (damage > 0 && next.water > 0) { damage = Math.ceil(damage / 2); next.water--; }
  if (damage > 0 && next.light > 0) { const absorbed = Math.min(damage, next.light); damage -= absorbed; next.light -= absorbed; }
  return { effects: next, damage };
}
