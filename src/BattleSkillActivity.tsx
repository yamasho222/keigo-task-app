import { useLayoutEffect, useRef } from 'react';
import { DragonSkillGame, SkillGlyph } from './DragonSkillGame';
import { playableSkill, type DragonSkillKind, type DragonSkills } from './dragonSkillRules';
import type { BattleSkillAction } from './battleSkillRules';
import './battleSkillActivity.css';

const LABELS = { repel: 'みず', aim: 'ひかり', burst: 'ほのお', gauge: 'かみなり' };
const EFFECTS = { repel: '🛡 ×2', aim: '♥ ＋4', burst: '🔥 5 ×3', gauge: '⚡ ×1' };
function Picker({ choices, onChoose, onCancel }: { choices: DragonSkillKind[]; onChoose: (kind: DragonSkillKind) => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => { const el = dialog.current; el?.showModal(); return () => el?.close(); }, []);
  return <dialog className="battle-skill-picker" ref={dialog} aria-labelledby="skill-picker-title" onCancel={event => { event.preventDefault(); onCancel(); }}>
    <h2 id="skill-picker-title">どれで いく？</h2>
    <div className="battle-skill-choices">{choices.map(kind => <button key={kind} className={`battle-skill-choice skill-${kind}`} aria-label={`${LABELS[kind]}のひっさつ`} onClick={() => onChoose(kind)}>
      <SkillGlyph kind={kind} /><strong>{LABELS[kind]}</strong><small aria-hidden="true">{EFFECTS[kind]}</small>
    </button>)}</div>
    <button className="battle-skill-cancel" onClick={onCancel}>もどる</button>
  </dialog>;
}
/** All battle kinds share the same persisted choice and scored game, not UI-only casts. */
export function BattleSkillActivity({ skills, unlocked, onAction, sound, reduced, compact = false, blocked = false, liveToken, onReload }: {
  skills?: DragonSkills; unlocked: DragonSkillKind[]; onAction: (action: BattleSkillAction) => unknown;
  sound: boolean; reduced: boolean; compact?: boolean; blocked?: boolean; liveToken: string; onReload?: () => void;
}) {
  const pending = skills?.pending;
  if (!pending) return null;
  if (pending.mode === null) return <Picker choices={unlocked} onChoose={mode => { if (!blocked) onAction({ kind: 'chooseSkill', token: pending.token, mode }); }} onCancel={() => { if (!blocked) onAction({ kind: 'cancelSkill' }); }} />;
  return <DragonSkillGame key={`${pending.token}:${pending.mode}`} kind={playableSkill(pending.mode)} reduced={reduced} sound={sound} compact={compact} blocked={blocked} onReload={onReload}
    resumed={liveToken !== `${pending.token}:${pending.mode}`}
    onDone={score => onAction({ kind: 'releaseSkill', token: pending.token, score })} />;
}
