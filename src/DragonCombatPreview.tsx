import { useEffect, useRef, useState } from 'react';
import { DragonThreatArt, type DragonThreatKind, type DragonThreatPhase } from './DragonThreatArt';
import { DragonAttackFx } from './DragonAttackFx';
import { attackDamage, incomingDamage, type CampaignEquipment } from './campaignEquipment';
import type { BlazeAudioCue } from './blazePrototypeAudio';
import { dragonThreatTiming } from './dragonThreatPresentation';

const KINDS = [['claw', 'つめ'], ['gust', 'かぜ'], ['breath', 'ブレス'], ['orb', 'ひかりのたま'], ['storm', 'さいごのあらし'], ['critical', 'かいしん']] as const;
type PreviewKind = DragonThreatKind | 'critical';
/** Memory-only adult preview. No storage, campaign dispatch or RNG stream access. */
export function DragonCombatPreview({ equipment, reduced, compact, onClose, onCue }: { equipment: CampaignEquipment; reduced: boolean; compact: boolean; onClose: () => void; onCue: (cue: BlazeAudioCue) => void }) {
  const dialog = useRef<HTMLDialogElement>(null), cue = useRef(onCue);
  const [kind, setKind] = useState<PreviewKind>('breath'), [phase, setPhase] = useState<DragonThreatPhase>('windup');
  const [replay, setReplay] = useState(0), [guarded, setGuarded] = useState(false);
  const critical = kind === 'critical', heavy = ['breath', 'orb', 'storm'].includes(kind);
  const timing = dragonThreatTiming(kind === 'orb' ? 'orbFire' : kind === 'critical' ? 'claw' : kind);
  const launch = critical ? 160 : timing.launch;
  const contact = critical ? 380 : timing.contact;
  const raw = kind === 'storm' ? 24 : heavy ? 20 : kind === 'gust' ? 6 : 8;
  const amount = critical ? attackDamage(equipment, false, false, false).weapon * 2 : incomingDamage(equipment, raw, heavy ? 'fire' : 'physical', guarded);
  useEffect(() => { cue.current = onCue; }, [onCue]);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    const pace = reduced ? .5 : 1;
    const start = setTimeout(() => { setPhase('strike'); cue.current(critical ? 'slash' : heavy ? 'enemyUltimate' : 'enemy'); }, launch * pace);
    const hit = setTimeout(() => { setPhase('impact'); cue.current(critical ? 'critical' : guarded ? 'guard' : 'impact'); }, contact * pace);
    return () => { clearTimeout(start); clearTimeout(hit); };
  }, [replay, kind, reduced, launch, contact, critical, heavy, guarded]);
  function restart(next: PreviewKind = kind) { setKind(next); setPhase('windup'); setReplay(value => value + 1); }
  return <dialog ref={dialog} className={`dm-dialog dm-preview dt-preview ${compact ? 'dm-burst-compact' : ''}`} aria-label="試験用：敵の攻撃と会心プレビュー" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header><div><small>試験専用 · 記録変更なし</small><h2>{KINDS.find(entry => entry[0] === kind)?.[1]}</h2></div></header>
    <div className="dt-preview-choices">{KINDS.map(([id, name]) => <button type="button" key={id} aria-pressed={kind === id} onClick={() => restart(id)}>{name}</button>)}</div>
    <div className={`dm-preview-stage dt-preview-stage ${critical ? `dt-crit-preview-${phase}` : `dc-enemy-${phase}`} ${reduced ? 'dt-preview-calm' : ''}`} key={replay}>
      <img className="dt-preview-dragon" src={reduced ? '/mining/Ender_Dragon_Campaign_v1.png' : '/mining/Ender_Dragon.gif'} alt="エンダードラゴン" />
      {critical ? <DragonAttackFx critical technique="cleave" stage={phase} special={false} counter={false} stroke={0} reduced={reduced} buddies={[]} sword={equipment.sword} /> : <DragonThreatArt kind={kind} phase={phase} reduced={reduced} guarded={guarded} />}
      {phase === 'impact' && <span className={`dt-preview-number ${critical ? 'dt-preview-critical' : ''}`} role="status">{critical && <small>かいしん！</small>}−{amount}</span>}
    </div>
    <p className="dt-preview-note">いまの装備での{critical ? '通常時の会心' : 'ダメージ'}。HP・チケットは変わりません。</p>
    {!critical && <label className="dt-preview-guard"><input type="checkbox" checked={guarded} onChange={event => { setGuarded(event.target.checked); restart(); }} />まもる演出もみる</label>}
    <button type="button" className="dm-fire" onClick={() => restart()}>もういちど みる</button>
    <button type="button" className="dm-secondary" onClick={onClose}>もどる</button>
  </dialog>;
}
