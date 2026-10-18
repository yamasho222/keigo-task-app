import type { CampaignIntent, CampaignTarget, DragonCampaign } from './dragonCampaignEngine';

/** Optional so existing trial saves can be upgraded without resetting any progress. */
export type DragonAdventure = { version: 1; beat: number; pattern: number; counter: boolean; pressure: number };
export type DragonTechnique = 'cleave' | 'shatter' | 'dive' | 'reflect' | 'seal';

export function enableDragonAdventure(state: DragonCampaign): DragonCampaign {
  return state.adventure ? state : { ...state, adventure: { version: 1, beat: 0, pattern: 0, counter: false, pressure: 0 } };
}

// Choose a new readable pattern only at a cycle boundary, never after showing a forecast.
export const DRAGON_ADVENTURE_CYCLES: Record<DragonCampaign['phase'], CampaignIntent[][]> = {
  crystals: [['claw', 'charge', 'breath', 'opening'], ['charge', 'breath', 'claw', 'opening']],
  wings: [['claw', 'claw', 'charge', 'breath', 'opening'], ['claw', 'charge', 'breath', 'claw', 'opening']],
  orb: [['claw', 'orbPrepare']],
  rage: [['claw', 'charge1', 'charge2', 'storm', 'opening'], ['charge1', 'charge2', 'storm', 'claw', 'opening']],
};

export function dragonFocusTarget(state: DragonCampaign): CampaignTarget | null {
  if (!state.adventure || state.landingTurns > 0) return null;
  if (state.phase === 'wings') {
    const alive = state.wings.flatMap((hp, i) => hp > 0 ? [i] : []);
    return alive.length ? `wing:${alive[Math.floor(state.adventure.beat / 2) % alive.length]}` : null;
  }
  if (state.phase === 'orb' && state.orbHp > 0) return 'orb';
  return null;
}

export function dragonTechnique(state: DragonCampaign, target = state.selected): DragonTechnique {
  if (target.startsWith('crystal:')) return 'shatter';
  if (target === 'orb' && state.orbHp > 0) return 'reflect';
  if (state.landingTurns > 0 || target.startsWith('wing:')) return 'dive';
  return state.phase === 'rage' ? 'seal' : 'cleave';
}

export const DRAGON_TECHNIQUE_NAMES: Record<DragonTechnique, string> = {
  cleave: 'なかまぎり', shatter: 'くだく', dive: 'とびこみ', reflect: 'はねかえす', seal: 'りゅうふうじ',
};
export const isDragonHeavyIntent = (intent: CampaignIntent) => ['breath', 'orbFire', 'storm'].includes(intent);

/** One short, contextual message, never a permanent wall of instructions. */
export function dragonAdventureCue(state: DragonCampaign): string {
  if (!state.adventure) return '';
  if (state.adventure.counter) return 'うけとめた！ かえすぞ！';
  if (state.landingTurns > 0) return 'おりてきた！ チャンス！';
  if (state.phase === 'crystals') return state.barrierTurns > 0 ? 'バリアが きえた！' : 'ひかりは どこから？';
  if (state.phase === 'wings') return state.wings.some(hp => hp > 0) ? 'つばさが ひかった！' : 'おおわざの あとが チャンス！';
  if (state.phase === 'orb') return state.orbHp > 0 ? 'たまが せまってくる！' : 'つぎは なにが くる？';
  if (state.adventure.pressure > 0) return 'あと ひとおし！';
  return 'ためた ちからを くずせ！';
}
