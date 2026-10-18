import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { projectAdventure, transitionAdventure, type AdventureCommand, type AdventureResult } from './adventureSession';
import type { AdventureLocation } from './adventureState';
import type { MiningState } from './miningTypes';
import type { MiningPatch } from './miningCommit';
import type { BuddyProgressMap } from './buddyProgress';

export function useAdventureController(mining: MiningState, location: AdventureLocation, day: string, buddies: BuddyProgressMap | undefined, onChange: (patch: MiningPatch) => void) {
  const latest = useRef(mining);
  const entered = useRef('');
  const [error, setError] = useState('');
  const [calendarDay, setCalendarDay] = useState(day);
  const activeDay = calendarDay > day ? calendarDay : day;
  useEffect(() => {
    const checkDay = () => setCalendarDay(new Date().toLocaleDateString('sv-SE'));
    window.addEventListener('focus', checkDay);
    document.addEventListener('visibilitychange', checkDay);
    const timer = window.setInterval(checkDay, 30_000);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', checkDay); document.removeEventListener('visibilitychange', checkDay); };
  }, []);
  useLayoutEffect(() => { latest.current = mining; }, [mining]);
  const send = useCallback((request: AdventureRequest) => {
    const command = { ...request, revision: latest.current.adventure?.revision ?? -1, day: activeDay, location } as AdventureCommand;
    let result: AdventureResult = { state: latest.current, error: '記録を更新できませんでした。' };
    onChange(state => { result = transitionAdventure(state, command, buddies); return result.state; });
    // App's resource updater runs once against its current ref before rendering.
    latest.current = result.state;
    return result;
  }, [activeDay, location, buddies, onChange]);
  const session = mining.adventure?.[location === 'the_end' ? 'dragon' : location === 'fortress' ? 'blaze' : 'enderman'];
  useEffect(() => {
    const key = `${location}:${activeDay}`;
    if (entered.current === key) return;
    if (mining.adventure?.dragon?.skills?.pending) return;
    entered.current = key;
    const result = send({ kind: 'enter' });
    if (result.error) queueMicrotask(() => setError(result.error!));
  }, [location, mining.adventure, activeDay, send]);
  return { send, error,
    view: mining.adventure && session ? projectAdventure(mining, location, buddies) : null };
}
type Strip<T> = T extends unknown ? Omit<T, 'revision' | 'day' | 'location'> : never;
export type AdventureRequest = Strip<AdventureCommand>;
