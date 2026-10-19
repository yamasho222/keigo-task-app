import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { projectAdventure, transitionAdventure, type AdventureCommand, type AdventureResult } from './adventureSession';
import type { AdventureLocation } from './adventureState';
import type { MiningState } from './miningTypes';
import type { MiningPatch } from './miningCommit';
import type { BuddyProgressMap } from './buddyProgress';
import { isBattleNightLocked } from './miningNightLock';

export function useAdventureController(mining: MiningState, location: AdventureLocation, day: string, buddies: BuddyProgressMap | undefined, onChange: (patch: MiningPatch) => void, nightLockEnabled = false) {
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
    const nightError = 'きょうの たたかいは おしまい。また あした あそぼう。';
    // Read the actual clock for every dispatch, including automatic entry.
    if (isBattleNightLocked({ enabled: nightLockEnabled })) return { state: latest.current, error: nightError };
    const command = { ...request, revision: latest.current.adventure?.revision ?? -1, day: activeDay, location } as AdventureCommand;
    let result: AdventureResult = { state: latest.current, error: '記録を更新できませんでした。' };
    onChange(state => {
      // A delayed updater must not commit an action across the cutoff either.
      result = isBattleNightLocked({ enabled: nightLockEnabled }) ? { state, error: nightError } : transitionAdventure(state, command, buddies);
      return result.state;
    });
    // App's resource updater runs once against its current ref before rendering.
    latest.current = result.state;
    return result;
  }, [activeDay, location, buddies, onChange, nightLockEnabled]);
  const session = mining.adventure?.[location === 'the_end' ? 'dragon' : location === 'fortress' ? 'blaze' : 'enderman'];
  useEffect(() => {
    const key = `${location}:${activeDay}`;
    if (entered.current === key) return;
    if ([mining.adventure?.dragon, mining.adventure?.blaze, mining.adventure?.enderman].some(run => run?.skills?.pending)) return;
    entered.current = key;
    const result = send({ kind: 'enter' });
    if (result.error) queueMicrotask(() => setError(result.error!));
  }, [location, mining.adventure, activeDay, send]);
  return { send, error,
    view: mining.adventure && session ? projectAdventure(mining, location, buddies) : null };
}
type Strip<T> = T extends unknown ? Omit<T, 'revision' | 'day' | 'location'> : never;
export type AdventureRequest = Strip<AdventureCommand>;
