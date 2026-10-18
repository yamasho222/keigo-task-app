import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { MiningItemIcon } from './MiningItemIcon';
import type { EndChapterNotice } from './endChapterNotices';
import './endChapterNotices.css';

function NoticeDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useLayoutEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => { if (element?.open) element.close(); };
  }, []);
  return <dialog className="end-update-dialog" ref={dialog} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <h2 id={titleId}>{title}</h2>
    {children}
    <button type="button" className="end-update-ok" onClick={onClose}>わかった！</button>
  </dialog>;
}

function BreadRecipePicture() {
  return <div className="end-update-recipe" role="img" aria-label="こむぎ3こで、パン1こをクラフト">
    <span><MiningItemIcon material="wheat" size={52} /><b>×3</b></span>
    <b aria-hidden="true">→</b><span><MiningItemIcon material="bread" size={64} /><b>×1</b></span>
  </div>;
}

export function BreadRecoveryHelp({ onClose }: { onClose: () => void }) {
  return <NoticeDialog title="パンで かいふく！" onClose={onClose}>
    <BreadRecipePicture />
    <p>クラフトで パンを つくろう</p>
    <div className="end-update-hearts" role="img" aria-label="パン1こでハート5こ回復">♥ ♥ ♥ ♥ ♥</div>
    <p>パンを たべると ハートが もどるよ</p>
    <small>こむぎは のうじょうで。かいふくは 1にち2かい。</small>
  </NoticeDialog>;
}

export function EndChapterNoticePanel({ kind, onClose }: { kind: EndChapterNotice; onClose: () => void }) {
  return kind === 'fortress' ? <NoticeDialog title="あたらしい ぼうけん！" onClose={onClose}>
    <img className="end-update-fortress" src="/mining/Nether_Fortress.jpg" alt="ネザー要塞" />
    <p><strong>ネザー要塞が ふえたよ！</strong></p>
    <p>こだいの ざんがいを みつけた きみは<br />もう あそびに いけるよ</p>
    <small>「ほる」で ネザー要塞を えらぼう</small>
  </NoticeDialog> : <NoticeDialog title="つくれるものが ふえたよ！" onClose={onClose}>
    <div className="end-update-craftables">
      <section><MiningItemIcon material="bread" size={72} /><h3>パン</h3><p>たべて かいふく</p></section>
      <section><MiningItemIcon material="shield" size={72} /><h3>たて</h3><p>クラフトできるよ</p></section>
    </div>
    <BreadRecipePicture />
    <small>ざいりょうを あつめて クラフトしよう！</small>
  </NoticeDialog>;
}
