import { useCallback, useEffect, useId, useLayoutEffect, useRef } from 'react';
import type { CampaignEquipment } from './campaignEquipment';
import './dragonCompanionRescue.css';

/** Story only: never deals damage, consumes a ticket or grants a new companion. */
export function DragonCompanionRescue({ buddies, reduced, onDone }: { buddies: CampaignEquipment['buddies']; reduced: boolean; onDone: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), callback = useRef(onDone), done = useRef(false);
  const keyFilter = `rescue-key-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  useLayoutEffect(() => { callback.current = onDone; }, [onDone]);
  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    void Promise.resolve(callback.current()).finally(() => { done.current = false; });
  }, []);
  useEffect(() => {
    const el = dialog.current; el?.showModal();
    const timer = window.setTimeout(finish, reduced ? 1800 : 4500);
    return () => { window.clearTimeout(timer); el?.close(); };
  }, [reduced, finish]);
  return <dialog className={`companion-rescue ${reduced ? 'rescue-reduced' : ''}`} ref={dialog} aria-label="仲間が助けに来た" onCancel={event => { event.preventDefault(); finish(); }}>
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs><filter id={keyFilter} colorInterpolationFilters="sRGB"><feColorMatrix result="keyed" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -.2126 -.7152 -.0722 0 1" /><feComposite in="keyed" in2="SourceGraphic" operator="in" /></filter></defs></svg>
    <div className="rescue-world" aria-hidden="true"><img className="rescue-dragon" style={!reduced ? { filter: `url(#${keyFilter}) drop-shadow(0 0 8px #ae75e855)` } : undefined} src={reduced ? '/mining/Ender_Dragon_Campaign_v1.png' : '/mining/Ender_Dragon.gif'} alt="" /><div className="rescue-gust" /><div className="rescue-team"><img className="rescue-steve" src="/mining/Steve.png" alt="" />{buddies.slice(0, 3).map((buddy, i) => <img key={buddy.id} className={`rescue-buddy rescue-buddy-${i}`} src={buddy.image} alt="" />)}</div><div className="rescue-shield" /></div>
    <h2>いっしょに たたかうぞ！</h2><button onClick={finish}>いこう！</button>
  </dialog>;
}
