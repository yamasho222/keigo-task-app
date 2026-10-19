import type { MiningState } from './miningTypes';
import { addTickets } from './miningProgress';

export const FULL_DAY_TICKETS = 2;
/** Preserve legacy claims: no retroactive top-ups or repeat grants after undo/reload. */
export function grantFullDayTickets(state: MiningState, date: string): MiningState {
  if (state.fullDayTicketClaimed[date]) return state;
  return { ...addTickets(state, FULL_DAY_TICKETS), fullDayTicketClaimed: { ...state.fullDayTicketClaimed, [date]: true } };
}
