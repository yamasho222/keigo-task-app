/** DEV-only practice host. Real profile saves and cloud connections are never mounted. */
import { useCallback, useRef, useState } from 'react';
import { AdventureStrengthPanel } from './AdventureStrengthPanel';
import { AdventureBattlePanel } from './AdventureBattlePanel';
import { emptyMiningState, normalizeMiningState, type MiningState } from './miningTypes';
import { ensureAdventure } from './adventureSession';
import type { MiningPatch } from './miningCommit';
import type { AdventureLocation } from './adventureState';

const day = () => new Date().toLocaleDateString('sv-SE');
function fixture(end: boolean): MiningState {
  const state = emptyMiningState();
  state.tickets = 20;
  state.unlockedGachas = ['wood', 'farm', 'stone', 'nether', 'fortress', 'warped_forest', ...(end ? ['the_end' as const] : [])];
  state.crafted = { ...state.crafted, sword_diamond: true, enchanting_table: true, helmet_diamond: true, chest_diamond: true, leggings_diamond: true, boots_diamond: true };
  state.equipped = { ...state.equipped, helmet: 'helmet_diamond', chest: 'chest_diamond', leggings: 'leggings_diamond', boots: 'boots_diamond' };
  state.materials = { ...state.materials, lapis: 40, book: 3, nether_quartz: 20, bread: 4, water: 1 };
  return ensureAdventure(state, day());
}
export default function AttackEnchantLab() {
  const [mining, setMining] = useState(() => fixture(true)), latest = useRef(mining);
  const competingWrite = useRef(false);
  const [battle, setBattle] = useState<AdventureLocation | null>(null);
  const change = useCallback((patch: MiningPatch) => {
    if (competingWrite.current) {
      competingWrite.current = false;
      latest.current = { ...latest.current, materials: { ...latest.current.materials, lapis: 0 } };
    }
    const next = patch(latest.current); latest.current = next; setMining(next);
  }, []);
  return <main style={{ width:'100%', height:'100dvh', overflowY:'auto', background:'#e9edf1', padding:'20px 12px', fontFamily:'system-ui', color:'#24364c' }}>
    <div style={{ maxWidth:440, margin:'0 auto' }}>
      <p style={{ fontSize:12, margin:'0 0 12px' }}>試験用・本物のチケットや記録は変わりません</p>
      <AdventureStrengthPanel mining={mining} dateKey={day()} onChange={change}/>
      <details style={{ marginTop:24 }}><summary style={{ padding:12 }}>試験用の設定・実戦でためす</summary>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, padding:12 }}>
          <button onClick={() => change(() => fixture(true))}>エンド解放済みに戻す</button>
          <button onClick={() => change(() => fixture(false))}>エンド解放前に戻す</button>
          <button onClick={() => change(s => ({ ...s, materials: { ...s.materials, lapis: 0, book: 0, nether_quartz: 0 } }))}>素材を0に</button>
          <button onClick={() => change(s => ({ ...s, crafted: { ...s.crafted, sword_netherite: !s.crafted.sword_netherite } }))}>ダイヤ／ネザライト</button>
          <button onClick={() => change(s => normalizeMiningState(JSON.parse(JSON.stringify(s))))}>保存形式で読み直す</button>
          <button onClick={() => { competingWrite.current = true; }}>次の購入で素材不足の競合を再現</button>
          {(['fortress','warped_forest','the_end'] as const).map((location,i) => <button key={location} disabled={!mining.unlockedGachas.includes(location)} onClick={() => setBattle(location)}>{['ブレイズ戦','エンダーマン戦','エンドラ戦'][i]}</button>)}
        </div><p>チケット {mining.tickets} / ラピス {mining.materials.lapis} / 本 {mining.materials.book} / クォーツ {mining.materials.nether_quartz}</p>
      </details>
    </div>
    {battle && <AdventureBattlePanel mining={mining} location={battle} dateKey={day()} onChange={change} onClose={() => setBattle(null)}/>}
  </main>;
}
