import { useCallback, useEffect, useRef, useState } from "react";
import { MiningScreen, type MiningDevJump } from "./MiningScreen";
import type { MiningPatch } from "./miningCommit";
import { COMBAT_V2_BACKUP_KEY, COMBAT_V2_LAB_KEY, combatLabDate, combatLabSeed, readCombatLabSave, type CombatLabSave, type CombatLabScenario } from "./combatV2LabStorage";
import "./combatV2.css";

function load(): { save: CombatLabSave; error: string } {
  try { return { save: readCombatLabSave(localStorage.getItem(COMBAT_V2_LAB_KEY)), error: "" }; }
  catch (e) { return { save: readCombatLabSave(null), error: e instanceof Error ? e.message : "テスト記録を読めません。" }; }
}
export default function CombatV2Lab() {
  const [initial] = useState(load);
  const [save, setSave] = useState(initial.save);
  const latest = useRef(save);
  const [error, setError] = useState(initial.error);
  const blocked = useRef(!!initial.error);
  const [isBlocked, setIsBlocked] = useState(!!initial.error);
  const [jump, setJump] = useState<MiningDevJump | null>({ nonce: 1, tab: "mine", destStep: "rock" });
  const [reset, setReset] = useState<CombatLabScenario | null>(null);
  const [generation, setGeneration] = useState(0);
  const [today, setToday] = useState(() => combatLabDate(save.dayOffset));
  const dateKey = combatLabDate(save.dayOffset);
  const commitSave = useCallback((patch: (prev: CombatLabSave) => CombatLabSave, afterCommit?: () => void) => {
    if (blocked.current) return;
    if (!navigator.locks) {
      blocked.current = true; setIsBlocked(true);
      setError("安全な保存に対応したブラウザで開いてください。記録は上書きしていません。");
      return;
    }
    // Serialize the read/check/write across tabs, not just React event handlers.
    void navigator.locks.request(COMBAT_V2_LAB_KEY, { mode: "exclusive" }, () => {
    if (blocked.current) return;
    try {
      const disk = localStorage.getItem(COMBAT_V2_LAB_KEY);
      if (!disk && latest.current.revision > 0) throw new Error("保存済みの記録が見つかりません。別のタブで変更されていないか確認してください。");
      if (disk) {
        const stored = readCombatLabSave(disk);
        if (stored.revision !== latest.current.revision) {
          latest.current = stored; setSave(stored);
          setError("別のタブで更新されました。最新の記録に切り替えました。操作をやり直してください。");
          return;
        }
      }
      const before = latest.current;
      const after = patch(before);
      if (after === before) return;
      const next = { ...after, revision: before.revision + 1 };
      // Save before presenting the next input; a failed write leaves the old coherent state.
      localStorage.setItem(COMBAT_V2_LAB_KEY, JSON.stringify(next));
      latest.current = next; setSave(next); setError("");
      afterCommit?.();
    } catch (e) {
      blocked.current = true;
      setIsBlocked(true);
      setError(`保存を止めました。記録は上書きしていません。${e instanceof Error ? e.message : "保存できませんでした"}`);
    }
    }).catch((e: unknown) => {
      blocked.current = true; setIsBlocked(true);
      setError(e instanceof Error ? e.message : "保存ロックを取得できませんでした。");
    });
  }, []);
  const onChange = useCallback((patch: MiningPatch) => commitSave((prev) => {
    const next = patch(prev.mining);
    return next === prev.mining ? prev : { ...prev, mining: next };
  }), [commitSave]);
  useEffect(() => {
    const timer = window.setInterval(() => setToday(combatLabDate(latest.current.dayOffset)), 1_000);
    const sync = (event: StorageEvent) => {
      if (event.key !== COMBAT_V2_LAB_KEY) return;
      if (!event.newValue) { blocked.current = true; setIsBlocked(true); setError("別のタブで記録が削除されました。再読み込みしてください。"); return; }
      try { const next = readCombatLabSave(event.newValue); latest.current = next; setSave(next); }
      catch (e) { blocked.current = true; setIsBlocked(true); setError(e instanceof Error ? e.message : "記録の互換性を確認してください。"); }
    };
    window.addEventListener("storage", sync);
    return () => { clearInterval(timer); window.removeEventListener("storage", sync); };
  }, []);
  const effectiveDate = today === dateKey ? dateKey : combatLabDate(save.dayOffset);
  const open = useCallback(() => setJump({ nonce: Date.now(), tab: "mine", destStep: "place" }), []);
  const resetScenario = () => {
    if (!reset) return;
    try {
      commitSave((prev) => {
        localStorage.setItem(COMBAT_V2_BACKUP_KEY, JSON.stringify(prev));
        return { ...prev, mining: combatLabSeed(reset), dayOffset: 0 };
      }, () => {
        setGeneration((n) => n + 1);
        setJump({ nonce: Date.now(), tab: "mine", destStep: "rock" });
        setReset(null);
      });
    } catch (e) { setError(e instanceof Error ? e.message : "バックアップを保存できません。" ); }
  };
  if (!import.meta.env.DEV) return <p>この画面は開発環境専用です。</p>;
  return <div className="cv2-lab">
    <details className="cv2-lab-bar"><summary>戦闘v2 テスト環境・本番と別の記録 🎫{save.mining.tickets}枚</summary>
      <p>クラウド接続なし／自動チケット補充なし／エンドラは現行版を維持<br />日付：{effectiveDate} / 保存：{save.revision}</p>
      <button type="button" onClick={open}>ほりばを開く</button>
      <button type="button" onClick={() => onChange((m) => ({ ...m, tickets: m.tickets + 1 }))}>検証用＋1枚</button>
      <button type="button" onClick={() => commitSave((prev) => ({ ...prev, dayOffset: prev.dayOffset + 1 }))}>検証用：翌日へ</button>
      <div>{([['iron', '鉄・ブレイズ'], ['diamond', 'ダイヤ・水なし'], ['water', 'ダイヤ・水あり'], ['last-ticket', '最後の1枚'], ['quest', 'アイ作成から']] as const).map(([id, label]) => <button key={id} type="button" onClick={() => setReset(id)}>{label}の記録へ入替</button>)}</div>
      {reset && <div role="alertdialog" aria-label="テスト記録の入替確認"><p>テスト記録だけを入れ替えます。今のテスト記録は1世代バックアップします。本番の記録は変更しません。</p><button type="button" onClick={resetScenario}>入れ替える</button><button type="button" onClick={() => setReset(null)}>やめる</button></div>}
    </details>
    {error && <div role="alert" style={{ padding: 16, color: "#ffe3ac", background: "#54282b" }}>{error}<button type="button" onClick={() => window.location.reload()}>再読み込み</button></div>}
    {!isBlocked && <div className="cv2-lab-scroll" data-app-scroll><MiningScreen key={generation} mining={save.mining} stickerAlbum={[]} buddyProgress={{}} dateKey={effectiveDate} onChange={onChange} onBack={open} devJump={jump} onDevJumpConsumed={() => setJump(null)} combatV2Test /></div>}
  </div>;
}
