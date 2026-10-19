import type { BlazeIntent } from './blazePrototypeEngine';
import type { EndermanIntent } from './endermanPrototypeEngine';
import type { CampaignIntent } from './dragonCampaignEngine';

/** Shared semantics, kept separate from the JSX view on case-insensitive file systems. */
export type ForecastSignal = 'attack' | 'heavy' | 'extreme' | 'charge' | 'rest';
export const FORECAST_MARKS: Record<ForecastSignal, string> = { attack: '👊', heavy: '👊！', extreme: '👊！！', charge: '💪', rest: '😴' };
export const FORECAST_LABELS: Record<ForecastSignal, string> = { attack: 'ふつうの こうげき', heavy: 'おおわざ', extreme: 'とくだいの こうげき', charge: 'ちからを ためている。今回は攻撃なし', rest: 'ひとやすみ。今回は攻撃なし' };
export function blazeForecast(intent: BlazeIntent, stunned = false): ForecastSignal {
  return intent === 'charge' ? 'charge' : stunned ? 'rest' : intent === 'burst' ? 'heavy' : 'attack';
}
export function endermanForecast(intent: EndermanIntent, stunned = false): ForecastSignal {
  return intent === 'warp' || intent === 'opening' || stunned ? 'rest' : intent === 'ambush' ? 'heavy' : 'attack';
}
export function dragonForecast(intent: CampaignIntent, stunned = false): ForecastSignal {
  if (['charge', 'charge1', 'charge2', 'orbPrepare'].includes(intent)) return 'charge';
  if (intent === 'opening' || stunned) return 'rest';
  return intent === 'storm' ? 'extreme' : intent === 'breath' || intent === 'orbFire' ? 'heavy' : 'attack';
}
