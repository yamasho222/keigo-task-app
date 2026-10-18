/** DEV-only memory host. Never mounts App, CloudAppShell or profile persistence. */
import { useCallback, useRef, useState } from 'react';
import { MiningScreen } from './MiningScreen';
import { emptyMiningState, normalizeMiningState, type MiningState } from './miningTypes';
import type { MiningPatch } from './miningCommit';
import { AdventureBattlePanel } from './AdventureBattlePanel';
import type { AdventureLocation } from './adventureState';

function fixture(): MiningState {
  const s = emptyMiningState();
  return { ...s, tickets: 40, miningVersionNoticeSeen: true, miningRouteBranchSeen: true,
    unlockedGachas: ['wood', 'farm', 'stone', 'nether', 'fortress', 'warped_forest', 'end_portal', 'the_end'],
    crafted: { workbench: true, sword_diamond: true, helmet_iron: true, chest_diamond: true, leggings_iron: true, boots_iron: true, enchanting_table: true },
    equipped: { ...s.equipped, helmet: 'helmet_iron', chest: 'chest_diamond', leggings: 'leggings_iron', boots: 'boots_iron' },
    materials: { bread: 8, wheat: 9, shield: 1, water: 1, spare_bed: 3, ancient_debris: 1, blaze_rod: 4, ender_eye: 12, lapis: 40, nether_quartz: 30, book: 6 },
    endQuest: { ...s.endQuest!, foundPortal: true, linked: true, theEndUnlocked: true, eyes: 12 } };
}
export default function AdventureReleaseLab() {
  const [mining, setMining] = useState(fixture), latest = useRef(mining);
  const [location, setLocation] = useState<AdventureLocation | null>(null);
  const [normal, setNormal] = useState(false);
  const onChange = useCallback((patch: MiningPatch) => { const next = patch(latest.current); latest.current = next; setMining(next); }, []);
  const dateKey = new Date().toLocaleDateString('sv-SE');
  return <>
    {!location && <aside style={{ padding: 12, background: '#29253d', color: '#fff' }}><strong>本番統合の確認用・メモリのみ</strong><p>本物の記録・クラウドには接続していません。</p>
      <button onClick={() => setNormal(n => !n)}>通常画面を切り替え</button>
      <button onClick={() => setLocation('fortress')}>ブレイズ</button><button onClick={() => setLocation('warped_forest')}>エンダーマン</button><button onClick={() => setLocation('the_end')}>エンドラ</button>
      <button onClick={() => onChange(s => normalizeMiningState(JSON.parse(JSON.stringify(s))))}>保存形式で読み直す</button>
      <button onClick={() => onChange(s => ({ ...s, adventure: s.adventure ? { ...s.adventure, hp: 20, fallen: false } : undefined }))}>試験用HP回復</button>
      <p>チケット {mining.tickets}・行動 {mining.adventure?.hands ?? 0}・HP {mining.adventure?.hp ?? 20}・今日のパン {mining.adventure?.foodToday ?? 0}/2</p>
    </aside>}
    {normal && <MiningScreen mining={mining} stickerAlbum={[]} buddyProgress={{}} dateKey={dateKey} onChange={onChange} onBack={() => setNormal(false)} />}
    {location && <AdventureBattlePanel mining={mining} location={location} dateKey={dateKey} onChange={onChange} onClose={() => setLocation(null)} />}
  </>;
}
