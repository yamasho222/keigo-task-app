/** Independent, persisted stream: harvesting, previews and replays cannot reroll a hit. */
export type DragonCritical = { version: 1; seed: number };
export const DRAGON_CRITICAL_CHANCE = .1;
export function nextDragonCritical(input: DragonCritical) {
  const seed = (Math.imul(input.seed, 1664525) + 1013904223) >>> 0;
  return { state: { version: 1 as const, seed }, hit: seed / 4294967296 < DRAGON_CRITICAL_CHANCE };
}
export function enableDragonCritical<T extends { seed: number; critical?: DragonCritical }>(state: T): T {
  return state.critical ? state : { ...state, critical: { version: 1, seed: (state.seed ^ 0x9e3779b9) >>> 0 } };
}
export function validDragonCritical(value: unknown): value is DragonCritical {
  if (!value || typeof value !== 'object') return false;
  const state = value as DragonCritical;
  return state.version === 1 && Number.isInteger(state.seed) && state.seed >= 0 && state.seed <= 0xffffffff;
}
