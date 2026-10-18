import { ENDERMAN_ACTIONS_PER_TICKET, type EndermanAction, type EndermanEvent, type EndermanRun } from './endermanPrototypeEngine';
import { isBattleUltimate } from './battleSkillRules';

export type EndermanStage = 'ticket' | 'focus' | 'strike' | 'impact' | 'effect' | 'guard' | 'counter' | 'hurt' | 'eat' | 'heal';
export type EndermanFrame = { at: number; stage: EndermanStage; shown: EndermanRun };

export function buildEndermanPlayback(before: EndermanRun, after: EndermanRun, action: EndermanAction, events: EndermanEvent[]) {
  const frames: EndermanFrame[] = [];
  if (['return', 'equip', 'beginSkill', 'chooseSkill', 'cancelSkill'].includes(action.kind)) return { frames, duration: 0, events };
  if (action.kind === 'eat') return {
    frames: [{ at: 0, stage: 'eat', shown: { ...before, bread: after.bread } }, { at: 450, stage: 'heal', shown: after }] as EndermanFrame[],
    duration: 1050, events,
  };
  const offset = before.handsLeft === 0 ? 400 : 0;
  const windup = isBattleUltimate(action.kind) ? 560 : 0;
  const burn = events.filter(e => e.kind === 'burn').reduce((sum, e) => sum + e.amount, 0);
  const effectDelay = events.some(e => e.kind === 'effect' || e.kind === 'burn') ? 650 : 0;
  const spent = { ...before, tickets: after.tickets, handsLeft: (offset ? ENDERMAN_ACTIONS_PER_TICKET : before.handsLeft) - 1, turn: after.turn };
  const impacted = { ...spent, enemyHp: after.enemyHp + burn, gauge: after.gauge, misses: after.misses };
  const effected = { ...impacted, enemyHp: after.enemyHp, effects: after.effects, hp: Math.min(before.maxHp, before.hp + events.filter(e => e.kind === 'heal').reduce((sum, e) => sum + e.amount, 0)) };
  if (offset) frames.push({ at: 0, stage: 'ticket', shown: { ...before, tickets: after.tickets, handsLeft: ENDERMAN_ACTIONS_PER_TICKET } });
  if (windup) frames.push({ at: offset, stage: 'focus', shown: spent });
  frames.push({ at: offset + windup, stage: action.kind === 'guard' ? 'guard' : 'strike', shown: spent });
  frames.push({ at: offset + windup + 340, stage: action.kind === 'guard' ? 'guard' : 'impact', shown: impacted });
  if (effectDelay) frames.push({ at: offset + windup + 650, stage: 'effect', shown: effected });
  if (after.phase !== 'won') {
    frames.push({ at: offset + windup + effectDelay + 880, stage: 'counter', shown: effected });
    frames.push({ at: offset + windup + effectDelay + 1220, stage: 'hurt', shown: { ...effected, hp: after.hp } });
  }
  return { frames, duration: offset + windup + effectDelay + (after.phase === 'won' ? 1350 : 1740), events };
}
