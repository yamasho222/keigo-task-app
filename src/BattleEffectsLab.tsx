/** DEV-only, disposable memory fixtures. Never loads App, cloud or profile storage. */
import { useRef, useState } from 'react';
import DragonCampaignLab from './DragonCampaignLab';
import BlazePrototype from './BlazePrototype';
import EndermanPrototype from './EndermanPrototype';
import { dragonCampaignFixture } from './dragonCampaignFixtures';
import { enableDragonCritical, nextDragonCritical } from './dragonCriticalRules';
import { enableDragonSkills } from './dragonSkillRules';
import { enableBattleSkills } from './battleSkillRules';
import { stepDragonCampaign, type CampaignAction, type DragonCampaign } from './dragonCampaignEngine';
import { actOnBlaze, createBlazeRun, type BlazeAction, type BlazeRun } from './blazePrototypeEngine';
import { actOnEnderman, createEndermanRun, type EndermanAction, type EndermanRun } from './endermanPrototypeEngine';

function dragonFixture(casts = 0) {
  const s = enableDragonCritical(enableDragonSkills(dragonCampaignFixture('ultimate', new Date().toLocaleDateString('sv-SE'), true)));
  s.equipment.attack = { kind: 'none', rank: 0 }; s.skills!.casts = casts; s.hp = 20;
  s.supplies.materials.water = 1; s.supplies.materials.shield = 1;
  return s;
}
function criticalSeed() { let seed = 0; while (!nextDragonCritical({ version: 1, seed }).hit) seed++; return { version: 1 as const, seed }; }

export default function BattleEffectsLab() {
  const [mode, setMode] = useState<'menu' | 'dragon' | 'blaze' | 'enderman'>('menu');
  const [dragon, setDragon] = useState<DragonCampaign>(dragonFixture), dragonRef = useRef(dragon);
  const [blaze, setBlaze] = useState<BlazeRun>(() => ({ ...createBlazeRun(), critical: criticalSeed() })), blazeRef = useRef(blaze);
  const [enderman, setEnderman] = useState<EndermanRun>(() => ({ ...createEndermanRun(), intent: 'approach', critical: criticalSeed() })), endermanRef = useRef(enderman);
  function actDragon(action: CampaignAction) { const result = stepDragonCampaign(dragonRef.current, action); if (!result.error) { dragonRef.current = result.state; setDragon(result.state); } return result; }
  function actBlaze(action: BlazeAction) { const result = actOnBlaze(blazeRef.current, action); if (!result.error) { blazeRef.current = result.state; setBlaze(result.state); } return result; }
  function actEnderman(action: EndermanAction) { const result = actOnEnderman(endermanRef.current, action); if (!result.error) { endermanRef.current = result.state; setEnderman(result.state); } return result; }
  function showDragon(casts: number, attacks = false) {
    const s = dragonFixture(casts); if (attacks) { s.gauge = 0; s.landingTurns = 0; s.intentIndex = 0; }
    dragonRef.current = s; setDragon(s); setMode('dragon');
  }
  const common = { onClose: () => setMode('menu'), onHelp() {}, seenHelp: true, next: () => setMode('menu'), retry: () => setMode('menu'), endermanDefeats: 0, heldItems: ['none', 'shield', 'water'], breadStock: 8, foodToday: 0 };
  return mode === 'dragon' ? <DragonCampaignLab production={{ ...common, run: dragon, act: actDragon }} />
    : mode === 'blaze' ? <BlazePrototype production={{ ...common, breadStock: blaze.bread, foodToday: 2 - blaze.bread, run: blaze, act: actBlaze }} />
      : mode === 'enderman' ? <EndermanPrototype production={{ ...common, breadStock: enderman.bread, foodToday: 2 - enderman.bread, run: enderman, act: actEnderman }} />
        : <main data-app-scroll style={{ height: '100dvh', overflowY: 'auto', padding: 22, background: '#161c30', color: '#f5f1e6' }}>
          <h1>たたかいの 追加仕様・試験用</h1><p>メモリだけの仮データです。実際の記録・クラウド・試験用の既存セーブにも接続しません。</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {['🔥 炎の必殺', '⚡ 雷の必殺', '🫧 水の必殺', '✦ 光の必殺'].map((label, i) => <button key={label} style={{ minHeight: 64 }} onClick={() => showDragon(i)}>{label}</button>)}
            <button style={{ minHeight: 64 }} onClick={() => showDragon(0, true)}>仲間3体の追撃</button>
            <button style={{ minHeight: 64 }} onClick={() => showDragon(0)}>ベッドを試す</button>
            <button style={{ minHeight: 64 }} onClick={() => { const s = enableBattleSkills({ ...createBlazeRun(), critical: criticalSeed() }, ['repel']); blazeRef.current = s; setBlaze(s); setMode('blaze'); }}>ブレイズの会心</button>
            <button style={{ minHeight: 64 }} onClick={() => { const s = enableBattleSkills({ ...createEndermanRun(), intent: 'approach' as const, critical: criticalSeed() }, ['repel', 'aim']); endermanRef.current = s; setEnderman(s); setMode('enderman'); }}>エンダーマンの会心</button>
          </div>
          <p>Lv10が3体。通常の追撃は1体ずつ75%で1、20%で2、5%で3。必殺は1体3で合計9。</p>
          <p><a href="?adventure-release=1" style={{ color: '#badeff' }}>段階解放・HP・チケット持ち越しを実際の戦闘管理で確認する</a></p>
          <p>会心の確認用ボタンだけ、次の1回が会心になる保存済みの抽選状態にしています。通常の確率は全戦闘10%です。</p>
          <output>直前の仮戦闘：チケット{dragon.tickets}・残り行動{dragon.hands}・ベッド{dragon.supplies.materials.spare_bed}・使用{dragon.bedsUsed}/3</output>
        </main>;
}
