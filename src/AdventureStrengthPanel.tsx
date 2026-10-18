import { useState } from 'react';
import type { MiningState } from './miningTypes';
import type { MiningPatch } from './miningCommit';
import { ensureAdventure, transitionAdventure } from './adventureSession';
import { campaignUpgradeCost } from './campaignEquipment';
import './adventureProduction.css';
export function AdventureStrengthPanel({ mining, dateKey, onChange }: { mining: MiningState; dateKey: string; onChange: (patch: MiningPatch) => void }) {
  const [notice, setNotice] = useState('');
  if (!mining.unlockedGachas.includes('fortress')) return null;
  const adventure = mining.adventure ?? ensureAdventure(mining, dateKey).adventure!;
  const location = mining.unlockedGachas.includes('the_end') ? 'the_end' : mining.unlockedGachas.includes('fortress') ? 'fortress' : 'warped_forest';
  const change = (category: 'attack' | 'defense', value?: string) => {
    onChange(state => {
      const result = transitionAdventure(state, { revision: mining.adventure?.revision ?? -1, day: dateKey, location,
        ...(value ? { kind: 'magic' as const, category, value } : { kind: 'upgrade' as const, category }) });
      // Errors are also computed before dispatch, below; keep this resource patch pure.
      return result.state;
    });
    const preview = transitionAdventure(mining, { revision: mining.adventure?.revision ?? -1, day: dateKey, location,
      ...(value ? { kind: 'magic' as const, category, value } : { kind: 'upgrade' as const, category }) });
    setNotice(preview.error ?? 'まほうを かえた！');
  };
  return <section className="adventure-strength" aria-label="たたかいのまほう"><h3>⚔️ たたかいの まほう</h3>
    {(['attack', 'defense'] as const).map(category => { const current = adventure[category], cost = campaignUpgradeCost(current.rank);
      const kinds = category === 'attack' ? [['power', '⚔️ こうげき'], ['ultimate', '✨ ひっさつ'], ['break', '💎 ぶいはかい']] : [['protection', '🛡️ まもり'], ['health', '♥ ハート'], ['fire', '🔥 ほのおガード']];
      return <fieldset key={category}><legend>{category === 'attack' ? 'けん' : 'ぼうぐ'} {'★'.repeat(current.rank)}{'☆'.repeat(3 - current.rank)}</legend>
        {kinds.map(([kind, label]) => <button type="button" key={kind} aria-pressed={current.kind === kind} onClick={() => change(category, kind)}>{label}</button>)}
        <small>{category === 'attack' ? '通常＋1/2/3 ・ 必殺＋4/8/12 ・ 部位＋1/2/3' : '軽減5/10/20% ・ HP＋2/4/6 ・ 炎軽減20/35/50%'}</small>
        {cost && <button type="button" disabled={current.kind === 'none'} onClick={() => change(category)}>★をふやす<small>{Object.entries(cost).map(([key, amount]) => `${key === 'lapis_lazuli' ? 'ラピス' : key === 'book' ? '本' : 'クォーツ'}${amount}`).join(' ＋ ')}</small></button>}
      </fieldset>; })}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
