import { useId, useLayoutEffect, useRef, useState } from 'react';
import { MiningItemIcon } from './MiningItemIcon';
import type { MaterialId } from './miningTypes';
import './battleItems.css';

export type HeldBattleItem = 'none' | 'water' | 'shield';
export function BattleBagIcon() {
  return <svg className="battle-bag-icon" viewBox="0 0 64 64" aria-hidden="true"><path d="M12 18h40v37H12z" fill="#98643e" stroke="#eed2a5" strokeWidth="3" /><path d="M10 18Q32 2 54 18v9H10Z" fill="#c28c51" stroke="#eed2a5" strokeWidth="3" /><path d="M12 32h40M21 18v36m22-36v36" fill="none" stroke="#5d3b25" strokeWidth="4" /><path d="M28 26h8v13h-8z" fill="#ffd572" /></svg>;
}

/** No effects are advertised outside this owned-inventory drawer. */
export function BattleItemsDialog({ held, items, bedAvailable, bedsLeft = 0, onHold, onBed, onPrepare, onClose }: {
  held: HeldBattleItem; items: { id: 'water' | 'shield' | 'spare_bed'; count: number }[];
  bedAvailable?: boolean; bedsLeft?: number; onHold: (item: HeldBattleItem) => string | undefined;
  onBed?: () => void; onPrepare?: () => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), title = useId();
  const confirmation = useRef<HTMLElement>(null);
  const [confirmBed, setConfirmBed] = useState(false), [message, setMessage] = useState('');
  useLayoutEffect(() => { const element = dialog.current; element?.showModal(); return () => { if (element?.open) element.close(); }; }, []);
  useLayoutEffect(() => { if (confirmBed) confirmation.current?.focus(); }, [confirmBed]);
  function hold(item: HeldBattleItem) { const error = onHold(item); if (error) setMessage(error); else onClose(); }
  return <dialog ref={dialog} className="battle-items-dialog" aria-labelledby={title} onCancel={event => { event.preventDefault(); onClose(); }}>
    <header><h2 id={title}><BattleBagIcon />もちもの</h2><button type="button" aria-label="もちものをとじる" onClick={onClose}>×</button></header>
    <div className="battle-items-grid">
      {items.filter(item => item.count > 0).map(item => <button type="button" key={item.id}
        aria-label={`${item.id === 'water' ? 'みず' : item.id === 'shield' ? 'たて' : 'ベッド'} ${item.count}こ`}
        aria-pressed={item.id === 'spare_bed' ? undefined : held === item.id}
        onClick={() => item.id === 'spare_bed' ? setConfirmBed(true) : hold(item.id)}>
        <MiningItemIcon material={item.id as MaterialId} size={70} /><b>{item.id === 'water' ? 'みず' : item.id === 'shield' ? 'たて' : 'ベッド'}</b>
        <small>×{item.count}{held === item.id ? '　✓' : ''}</small>
      </button>)}
    </div>
    {items.every(item => item.count <= 0) && <p>まだ なにも ないよ</p>}
    {held !== 'none' && <button type="button" className="battle-items-plain" onClick={() => hold('none')}>てから はずす</button>}
    <small className="battle-items-note">てに もつ・はずすと ●1こ。てきは うごかないよ。</small>
    {confirmBed && <section ref={confirmation} tabIndex={-1} className="battle-bed-confirm" aria-label="ベッドを使う確認"><MiningItemIcon material="spare_bed" size={70} /><h3>ベッドを つかう？</h3>
      <p>1こ つかうよ · のこり {bedsLeft}かい</p>
      {!bedAvailable && <p role="status">いまは つかえないみたい…</p>}
      <button type="button" disabled={!bedAvailable} onClick={() => { onClose(); onBed?.(); }}>つかう ●1こ</button>
      <button type="button" className="battle-items-plain" onClick={() => setConfirmBed(false)}>やめる</button>
    </section>}
    {message && <p role="alert">{message}</p>}
    {onPrepare && <button type="button" className="battle-items-plain" onClick={onPrepare}>そうび・クラフトへ</button>}
  </dialog>;
}
