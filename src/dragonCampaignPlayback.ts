import { CAMPAIGN_ACTIONS, type CampaignAction, type CampaignEvent, type DragonCampaign } from './dragonCampaignEngine';
import { isUltimateAction } from './dragonSkillRules';
import { dragonThreatTiming } from './dragonThreatPresentation';

export type CampaignPlaybackStage = 'ticket' | 'windup' | 'strike' | 'impact' | 'assist' | 'assistImpact' | 'reflect' | 'reflected' | 'enemyWindup' | 'counter' | 'hurt' | 'recover' | 'victory';
export type CampaignFrame = { at: number; stage: CampaignPlaybackStage; shown: DragonCampaign };
export type CampaignPlayback = { frames: CampaignFrame[]; duration: number };

/** Presentation is replayable; authoritative outcome is persisted BEFORE this begins. */
export function buildCampaignPlayback(before: DragonCampaign, after: DragonCampaign, action: CampaignAction, events: CampaignEvent[], reduced = false): CampaignPlayback {
  if (!['attack', 'ultimate', 'releaseSkill', 'guard', 'bed', 'heal'].includes(action.kind)) return { frames: [], duration: 0 };
  const special = isUltimateAction(action), bed = action.kind === 'bed', healing = action.kind === 'heal';
  const ticket = events.some(e => e.kind === 'ticket');
  const counter = events.some(e => e.kind === 'counter');
  const enemyIntent = events.find(e => e.kind === 'counter')?.intent;
  const enemyTiming = dragonThreatTiming(enemyIntent ?? 'claw');
  const enemyLaunch = 350 + enemyTiming.launch, enemyContact = 350 + enemyTiming.contact;
  const reflection = events.find(e => e.kind === 'orbReflect');
  const won = events.some(e => e.kind === 'victory');
  const pace = reduced ? .5 : 1;
  const at = (time: number) => Math.round(time * pace);
  if (healing) return { frames: [{ at: 0, stage: 'windup', shown: before }, { at: at(420), stage: 'recover', shown: after }], duration: at(1000) };
  const offset = ticket ? 300 : 0;
  const windup = special ? 900 : bed ? 500 : 160;
  const hit = offset + windup + (special ? 680 : 220);
  const helper = events.find(event => event.kind === 'companion' && event.amount > 0);
  const assistDelay = helper ? special ? 1000 : 800 : 0;
  const paid = { ...before, tickets: after.tickets, hands: (ticket ? CAMPAIGN_ACTIONS : before.hands) - 1, turns: after.turns };
  // Defeat may roll back unfinished parts in `after`. Do not show that rollback at impact.
  const impact: DragonCampaign = { ...paid, crystals: [...before.crystals], wings: [...before.wings], gauge: after.gauge };
  for (const event of events) {
    if (['hit', 'bed'].includes(event.kind)) {
      if (event.target === 'body') impact.bodyHp = Math.max(0, impact.bodyHp - event.amount);
      else if (event.target === 'orb') impact.orbHp = Math.max(0, impact.orbHp - event.amount);
      else if (event.target?.startsWith('crystal:')) impact.crystals[Number(event.target.split(':')[1])] -= event.amount;
      else if (event.target?.startsWith('wing:')) impact.wings[Number(event.target.split(':')[1])] -= event.amount;
    }
    if (event.kind === 'crystalHeal') impact.bodyHp += event.amount;
  }
  const ownImpact = structuredClone(impact);
  if (helper?.target) {
    if (helper.target === 'body') {
      ownImpact.bodyHp += helper.amount;
      ownImpact.bodyHp -= events.find(event => event.kind === 'crystalHeal')?.amount ?? 0;
    } else if (helper.target === 'orb') ownImpact.orbHp += helper.amount;
    else if (helper.target.startsWith('wing:')) ownImpact.wings[Number(helper.target.split(':')[1])] += helper.amount;
    else if (helper.target.startsWith('crystal:')) ownImpact.crystals[Number(helper.target.split(':')[1])] += helper.amount;
  }
  const frames: CampaignFrame[] = [];
  if (ticket) frames.push({ at: 0, stage: 'ticket', shown: { ...before, tickets: after.tickets, hands: CAMPAIGN_ACTIONS } });
  frames.push({ at: at(offset), stage: 'windup', shown: paid });
  frames.push({ at: at(offset + windup), stage: 'strike', shown: paid });
  frames.push({ at: at(hit), stage: 'impact', shown: ownImpact });
  if (helper) {
    frames.push({ at: at(hit + (special ? 450 : 280)), stage: 'assist', shown: ownImpact });
    frames.push({ at: at(hit + assistDelay), stage: 'assistImpact', shown: impact });
  }
  const resolved = hit + assistDelay;
  if (reflection) {
    frames.push({ at: at(resolved + 350), stage: 'reflect', shown: impact });
    frames.push({ at: at(resolved + 970), stage: 'reflected', shown: { ...impact, bodyHp: Math.max(0, impact.bodyHp - reflection.amount) } });
  }
  if (counter) {
    frames.push({ at: at(resolved + 350), stage: 'enemyWindup', shown: impact });
    frames.push({ at: at(resolved + enemyLaunch), stage: 'counter', shown: impact });
    frames.push({ at: at(resolved + enemyContact), stage: 'hurt', shown: { ...impact, hp: after.hp } });
  }
  if (won) frames.push({ at: at(resolved + (reflection ? 1350 : 650)), stage: 'victory', shown: after });
  return { frames, duration: at(resolved + (reflection ? won ? 2200 : 1550 : counter ? enemyContact + 650 : won ? 1500 : special ? 1050 : 800)) };
}
