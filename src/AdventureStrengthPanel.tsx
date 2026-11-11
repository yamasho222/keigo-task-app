import { useState } from 'react';
import type { MiningState } from './miningTypes';
import type { MiningPatch } from './miningCommit';
import { adventureEquipment, adventureSupplies, ensureAdventure, transitionAdventure, type AdventureCommand, type AdventureResult } from './adventureSession';
import { campaignUpgradeCost } from './campaignEquipment';
import { AttackEnchantWorkshop } from './AttackEnchantWorkshop';
import type { AttackMagic } from './attackEnchantPresentation';
import './adventureProduction.css';

export function AdventureStrengthPanel({ mining, dateKey, onChange }: { mining: MiningState; dateKey: string; onChange: (patch: MiningPatch) => void }) {
  const [notice, setNotice] = useState('');
  const [receipt, setReceipt] = useState<{ revision: number; kind: string; rank: number; category: 'attack' | 'defense'; text: string } | null>(null);
  if (!mining.unlockedGachas.includes('fortress')) return null;
  const prepared = ensureAdventure(mining, dateKey), adventure = prepared.adventure!;
  const location = mining.unlockedGachas.includes('the_end') ? 'the_end' : 'fortress';
  const envelope = { revision: mining.adventure?.revision ?? -1, day: dateKey, location } as const;
  const attackCommand = (value: AttackMagic): AdventureCommand => ({ ...envelope, kind: 'enchantAttack', value, expectedRank: adventure.attack.rank });
  const upgradeCommand = (category: 'attack' | 'defense'): AdventureCommand => ({ ...envelope, kind: 'upgrade', category, expectedRank: adventure[category].rank });
  const dispatch = (command: AdventureCommand, category: 'attack' | 'defense', text: string) => {
    // App and lab execute the updater once against the latest ref, before rendering.
    // Report that actual result, including a racing resource/revision change.
    let result: AdventureResult = { state: mining, error: '更新できなかったよ。もういちど ためそう。' };
    onChange(state => { result = transitionAdventure(state, command); return result.state; });
    if (result.error) { setNotice(result.error); setReceipt(null); return; }
    const expected = result.state.adventure!;
    setNotice('');
    setReceipt({ revision: expected.revision, ...expected[category], category, text });
  };
  const confirmed = receipt && mining.adventure?.revision === receipt.revision
    && mining.adventure[receipt.category].kind === receipt.kind && mining.adventure[receipt.category].rank === receipt.rank;
  const current = adventure.defense, cost = campaignUpgradeCost(current.rank);
  return <div className="adventure-strength-layout">
    <AttackEnchantWorkshop equipment={adventureEquipment(prepared)} supplies={adventureSupplies(prepared)} endUnlocked={mining.unlockedGachas.includes('the_end')}
      checkApply={kind => transitionAdventure(mining, attackCommand(kind)).error}
      upgradeError={transitionAdventure(mining, upgradeCommand('attack')).error}
      onApply={kind => dispatch(attackCommand(kind), 'attack', adventure.attack.rank === 0 ? '✦ まほうが ついた！' : '✦ まほうを かえた！ ★は そのまま！')}
      onUpgrade={() => dispatch(upgradeCommand('attack'), 'attack', `★${adventure.attack.rank + 1}に なった！`)} />
    {(notice || confirmed) && <p className="adventure-strength-notice" role="status">{notice || receipt?.text}</p>}
    <details className="adventure-strength"><summary>🛡️ ぼうぐの まほう</summary>
      <fieldset><legend>ぼうぐ {'★'.repeat(current.rank)}{'☆'.repeat(3 - current.rank)}</legend>
        {[['protection', '🛡️ まもり'], ['health', '♥ ハート'], ['fire', '🔥 ほのおガード']].map(([kind, label]) => <button type="button" key={kind} aria-pressed={current.kind === kind} onClick={() => dispatch({ ...envelope, kind: 'magic', category: 'defense', value: kind }, 'defense', 'まもりの まほうを かえた！')}>{label}</button>)}
        <small>軽減5/10/20% ・ HP＋2/4/6 ・ 炎軽減20/35/50%</small>
        {cost && <button type="button" disabled={!!transitionAdventure(mining, upgradeCommand('defense')).error} onClick={() => dispatch(upgradeCommand('defense'), 'defense', 'まもりの ★が ふえた！')}>★をふやす<small>{Object.entries(cost).map(([key, amount]) => `${key === 'lapis_lazuli' ? 'ラピス' : key === 'book' ? '本' : 'クォーツ'}${amount}`).join(' ＋ ')}</small></button>}
      </fieldset>
    </details>
  </div>;
}
