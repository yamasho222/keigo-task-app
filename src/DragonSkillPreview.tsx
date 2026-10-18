import { useEffect, useRef, useState } from 'react';
import { DragonAttackFx } from './DragonAttackFx';
import { SKILL_TITLES, type DragonSkillKind } from './dragonSkillRules';
import type { SwordTier } from './campaignEquipment';

/** Adult-only, memory-only preview. It cannot access tickets or a saved campaign. */
export function DragonSkillPreview({ kind, score, reduced, onClose, onStrike, compact = false, sword }: { kind: DragonSkillKind; score: number; reduced: boolean; onClose: () => void; onStrike: () => void; compact?: boolean; sword?: SwordTier }) {
  const dialog = useRef<HTMLDialogElement>(null), cue = useRef(onStrike);
  const [stage, setStage] = useState<'windup' | 'strike' | 'impact' | 'recover'>('windup'), [replay, setReplay] = useState(0);
  useEffect(() => { cue.current = onStrike; }, [onStrike]);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    const launch = setTimeout(() => { setStage('strike'); cue.current(); }, reduced ? 450 : 900);
    const contact = setTimeout(() => setStage('impact'), reduced ? 790 : 1580);
    const recover = setTimeout(() => setStage('recover'), reduced ? 1250 : 2400);
    return () => { clearTimeout(launch); clearTimeout(contact); clearTimeout(recover); };
  }, [replay, reduced, kind]);
  return <dialog ref={dialog} className={`dm-dialog dm-preview dm-${kind} ${compact ? 'dm-burst-compact' : ''}`} aria-label="試験用：必殺の演出プレビュー" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header><div><small>試験専用 · チケット消費なし</small><h2>{SKILL_TITLES[kind]}</h2></div><b>{score}点</b></header>
    <div className="dm-preview-stage" key={replay}><img src={reduced ? '/mining/Ender_Dragon_Campaign_v1.png' : '/mining/Ender_Dragon.gif'} alt="エンダードラゴン" />
      <DragonAttackFx skill={kind} power={score / 100} technique="cleave" stage={stage} special counter={false} stroke={0} reduced={reduced} buddies={[]} sword={sword} />
    </div>
    <button type="button" className="dm-fire" onClick={() => { setStage('windup'); setReplay(value => value + 1); }}>もういちど みる</button>
    <button type="button" className="dm-secondary" onClick={onClose}>もどる</button>
  </dialog>;
}
