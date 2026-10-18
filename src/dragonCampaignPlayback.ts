import { CAMPAIGN_ACTIONS, type CampaignAction, type CampaignEvent, type DragonCampaign } from './dragonCampaignEngine';
import { isUltimateAction } from './dragonSkillRules';
import { dragonThreatTiming } from './dragonThreatPresentation';
import type { AllyHit } from './dragonBattleEffects';

export type CampaignPlaybackStage = 'ticket' | 'windup' | 'strike' | 'impact' | 'assist' | 'assistImpact' | 'reflect' | 'reflected' | 'effect' | 'enemyWindup' | 'counter' | 'hurt' | 'recover' | 'victory';
export type CampaignFrame = { at: number; stage: CampaignPlaybackStage; shown: DragonCampaign; allyHit?: AllyHit };
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
  const windup = special ? 900 : bed ? 650 : 160;
  const hit = offset + windup + (special ? 680 : bed ? 650 : 220);
  const helper = events.find(event => event.kind === 'companion' && event.amount > 0);
  const soloHits = !special ? helper?.allies ?? [] : [];
  const assistDelay = helper ? special ? 1200 : soloHits.length ? 480 + (soloHits.length - 1) * 360 : 1000 : 0;
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
    if (event.kind === 'crystalHeal' && events.some(hit => ['hit', 'bed'].includes(hit.kind) && hit.target === 'body')) impact.bodyHp += event.amount;
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
    if (soloHits.length) {
      let cumulative = structuredClone(ownImpact);
      soloHits.forEach((allyHit, i) => {
        frames.push({ at: at(hit + 280 + i * 360), stage: 'assist', shown: cumulative, allyHit });
        const next = structuredClone(cumulative);
        if (helper.target === 'body') next.bodyHp = Math.max(0, next.bodyHp - allyHit.amount);
        else if (helper.target === 'orb') next.orbHp = Math.max(0, next.orbHp - allyHit.amount);
        else if (helper.target?.startsWith('wing:')) next.wings[Number(helper.target.split(':')[1])] -= allyHit.amount;
        else if (helper.target?.startsWith('crystal:')) next.crystals[Number(helper.target.split(':')[1])] -= allyHit.amount;
        cumulative = i === soloHits.length - 1 ? impact : next;
        frames.push({ at: at(hit + 480 + i * 360), stage: 'assistImpact', shown: cumulative, allyHit });
      });
    } else {
      frames.push({ at: at(hit + (special ? 450 : 280)), stage: 'assist', shown: ownImpact });
      frames.push({ at: at(hit + assistDelay), stage: 'assistImpact', shown: impact });
    }
  }
  const resolved = hit + assistDelay + (helper ? 350 : 0);
  const effectEvents = events.filter(event => ['burn', 'effect', 'heal'].includes(event.kind));
  const effectDelay = effectEvents.length ? 650 : 0;
  const settled = structuredClone(impact);
  if (reflection) settled.bodyHp = Math.max(0, settled.bodyHp - reflection.amount);
  for (const event of effectEvents) {
    if (event.kind === 'burn') settled.bodyHp = Math.max(0, settled.bodyHp - event.amount);
    if (event.kind === 'heal') settled.hp = Math.min(before.hp + event.amount, after.hp);
  }
  if (!events.some(hit => ['hit', 'bed'].includes(hit.kind) && hit.target === 'body')) settled.bodyHp += events.filter(event => event.kind === 'crystalHeal').reduce((sum, event) => sum + event.amount, 0);
  settled.effects = after.effects;
  if (effectDelay) frames.push({ at: at(resolved + (reflection ? 1200 : 220)), stage: 'effect', shown: settled });
  if (reflection) {
    frames.push({ at: at(resolved + 350), stage: 'reflect', shown: impact });
    frames.push({ at: at(resolved + 970), stage: 'reflected', shown: { ...impact, bodyHp: Math.max(0, impact.bodyHp - reflection.amount) } });
  }
  if (counter) {
    frames.push({ at: at(resolved + effectDelay + 350), stage: 'enemyWindup', shown: settled });
    frames.push({ at: at(resolved + effectDelay + enemyLaunch), stage: 'counter', shown: settled });
    frames.push({ at: at(resolved + effectDelay + enemyContact), stage: 'hurt', shown: { ...settled, hp: after.hp } });
  }
  if (won) frames.push({ at: at(resolved + effectDelay + (reflection ? 1350 : 650)), stage: 'victory', shown: after });
  frames.sort((a, b) => a.at - b.at);
  return { frames, duration: at(resolved + effectDelay + (reflection ? won ? 2200 : 1550 : counter ? enemyContact + 650 : won ? 1500 : special || bed ? 1600 : 800)) };
}
