/** DEV-only host of the actual editor. Never mounts the app or real profile/cloud persistence. */
import { useState } from 'react';
import { TaskListScreen } from './App';
import { editTaskPlacement, remapTaskRecord } from './taskEditing';
import { isMiningNightHours } from './miningNightLock';
import { SESSION_IDS, SESSION_SHORT_LABELS, type AllSessionTasks, type SessionId, type Task } from './sharedTasks';

function fixture(): AllSessionTasks {
  const all = Object.fromEntries(SESSION_IDS.map(sid => [sid, { tasks: [] as Task[], done: new Set<number>(), skipped: new Set<number>() }])) as AllSessionTasks;
  all.home.tasks = [{ id: 1, title: '水筒を出す', emoji: '🧴' }, { id: 2, title: '宿題', emoji: '📖' }, { id: 3, title: '洗濯物をたたむ', emoji: '🧺' }];
  all.home.done.add(1); all.home.skipped.add(3);
  all.evening.tasks = [{ id: 1, title: 'はみがき', emoji: '🪥' }, { id: 4, title: '明日の準備', emoji: '🎒' }];
  return all;
}
export default function TaskSettingsLab() {
  const [all, setAll] = useState(fixture), [session, setSession] = useState<SessionId>('home');
  const [records, setRecords] = useState<Record<string, number>>({ 'home-1': 12, 'evening-1': 30 });
  const [clock, setClock] = useState('20:29'), [message, setMessage] = useState('');
  function edit(source: SessionId, id: number, title: string, emoji: string, weekdays?: number[], targetSessions?: SessionId[], specialRewardFloor?: Task['specialRewardFloor']) {
    const next = editTaskPlacement(all, source, id, { title, emoji, weekdays, specialRewardFloor }, targetSessions, `lab-${Date.now()}`);
    if (!next) return;
    setAll(next.sessions); setRecords(prev => remapTaskRecord(prev, next.oldTimeKeys, next.newTimeKeys)); setMessage('変更を保存しました（試験用メモリ内のみ）');
  }
  function roundtrip() {
    const saved = JSON.parse(JSON.stringify(all, (_key, value) => value instanceof Set ? [...value] : value));
    for (const sid of SESSION_IDS) { saved[sid].done = new Set(saved[sid].done); saved[sid].skipped = new Set(saved[sid].skipped); }
    setAll(saved); setRecords(JSON.parse(JSON.stringify(records))); setMessage('保存形式で読み直しました');
  }
  const [hour, minute] = clock.split(':').map(Number);
  return <div data-app-scroll style={{ height: '100dvh', overflowY: 'auto', padding: 16, boxSizing: 'border-box', width: '100%', maxWidth: 600, margin: 'auto' }}>
    <aside style={{ padding: 12, marginBottom: 16, background: '#eaf0ff', borderRadius: 12 }}>
      <strong>タスク設定の確認用・メモリのみ</strong>
      <p>本物の記録・クラウドには接続しません。再読み込みで最初に戻ります。</p>
      <button onClick={roundtrip}>保存形式で読み直す</button>
      <button onClick={() => { setAll(fixture()); setRecords({ 'home-1': 12, 'evening-1': 30 }); setMessage('リセットしました'); }}>仮データをリセット</button>
      <p><label>時刻の確認 <select value={clock} onChange={e => setClock(e.target.value)}>{['20:29', '20:30', '06:29', '06:30'].map(time => <option key={time}>{time}</option>)}</select></label>：{isMiningNightHours(new Date(2026, 9, 18, hour, minute)) ? 'こうざん・クラフト停止' : '遊べます'}</p>
      <details><summary>移動後の記録を確認</summary>{SESSION_IDS.map(sid => <p key={sid}>{SESSION_SHORT_LABELS[sid]}：{all[sid].tasks.map(t => `${t.title}(#${t.id}${all[sid].done.has(t.id) ? '・完了' : all[sid].skipped.has(t.id) ? '・あとで' : ''})`).join('、') || 'なし'}</p>)}<p>計測記録：{JSON.stringify(records)}</p></details>
      <p role="status">{message}</p>
    </aside>
    <TaskListScreen session={session} morningTasks={all.morning.tasks} daytimeTasks={all.daytime.tasks} homeTasks={all.home.tasks} eveningTasks={all.evening.tasks}
      onSwitchSession={setSession} onBack={() => setMessage('この画面は試験専用です')} onEditTask={edit}
      onReorder={(sid, tasks) => { setAll(prev => ({ ...prev, [sid]: { ...prev[sid], tasks } })); setMessage('順番を保存しました（試験用メモリ内のみ）'); }}
      onDeleteTask={(sid, id) => setAll(prev => ({ ...prev, [sid]: { ...prev[sid], tasks: prev[sid].tasks.filter(t => t.id !== id) } }))}
      onAddTask={() => setMessage('追加はこの確認画面の対象外です')}
      customTaskEmojis={[]} onAddCustomTaskEmoji={() => undefined} todayMission={null} onOpenMissionSetup={() => setMessage('特別ミッションの設定はこの確認画面の対象外です')} onClearMission={() => undefined} />
  </div>;
}
