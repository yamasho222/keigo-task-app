/** DEV-only memory host. Never mounts App, CloudAppShell or profile persistence. */
import { useCallback, useRef, useState } from 'react';
import { MiningScreen } from './MiningScreen';
import { emptyMiningState, normalizeMiningState, type MiningState } from './miningTypes';
import type { MiningPatch } from './miningCommit';
import { AdventureBattlePanel } from './AdventureBattlePanel';
import type { AdventureLocation } from './adventureState';
import { ensureAdventure } from './adventureSession';

function fixture(stage: 'fortress' | 'warped_forest' | 'the_end' = 'the_end'): MiningState {
  const s = emptyMiningState();
  const mining: MiningState = { ...s, tickets: 40, miningVersionNoticeSeen: true, miningRouteBranchSeen: true,
    unlockedGachas: ['wood', 'farm', 'stone', 'nether', 'fortress', ...(stage !== 'fortress' ? ['warped_forest' as const] : []), ...(stage === 'the_end' ? ['end_portal' as const, 'the_end' as const] : [])],
    bedCount: 3, partyIds: ['mc-sheep', 'mc-pig', 'mc-iron-golem'],
    crafted: { workbench: true, sword_diamond: true, helmet_iron: true, chest_diamond: true, leggings_iron: true, boots_iron: true, enchanting_table: true },
    equipped: { ...s.equipped, helmet: 'helmet_iron', chest: 'chest_diamond', leggings: 'leggings_iron', boots: 'boots_iron' },
    materials: { bread: 8, wheat: 9, shield: 1, water: 1, spare_bed: 3, ancient_debris: 1, blaze_rod: stage === 'fortress' ? 0 : 4, ender_eye: stage === 'the_end' ? 12 : 0, lapis: 40, nether_quartz: 30, book: 6 },
    endQuest: { ...s.endQuest!, foundPortal: stage === 'the_end', linked: stage === 'the_end', theEndUnlocked: stage === 'the_end', eyes: stage === 'the_end' ? 12 : 0 } };
  const prepared = ensureAdventure(mining, new Date().toLocaleDateString('sv-SE'));
  if (stage === 'the_end') { prepared.adventure!.learning!.learned = ['repel', 'aim']; prepared.adventure!.learning!.seen.warped_forest = true; }
  return prepared;
}
export default function AdventureReleaseLab() {
  const [mining, setMining] = useState(() => fixture()), latest = useRef(mining);
  const [location, setLocation] = useState<AdventureLocation | null>(null);
  const [normal, setNormal] = useState(false);
  const onChange = useCallback((patch: MiningPatch) => { const next = patch(latest.current); latest.current = next; setMining(next); }, []);
  const dateKey = new Date().toLocaleDateString('sv-SE');
  return <div data-app-scroll style={{ height: '100dvh', overflowY: 'auto', padding: 16 }}>
    {!location && <aside style={{ padding: 12, background: '#29253d', color: '#fff' }}><strong>本番統合の確認用・メモリのみ</strong><p>本物の記録・クラウドには接続していません。</p>
      <button onClick={() => setNormal(n => !n)}>通常画面を切り替え</button>
      <p>次のボタンは仮記録を最初から作り直します。</p>
      <button onClick={() => { onChange(() => fixture('fortress')); setLocation('fortress'); }}>水だけ解放・ブレイズから</button>
      <button onClick={() => { onChange(() => fixture('warped_forest')); setLocation('warped_forest'); }}>光を覚える・エンダーマン初戦</button>
      <button onClick={() => { onChange(() => fixture()); setLocation('the_end'); }}>炎と雷を覚える・エンドラ初戦</button>
      <p>続きから：<button disabled={!mining.unlockedGachas.includes('fortress')} onClick={() => setLocation('fortress')}>ブレイズ</button><button disabled={!mining.unlockedGachas.includes('warped_forest')} onClick={() => setLocation('warped_forest')}>エンダーマン</button><button disabled={!mining.unlockedGachas.includes('the_end')} onClick={() => setLocation('the_end')}>エンドラ</button></p>
      <button onClick={() => onChange(s => normalizeMiningState(JSON.parse(JSON.stringify(s))))}>保存形式で読み直す</button>
      <button onClick={() => onChange(s => ({ ...s, endChapterNotices: {} }))}>追加お知らせを未読に</button>
      <button onClick={() => onChange(s => ({ ...s, materials: { ...s.materials, bread: 0 } }))}>試験用パンを0こに</button>
      <button onClick={() => onChange(s => ({ ...s, materials: { ...s.materials, bread: 8 } }))}>試験用パンを8こに</button>
      <button onClick={() => onChange(s => ({ ...s, adventure: s.adventure ? { ...s.adventure, hp: 20, fallen: false } : undefined }))}>試験用HP回復</button>
      <p>チケット {mining.tickets}・行動 {mining.adventure?.hands ?? 0}・HP {mining.adventure?.hp ?? 20}・今日のパン {mining.adventure?.foodToday ?? 0}/2</p>
      <p>覚えた必殺：{mining.adventure?.learning?.learned.join(' / ')}</p>
    </aside>}
    {normal && <MiningScreen mining={mining} stickerAlbum={[]} buddyProgress={{}} dateKey={dateKey} onChange={onChange} onBack={() => setNormal(false)} />}
    {location && <AdventureBattlePanel mining={mining} location={location} dateKey={dateKey} onChange={onChange} onClose={() => setLocation(null)} />}
  </div>;
}
