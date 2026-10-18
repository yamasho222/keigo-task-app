import { defaultEquipment, defaultSupplies, fullArmor, type AttackEnchant, type CampaignEquipment } from './campaignEquipment';
import { campaignBedAvailable, campaignCounterDamage, campaignIntent, createDragonCampaign, isDragonCampaign, refreshCampaignDay, stepDragonCampaign, type CampaignAction, type CampaignPhase, type CampaignTarget } from './dragonCampaignEngine';
import { dragonFocusTarget, enableDragonAdventure } from './dragonCampaignAdventure';
import { enableDragonSkills, skillOffers } from './dragonSkillRules';
import { enableDragonCritical } from './dragonCriticalRules';

export type DragonBalanceReport = {
  won: boolean; tickets: number; actions: number; days: number; bread: number; beds: number; defeats: number;
  phaseActions: Record<CampaignPhase, number>; invalidStates: number;
};
/** A fixed policy running actual public engine actions, not a second damage formula.
 * Harvest/craft costs are deliberately excluded. There is NO daily ticket cap in gameplay.
 */
export function simulateDragonCampaign(equipment: CampaignEquipment, dailyTickets = 5, adventure = false, skillScore: number | null = null, critical = false, seed?: number): DragonBalanceReport {
  if (!Number.isInteger(dailyTickets) || dailyTickets < 1) throw new Error('Invalid daily ticket assumption');
  const supplies = defaultSupplies(); supplies.materials.bread = 200; supplies.materials.spare_bed = 3;
  let state = createDragonCampaign('2026-10-17', { equipment, supplies, tickets: 1000 });
  if (critical) { state = enableDragonCritical(state); if (seed !== undefined) state.critical!.seed = seed >>> 0; }
  if (adventure) state = enableDragonAdventure(state);
  if (skillScore !== null) {
    if (!Number.isInteger(skillScore) || skillScore < 0 || skillScore > 100) throw new Error('Invalid skill score');
    state = enableDragonSkills(state);
  }
  state.status = 'battle';
  let days = 1, dayStartTickets = state.tickets, bread = 0, invalidStates = 0;
  const phaseActions: DragonBalanceReport['phaseActions'] = { crystals: 0, wings: 0, orb: 0, rage: 0 };
  const tomorrow = () => {
    const date = new Date(`${state.day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + 1);
    state = refreshCampaignDay(state, date.toISOString().slice(0, 10)); days++; dayStartTickets = state.tickets;
  };
  for (let step = 0; step < 4000 && state.status !== 'won'; step++) {
    if (state.hands === 0 && dayStartTickets - state.tickets >= dailyTickets) tomorrow();
    let action: CampaignAction;
    if (state.status === 'lost') action = { kind: 'retry' };
    else if (state.foodToday < 2 && state.hp < 20 && (state.hp <= 10 || campaignCounterDamage(state) >= state.hp)) action = { kind: 'heal' };
    else {
      let target: CampaignTarget = 'body';
      if (state.landingTurns === 0) {
        if (state.phase === 'crystals') target = `crystal:${state.crystals.findIndex(hp => hp > 0)}`;
        else if (state.phase === 'wings' && state.wings.some(hp => hp > 0)) target = dragonFocusTarget(state) ?? `wing:${state.wings.findIndex(hp => hp > 0)}`;
        else if (state.orbHp > 0) target = 'orb';
      }
      if (target !== state.selected) state = stepDragonCampaign(state, { kind: 'select', target }).state;
      const special = !state.adventure?.counter && state.gauge === 3 && (target === 'orb' || state.landingTurns > 0 || campaignCounterDamage(state) > 0);
      const bed = !special && campaignBedAvailable(state) && (state.landingTurns > 0 || campaignCounterDamage(state) >= state.hp);
      const guard = !special && !bed && ['breath', 'orbFire', 'storm'].includes(campaignIntent(state));
      action = { kind: special ? 'ultimate' : bed ? 'bed' : guard ? 'guard' : 'attack' };
    }
    const oldPhase = state.phase, turns = state.turns;
    if (action.kind === 'ultimate' && state.skills) {
      const begin = stepDragonCampaign(state, { kind: 'beginSkill' });
      if (begin.error) throw new Error(begin.error);
      state = begin.state;
      const pending = state.skills!.pending!;
      if (pending.mode === null) {
        const choice = stepDragonCampaign(state, { kind: 'chooseSkill', token: pending.token, mode: skillOffers(state.skills!.casts, state.skills!.last)[0] });
        if (choice.error) throw new Error(choice.error);
        state = choice.state;
      }
      action = { kind: 'releaseSkill', token: pending.token, score: skillScore! };
    }
    const result = stepDragonCampaign(state, action);
    if (result.error) throw new Error(`Balance policy rejected ${action.kind}: ${result.error}`);
    state = result.state;
    phaseActions[oldPhase] += state.turns - turns;
    if (action.kind === 'heal') bread++;
    if (!isDragonCampaign(state)) invalidStates++;
  }
  return { won: state.status === 'won', tickets: 1000 - state.tickets, actions: state.turns, days, bread, beds: state.bedsUsed, defeats: state.defeats, phaseActions, invalidStates };
}

export function dragonBalanceEquipment(tier: 'mixed' | 'iron' | 'diamond' | 'netherite', rank: 0 | 1 | 2 | 3, kind: AttackEnchant = 'power'): CampaignEquipment {
  const equipment = defaultEquipment();
  if (tier !== 'mixed') equipment.armor = fullArmor(tier);
  equipment.sword = tier === 'netherite' ? 'netherite' : 'diamond';
  equipment.attack = { kind: rank > 0 ? kind : 'none', rank };
  equipment.defense = { kind: rank > 0 ? 'health' : 'none', rank };
  return equipment;
}
