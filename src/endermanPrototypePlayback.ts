import { ENDERMAN_ACTIONS_PER_TICKET, type EndermanAction, type EndermanEvent, type EndermanRun } from './endermanPrototypeEngine';

export type EndermanStage = 'ticket' | 'focus' | 'strike' | 'impact' | 'guard' | 'counter' | 'hurt' | 'eat' | 'heal';
export type EndermanFrame = { at: number; stage: EndermanStage; shown: EndermanRun };

export function buildEndermanPlayback(before: EndermanRun, after: EndermanRun, action: EndermanAction, events: EndermanEvent[]) {
  const frames: EndermanFrame[] = [];
  if (action.kind === 'return' || action.kind === 'equip') return { frames, duration: 0, events };
  if (action.kind === 'eat') return {
    frames: [{ at: 0, stage: 'eat', shown: { ...before, bread: after.bread } }, { at: 450, stage: 'heal', shown: after }] as EndermanFrame[],
    duration: 1050, events,
  };
  const offset = before.handsLeft === 0 ? 400 : 0;
  const windup = action.kind === 'ultimate' ? 560 : 0;
  const spent = { ...before, tickets: after.tickets, handsLeft: (offset ? ENDERMAN_ACTIONS_PER_TICKET : before.handsLeft) - 1, turn: after.turn };
  const impacted = { ...spent, enemyHp: after.enemyHp, gauge: after.gauge, misses: after.misses };
  if (offset) frames.push({ at: 0, stage: 'ticket', shown: { ...before, tickets: after.tickets, handsLeft: ENDERMAN_ACTIONS_PER_TICKET } });
  if (windup) frames.push({ at: offset, stage: 'focus', shown: spent });
  frames.push({ at: offset + windup, stage: action.kind === 'guard' ? 'guard' : 'strike', shown: spent });
  frames.push({ at: offset + windup + 340, stage: action.kind === 'guard' ? 'guard' : 'impact', shown: impacted });
  if (after.phase !== 'won') {
    frames.push({ at: offset + windup + 880, stage: 'counter', shown: impacted });
    frames.push({ at: offset + windup + 1220, stage: 'hurt', shown: { ...impacted, hp: after.hp } });
  }
  return { frames, duration: offset + windup + (after.phase === 'won' ? 1350 : 1740), events };
}
