import { BLAZE_ACTIONS_PER_TICKET, type BlazeAction, type BlazeEvent, type BlazeRun } from './blazePrototypeEngine';
import { isBattleUltimate } from './battleSkillRules';

export type BlazePlaybackStage = 'ticket' | 'focus' | 'strike' | 'impact' | 'effect' | 'guard' | 'counter' | 'hurt' | 'eat' | 'heal';
export type BlazePlaybackFrame = { at: number; stage: BlazePlaybackStage; shown: BlazeRun };
export type BlazePlayback = { frames: BlazePlaybackFrame[]; duration: number; events: BlazeEvent[] };

/** Presentation snapshots only. The engine result remains the single authoritative outcome. */
export function buildBlazePlayback(before: BlazeRun, after: BlazeRun, action: BlazeAction, events: BlazeEvent[]): BlazePlayback {
  if (['return', 'equip', 'beginSkill', 'chooseSkill', 'cancelSkill'].includes(action.kind)) return { frames: [], duration: 0, events };
  if (action.kind === 'eat') {
    return {
      frames: [
        { at: 0, stage: 'eat', shown: { ...before, bread: after.bread } },
        { at: 500, stage: 'heal', shown: after },
      ],
      duration: 1200, events,
    };
  }

  const buysTicket = before.handsLeft === 0;
  const offset = buysTicket ? 400 : 0;
  const special = isBattleUltimate(action.kind);
  const windup = special ? 560 : 0;
  const burn = events.filter(e => e.kind === 'burn').reduce((sum, e) => sum + e.amount, 0);
  const effectDelay = events.some(e => e.kind === 'effect' || e.kind === 'burn') ? 650 : 0;
  const spent: BlazeRun = {
    ...before,
    tickets: after.tickets,
    handsLeft: (buysTicket ? BLAZE_ACTIONS_PER_TICKET : before.handsLeft) - 1,
    turn: after.turn,
  };
  // Preserve the *old* telegraph until its attack is finished. No premature defeat/reward UI.
  const impacted: BlazeRun = {
    ...spent,
    gauge: after.gauge,
    enemies: before.enemies.map(enemy => ({ ...enemy, hp: after.enemies.find(next => next.id === enemy.id)!.hp + burn })),
  };
  const effected = { ...impacted, hp: Math.min(before.maxHp, before.hp + events.filter(e => e.kind === 'heal').reduce((sum, e) => sum + e.amount, 0)), effects: after.effects,
    enemies: impacted.enemies.map(enemy => ({ ...enemy, hp: Math.max(0, enemy.hp - burn) })) };
  const frames: BlazePlaybackFrame[] = [];
  if (buysTicket) frames.push({ at: 0, stage: 'ticket', shown: { ...before, tickets: after.tickets, handsLeft: BLAZE_ACTIONS_PER_TICKET } });
  if (special) frames.push({ at: offset, stage: 'focus', shown: spent });
  frames.push({ at: offset + windup, stage: action.kind === 'guard' ? 'guard' : 'strike', shown: spent });
  frames.push({ at: offset + windup + 340, stage: action.kind === 'guard' ? 'guard' : 'impact', shown: impacted });
  if (effectDelay) frames.push({ at: offset + windup + 650, stage: 'effect', shown: effected });
  if (after.phase !== 'won') {
    frames.push({ at: offset + windup + effectDelay + 850, stage: 'counter', shown: effected });
    frames.push({ at: offset + windup + effectDelay + 1250, stage: 'hurt', shown: { ...effected, hp: after.hp } });
  }
  return { frames, duration: offset + windup + effectDelay + (after.phase === 'won' ? special ? 1400 : 1100 : 1750), events };
}
