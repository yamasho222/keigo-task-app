import {
  actOnBlaze, blazeIncomingDamage, createBlazeRun,
  type BlazeAction, type BlazePhase, type BlazeStartOptions,
} from './blazePrototypeEngine';

export type BlazePolicy = 'aggressive' | 'guarded' | 'prepared';
export type BlazeSimulationResult = {
  phase: BlazePhase | 'stalled';
  ticketsSpent: number;
  turns: number;
  breadUsed: number;
  hpHearts: number;
  enemyHp: number;
};

/** Deterministic test policies, not production AI. Bread does not advance turns. */
export function simulateBlaze(options: BlazeStartOptions, policy: BlazePolicy): BlazeSimulationResult {
  let state = createBlazeRun(options);
  const initialTickets = state.tickets;
  const initialBread = state.bread;
  for (let step = 0; step < 64 && state.phase === 'battle'; step += 1) {
    if (state.tickets === 0 && state.handsLeft === 0) break;
    const enemy = state.enemies[0];
    const needsBread = state.hp < state.maxHp && (
      blazeIncomingDamage(state.loadout, enemy.intent) >= state.hp || state.hp <= 10
    );
    let action: BlazeAction;
    if (policy === 'prepared' && state.bread > 0 && needsBread) {
      action = { kind: 'eat' };
    } else if (state.gauge === 3) {
      action = { kind: 'ultimate', enemyId: enemy.id };
    } else if (policy === 'guarded' && enemy.intent === 'burst') {
      action = { kind: 'guard' };
    } else {
      action = { kind: 'strike', target: { enemyId: enemy.id, part: 'body' } };
    }
    const result = actOnBlaze(state, action);
    if (result.error) break;
    state = result.state;
  }
  return {
    phase: state.phase === 'battle' ? 'stalled' : state.phase,
    ticketsSpent: initialTickets - state.tickets,
    turns: state.turn,
    breadUsed: initialBread - state.bread,
    hpHearts: state.hp / 2,
    enemyHp: state.enemies[0].hp,
  };
}
