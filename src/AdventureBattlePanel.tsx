import { useLayoutEffect, useRef, useState } from 'react';
import BlazePrototype from './BlazePrototype';
import EndermanPrototype from './EndermanPrototype';
import DragonCampaignLab from './DragonCampaignLab';
import { useAdventureController } from './useAdventureController';
import type { MiningState } from './miningTypes';
import type { MiningPatch } from './miningCommit';
import type { BuddyProgressMap } from './buddyProgress';
import type { AdventureLocation } from './adventureState';
import type { CampaignOutcome } from './dragonCampaignEngine';
import type { actOnBlaze } from './blazePrototypeEngine';
import type { actOnEnderman } from './endermanPrototypeEngine';
import './adventureProduction.css';

/** Normal in-app entry. The parent profile owns every resource and save. */
export function AdventureBattlePanel({ mining, location, dateKey, buddyProgress, onChange, onClose, onPrepare }: { mining: MiningState; location: AdventureLocation; dateKey: string; buddyProgress?: BuddyProgressMap; onChange: (patch: MiningPatch) => void; onClose: () => void; onPrepare?: () => void }) {
  const { view, send, error } = useAdventureController(mining, location, dateKey, buddyProgress, onChange);
  const [notice, setNotice] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const ready = !!view && !error;
  useLayoutEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => { if (element?.open) element.close(); };
  }, [ready]);
  const run = (kind: 'retry' | 'next' | 'lesson') => {
    const result = send({ kind }); setNotice(result.error ?? '');
    if (kind === 'retry' && !result.error) send({ kind: 'enter' });
  };
  if (!view || error) return <section className="adventure-production" role="alert">{error || 'たたかいの きろくを よみこんでいます…'}<button type="button" onClick={onClose}>もどる</button></section>;
  const common = { onClose, retry: () => run('retry'), next: () => run('next'), onHelp: () => run('lesson'),
    breadStock: mining.materials.bread ?? 0, foodToday: mining.adventure?.foodToday ?? 0,
    seenHelp: !!mining.adventure?.lessons[location], endermanDefeats: mining.adventure?.endermanDefeats ?? 0,
    heldItems: ['none', ...(mining.materials.shield ? ['shield'] : []), ...(mining.materials.water ? ['water'] : [])] };
  return <dialog ref={dialog} className="adventure-production" aria-label="ぼうけんの戦闘" onCancel={event => event.preventDefault()}>
    {notice && <p className="adventure-notice" role="alert">{notice}</p>}
    {view.kind === 'blaze' ? <BlazePrototype production={{ ...common, run: view.run, act: action => {
      const result = send({ kind: 'blaze', action }); return (result.outcome as ReturnType<typeof actOnBlaze> | undefined) ?? { state: view.run, events: [], error: result.error };
    } }} /> : view.kind === 'enderman' ? <EndermanPrototype production={{ ...common, run: view.run, act: action => {
      const result = send({ kind: 'enderman', action }); return (result.outcome as ReturnType<typeof actOnEnderman> | undefined) ?? { state: view.run, events: [], error: result.error };
    } }} /> : <DragonCampaignLab production={{ ...common, onPrepare: () => {
      const result = send({ kind: 'dragon', action: { kind: 'pause' } });
      if (result.error) setNotice(result.error); else (onPrepare ?? onClose)();
    }, run: view.run, act: action => {
      const result = send({ kind: 'dragon', action }); return (result.outcome as CampaignOutcome | undefined) ?? { state: view.run, events: [], error: result.error };
    } }} />}
    {view.run.hp === 0 && <button className="adventure-back" type="button" onClick={onPrepare ?? onClose}>そうび・クラフトへ</button>}
  </dialog>;
}
