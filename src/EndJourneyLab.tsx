/** Disposable progression host. Never mounts App/CloudAppShell or reads their saves. */
import { useCallback, useRef, useState } from "react";
import { MiningScreen, type MiningDevJump } from "./MiningScreen";
import { MiningItemIcon } from "./MiningItemIcon";
import { normalizeMiningState, type MiningState } from "./miningTypes";
import { refreshUnlocks } from "./miningProgress";
import type { MiningPatch } from "./miningCommit";
import { addLastLabRod, finishLabCraft, JOURNEY_LAB_STEPS, journeyLabNext, journeyLabSeed, journeyLabStepSeed, topUpLabMaterials, type JourneyLabScenario, type JourneyLabStep } from "./endJourneyLabState";
import "./endJourney.css";
import "./endJourneyLab.css";

const SCENARIOS: [JourneyLabScenario, string][] = [["debris", "残骸取得済み"], ["rods", "ロッド3本を粉にした後"], ["materials", "クラフトから"], ["eye", "アイ完成直後"], ["hint3", "3回目のヒント"], ["hint5", "5回目のヒント"], ["hint7", "7回目のヒント"], ["hunt", "探索スタート"], ["portal", "ポータル9/12"], ["legacy", "旧探索の引き継ぎ"]];
function scenarioStep(scenario: JourneyLabScenario): JourneyLabStep {
  if (scenario === "debris" || scenario === "rods") return "forest";
  if (scenario === "materials") return "craft";
  return scenario === "portal" || scenario === "legacy" ? "portal" : "search";
}

export default function EndJourneyLab() {
  const [step, setStep] = useState<JourneyLabStep>("blaze");
  const [mining, setMining] = useState(() => journeyLabStepSeed("blaze"));
  const latest = useRef(mining);
  const [generation, setGeneration] = useState(0);
  const jumpSequence = useRef(0);
  const [open, setOpen] = useState(true);
  const [notice, setNotice] = useState("");
  const [jump, setJump] = useState<MiningDevJump | null>(null);
  const onChange = useCallback((patch: MiningPatch) => {
    const next = patch(latest.current);
    latest.current = next;
    setMining(next);
  }, []);

  function showStep(nextStep: JourneyLabStep, next: MiningState, message: string) {
    onChange(() => next);
    setStep(nextStep);
    setGeneration((n) => n + 1);
    setOpen(true);
    setNotice(message);
    jumpSequence.current += 1;
    setJump({
      nonce: jumpSequence.current,
      tab: nextStep === "craft" ? "craft" : "mine",
      ...(nextStep === "craft" ? { highlightRecipeId: "blaze_powder_batch" } : {}),
      destStep: nextStep === "portal" ? "rock" : "place",
    });
  }
  function selectStep(nextStep: JourneyLabStep) {
    showStep(nextStep, journeyLabStepSeed(nextStep), "選んだ段階の仮データに切り替えました。本番の記録は変更していません。");
  }
  function forward() {
    const result = journeyLabNext(step, latest.current);
    if (result.error) { setNotice(result.error); return; }
    const message = step === "blaze"
      ? "収集を省き、ロッド3本を粉にした仮データを用意しました。戦闘報酬の自動引き継ぎではありません。"
      : step === "enderman"
        ? "収集を省き、ロッド6本・パール12個を用意しました。戦闘報酬の自動引き継ぎではありません。"
        : "今の仮データを引き継いで次へ進みました。";
    showStep(result.step, result.state, message);
  }
  function changeScenario(scenario: JourneyLabScenario) {
    showStep(scenarioStep(scenario), journeyLabSeed(scenario), "確認用の状態へ仮データを切り替えました。前の試験データは置き換わります。");
  }
  function bulkCraft() {
    const result = finishLabCraft(latest.current);
    if (result.error) { setNotice(result.error); return; }
    onChange(() => result.state);
    setNotice("不足素材の収集と繰り返しクラフトを省きました。実際のレシピで材料を消費し、挿入済み分も含めてアイ12個分にしています。");
  }
  function topUp() {
    onChange(topUpLabMaterials);
    setNotice("アイ12個分に足りない材料だけ補充しました。作成済み・挿入済みの分は重複して補充しません。");
  }

  const current = JOURNEY_LAB_STEPS.find((item) => item.id === step)!;
  const battle = step === "blaze" || step === "enderman";
  const native = step === "craft" || step === "search" || step === "portal";
  const forestOpen = mining.unlockedGachas.includes("warped_forest");
  const rods = mining.endJourney?.rodsAcquired ?? 0;
  if (!import.meta.env.DEV) return null;
  return <div className="end-journey-lab">
    <header className="journey-lab-flow">
      <div className="journey-lab-heading"><strong>ジ・エンドへ 順番に確認</strong><span>試験専用・仮データ</span></div>
      <nav className="journey-lab-steps" aria-label="試験のステップ">
        {JOURNEY_LAB_STEPS.map((item) => <button type="button" key={item.id} aria-current={step === item.id ? "step" : undefined} onClick={() => selectStep(item.id)}>{item.label}</button>)}
      </nav>
      <a className="journey-lab-dragon-link" href="?dragon-campaign=1" target="_blank" rel="noopener noreferrer">⑦ エンドラ最終決戦を確認 ↗<small>別の試験記録・本番データには接続しません</small></a>
      <details key={step} className="journey-lab-step-details" open={!native}>
        <summary>{current.title}<span> 手順・ショートカット</span></summary>
        <p>{current.detail}</p>
        {battle && <>
          <p className="journey-lab-separation">新しい戦闘は別タブ・別の仮データです。報酬は自動で引き継がず、確認後にこのタブで次へ進めます。</p>
          <div className="journey-lab-action-row">
            <a className="journey-lab-primary" href={step === "blaze" ? "?blaze-prototype=1" : "?enderman-prototype=1"} target="_blank" rel="noopener noreferrer">{step === "blaze" ? "ブレイズ戦を開く ↗" : "エンダーマン戦を開く ↗"}</a>
            <button type="button" onClick={forward}>確認したので次へ →</button>
          </div>
        </>}
        {step === "forest" && <>
          <div className="journey-lab-unlock" role="status">
            <div className="journey-lab-rod-count" aria-label={`ロッド取得実績 ${rods}/4`}>
              {[0, 1, 2, 3].map((i) => <span key={i} className={i < rods ? "is-collected" : ""}><MiningItemIcon material="blaze_rod" size={32} alt="" /></span>)}
              <strong>{rods}/4</strong>
            </div>
            <strong>{forestOpen ? "✓ 歪んだ森がひらいた！" : "🔒 歪んだ森はまだひらいていません"}</strong>
            <small>所持ロッド {mining.materials.blaze_rod ?? 0}本 ／ 粉 {mining.materials.blaze_powder ?? 0}個</small>
          </div>
          <div className="journey-lab-action-row">
            <button type="button" disabled={rods >= 4} onClick={() => { onChange(addLastLabRod); setNotice("ロッドを1本補充し、通常の解放判定を実行しました。"); }}>ロッドを1本補充（試験用）</button>
            <button type="button" disabled={!forestOpen} onClick={forward}>森の解放を確認した → ③へ</button>
          </div>
        </>}
        {step === "craft" && <div className="journey-lab-action-row">
          <button type="button" onClick={topUp}>不足材料だけ補充</button>
          <button type="button" onClick={bulkCraft}>残りのアイを一括クラフト</button>
          <button type="button" disabled={(mining.materials.ender_eye ?? 0) < 1} onClick={forward}>作れたのでヒント・探索へ →</button>
        </div>}
        {step === "search" && <div className="journey-lab-action-row">
          <button type="button" onClick={() => changeScenario("hint3")}>3回目のヒントへ</button>
          <button type="button" onClick={() => changeScenario("hint5")}>5回目のヒントへ</button>
          <button type="button" onClick={() => changeScenario("hint7")}>7回目のヒントへ</button>
          <button type="button" onClick={() => changeScenario("hunt")}>装備済みで探索を確認</button>
          <button type="button" disabled={!mining.endQuest?.foundPortal} onClick={forward}>発見したのでポータルへ →</button>
        </div>}
        {step === "portal" && <div className="journey-lab-action-row">
          <button type="button" onClick={bulkCraft}>足りないアイをまとめて作る</button>
          <button type="button" onClick={() => changeScenario("portal")}>残り3枠へ切替（9/12）</button>
        </div>}
        <p className="journey-lab-caution">上の番号・ヒントの状態切替は、その段階用の仮データへの入替です。「次へ」は④以降のクラフト・探索記録を引き継ぎます。</p>
      </details>
      {notice && <p className="journey-lab-notice" role="status">{notice}</p>}
    </header>

    <details className="end-journey-lab-controls">
      <summary>試験データ・チケット・詳細設定</summary>
      <p>クラウド接続・実セーブの読み書きなし。再読み込みで①に戻ります。新しい戦闘の確認は①③から開いてください。</p>
      <div>{SCENARIOS.map(([id, label]) => <button type="button" key={id} onClick={() => changeScenario(id)}>{label}</button>)}</div>
      <button type="button" onClick={() => { onChange((s) => ({ ...s, tickets: Math.max(12, s.tickets) })); setNotice("進行テストのチケットを12枚まで補充しました。別タブの戦闘チケットは変更していません。"); }}>チケットを12枚に補充</button>
      <button type="button" onClick={() => {
        const restored = refreshUnlocks(normalizeMiningState(JSON.parse(JSON.stringify(latest.current))));
        showStep(step, restored, "仮データだけを保存形式に変換し、読み込み直しました。実セーブは触っていません。");
      }}>保存形式での再読込テスト</button>
      <output>🎫{mining.tickets} · 探索{Math.min(5, mining.endQuest?.visited.length ?? 0)}/5 · アイ{mining.endQuest?.eyes ?? 0}/12 · ロッド実績{rods}/4 · ヒント訪問{mining.endQuest?.enderEyeHintVisits ?? 0}</output>
    </details>

    {native && (open ? <div className="end-journey-lab-scroll" data-app-scroll><MiningScreen key={generation} mining={mining} stickerAlbum={[]} buddyProgress={{}} dateKey="2026-10-17" onChange={onChange} onBack={() => setOpen(false)} devJump={jump} /></div>
      : <button type="button" className="end-journey-reenter" onClick={() => { setOpen(true); setGeneration((n) => n + 1); }}>ゲーム画面へもどる</button>)}
    {!native && <section className="journey-lab-preview" aria-label="今回の確認範囲">
      <div className="journey-lab-preview-icons" aria-hidden="true">
        <MiningItemIcon material={step === "enderman" ? "ender_pearl" : "blaze_rod"} size={64} alt="" />
        <span>→</span><MiningItemIcon material="ender_eye" size={64} alt="" />
      </div>
      <h2>集める繰り返しだけ、ショートカット</h2>
      <p>バトルと発見の流れを順に試せます。<br />補充・状態切替は試験専用です。</p>
    </section>}
  </div>;
}
