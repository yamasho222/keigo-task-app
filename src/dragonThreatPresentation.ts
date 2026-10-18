import type { CampaignIntent } from './dragonCampaignEngine';
export const DRAGON_THREAT_ASSETS = {
  breath: '/mining/dragon-threat-v1/breath.webp',
  orb: '/mining/dragon-threat-v1/orb.webp',
  storm: '/mining/dragon-threat-v1/storm.webp',
} as const;
/** Milliseconds after the charge begins; shared by live playback and free preview. */
export function dragonThreatTiming(intent: CampaignIntent) {
  const heavy = ['breath', 'orbFire', 'storm'].includes(intent);
  const launch = intent === 'storm' ? 650 : heavy ? 500 : 250;
  return { launch, contact: launch + (heavy ? 600 : 350) };
}
