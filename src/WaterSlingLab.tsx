/** DEV-only memory practice; never mounts a profile or connects to cloud storage. */
import { useState } from 'react';
import { DragonSkillGame } from './DragonSkillGame';
import { DragonSkillPreview } from './DragonSkillPreview';
import { skillBonus } from './dragonSkillRules';

export default function WaterSlingLab() {
  const [playing, setPlaying] = useState(true), [preview, setPreview] = useState(false), [score, setScore] = useState<number | null>(null);
  const [key, setKey] = useState(0), [sound, setSound] = useState(true), [calm, setCalm] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  return <main style={{ minHeight: '100dvh', padding: 24, background: '#091c29', color: '#e5faff', fontFamily: 'system-ui' }}>
    <h1>水の必殺・ひっぱる試験</h1><p>試験専用です。実際のチケット・持ち物・セーブは変わりません。</p>
    <p>1発勝負。約5秒飛ぶよ。泡の配置は毎回ランダム。狙っている間は時間制限なし。</p>
    <button style={{ minHeight: 54, padding: '12px 24px' }} onClick={() => { setKey(v => v + 1); setPlaying(true); }}>もういちど あそぶ</button>
    <p><label><input type="checkbox" checked={sound} onChange={event => setSound(event.target.checked)} />音</label> <label><input type="checkbox" checked={calm} onChange={event => setCalm(event.target.checked)} />動きをひかえめに</label></p>
    {score !== null && <p role="status">{score}点。エンドラ本体・強化/仲間/弱点なし：ダイヤ{8 + skillBonus('diamond', score)}、ネザライト{12 + skillBonus('netherite', score)}ダメージ。</p>}
    <p><a href="?battle-effects=1" style={{ color: '#a8e7ff' }}>実際の戦闘の確認メニューへ</a></p>
    {playing && <DragonSkillGame key={key} kind="repel" practice sound={sound} reduced={calm} onExit={() => setPlaying(false)} onDone={value => { setScore(value); setPlaying(false); setPreview(true); }} />}
    {preview && <DragonSkillPreview kind="repel" score={score ?? 0} sword="diamond" reduced={calm} onStrike={() => undefined} onClose={() => setPreview(false)} />}
  </main>;
}
