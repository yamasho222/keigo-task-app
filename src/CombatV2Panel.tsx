import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { playMiningSfx, unlockAudio } from "./alarm";
import { BLAZE_IMAGE, ENDERMAN_IMAGE } from "./miningCombat";
import { HeartRow } from "./PlayerCombatHud";
import { GACHA_META, MATERIAL_META, type MiningState } from "./miningTypes";
import type { MiningPatch } from "./miningCommit";
import { canUseCombatV2 } from "./combatV2Session";
import { v2Drop, v2HasWater, v2MaxMobHp, v2Sword } from "./combatV2Rules";
import { COMBAT_ACTIONS, COMBAT_ACTION_LABEL, COMBAT_HAND, COMBAT_V2_RULES as R, type CombatAction, type CombatV2Location } from "./combatV2Types";
import { useCombatV2Controller } from "./useCombatV2Controller";
import "./combatV2.css";

type Props = { mining: MiningState; location: CombatV2Location; dateKey: string; onChange: (patch: MiningPatch) => void; onClose: () => void };
const advantages: Record<CombatAction, string> = { guard: "きる をうけとめる", cut: "ためる よりはやい", charge: "まもる をくずす" };
const resultText = { advantage: "うまく きまった！", even: "おたがいに こうげき！", disadvantage: "あいての わざが つよい！" };
const advantageText: Record<CombatAction, string> = { guard: "うけとめて はんげき！", cut: "さきに きりこんだ！", charge: "まもりを くずした！" };

export function CombatV2Panel({ mining, location, dateKey, onChange, onClose }: Props) {
  const { session: s, send, now } = useCombatV2Controller(mining, location, dateKey, onChange);
  const [confirm, setConfirm] = useState<"return" | "heal" | "special" | null>(null);
  const [animation, setAnimation] = useState<{ id?: string; phase: "idle" | "attack" | "counter" }>({ id: s?.lastEvent?.id, phase: "idle" });
  const seenEvent = useRef(s?.lastEvent?.id);
  const root = useRef<HTMLDivElement>(null);
  const event = s?.lastEvent;
  const attackEvent = event?.kind === "act" || event?.kind === "special";
  const phase = attackEvent ? (animation.id !== event.id ? "attack" : animation.phase) : "idle";
  const eventRef = useRef(event);
  const closeRef = useRef(onClose);
  const confirmRef = useRef(confirm);
  useLayoutEffect(() => { eventRef.current = event; closeRef.current = onClose; confirmRef.current = confirm; }, [event, onClose, confirm]);
  const hasWater = v2HasWater(mining, location);
  const busy = phase !== "idle";
  const maxHp = v2MaxMobHp(location);
  const sprite = location === "fortress" ? BLAZE_IMAGE : ENDERMAN_IMAGE;
  const drop = v2Drop(location);

  // The saved result is final; these timers only control presentation, never resources.
  useEffect(() => {
    const event = eventRef.current;
    if (!event || seenEvent.current === event.id) return;
    seenEvent.current = event.id;
    if (event.kind !== "act" && event.kind !== "special") {
      const reset = window.setTimeout(() => setAnimation({ id: event.id, phase: "idle" }), 0);
      return () => clearTimeout(reset);
    }
    void playMiningSfx(event.kind === "special" ? (location === "fortress" ? "special_blaze" : "special_enderman") : (location === "fortress" ? "slash_blaze" : "slash_enderman"));
    const counter = window.setTimeout(() => setAnimation({ id: event.id, phase: "counter" }), 430);
    const done = window.setTimeout(() => setAnimation({ id: event.id, phase: "idle" }), event.takenHp ? 950 : 700);
    return () => { clearTimeout(counter); clearTimeout(done); };
  }, [event?.id, location]);

  const hasSession = !!s;
  useEffect(() => {
    const previous = document.activeElement;
    root.current?.focus();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (confirmRef.current) setConfirm(null); else closeRef.current(); }
      if (e.key !== "Tab" || !root.current) return;
      const scope = root.current.querySelector(".cv2-modal") ?? root.current;
      const buttons = [...scope.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
      const first = buttons[0], last = buttons.at(-1);
      if (e.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", keydown); document.body.style.overflow = previousOverflow; if (previous instanceof HTMLElement) previous.focus(); };
  }, [hasSession]);

  if (!s) return createPortal(<div className="cv2-backdrop"><div role="status">たたかう じゅんび…</div></div>, document.body);
  const hp = phase === "attack" && event ? event.previousHp : s.hp;
  const usable = (kind: Parameters<typeof canUseCombatV2>[2]) => !busy && canUseCombatV2(mining, location, kind);
  const remainingText = s.remainingActions > 0 ? `あと${s.remainingActions}手・チケットいらない` : "チケット1枚で2手";
  const act = (action: CombatAction) => { if (usable("act")) { void unlockAudio(); send("act", action); } };
  const outcome = event?.kind === "act" ? (event.affinity === "advantage" ? advantageText[event.action!] : resultText[event.affinity!]) : event?.kind === "special" ? "ひっさつ！ はんげきを とめた！" : event?.kind === "heal" ? "ハートが もどった！" : "あいての かまえを みよう";
  const isClosed = s.status === "defeated" || s.status === "returned";
  const special = s.pendingSpecial;
  const shownIntent = busy && event?.enemy ? { candidates: [event.enemy], unknown: false } : s.intent;
  return createPortal(
    <div className="cv2-backdrop">
      <div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${GACHA_META[location].label}でたたかう`} className={`cv2-panel cv2-${location} cv2-phase-${phase}`}>
        <header className="cv2-header"><div><small>テスト版・たたかう</small><h2>{GACHA_META[location].label}</h2></div><button type="button" onClick={onClose} aria-label="記録を残して中断する">あとで ×</button></header>
        <div className="cv2-hud"><div aria-label={`ハート ${hp / 2} / 10`}><HeartRow hp={hp} hearts={10} player /><b>{hp / 2} / 10</b></div><span>🎫 {mining.tickets}枚</span></div>
        <div className="cv2-arena" aria-label="敵のようす">
          {s.mobs.map((mobHp, i) => {
            const visibleHp = phase === "attack" ? (event?.previousMobs?.[i] ?? mobHp) : mobHp;
            return <div key={`${s.wave}-${i}`} className={`cv2-enemy${mobHp === 0 && phase !== "attack" ? " is-down" : ""}${phase === "attack" && event?.targets.includes(i) ? " is-hit" : ""}`}>
            <div className="cv2-sprite"><img src={sprite} alt={location === "fortress" ? "ブレイズ" : "エンダーマン"} draggable={false} />
              {phase === "attack" && event?.targets.includes(i) && <span className={event.kind === "special" ? "cv2-finisher" : "cv2-slash"} aria-hidden>{event.kind === "special" ? "✦" : "／"}</span>}
              {phase === "attack" && event?.targets.includes(i) && <b className="cv2-damage">−{event.damage}</b>}
            </div>
            <progress value={visibleHp} max={maxHp} aria-label={`敵${i + 1}のHP ${visibleHp}/${maxHp}`} /><small>{visibleHp}/{maxHp}</small>
          </div>; })}
          {hasWater && <span className="cv2-water" aria-label="水の効果が発動中">💧 みずが まもっている</span>}
        </div>
        <div className="cv2-result" role="status" aria-live="polite">{busy && phase === "attack" ? (event?.action ? `${COMBAT_ACTION_LABEL[event.action]}！` : "ひっさつ！") : outcome}{phase === "counter" && event && <b> ハート −{event.takenHp / 2}</b>}</div>
        {!isClosed && s.status !== "cleared" && <>
          <div className="cv2-intent"><span>{busy ? "あいての わざ" : "あいての かまえ"}</span><strong>{shownIntent.unknown ? "？" : shownIntent.candidates.map((action) => <span key={action}>{COMBAT_ACTION_LABEL[action]} <small>{COMBAT_HAND[action]}</small></span>)}</strong>{shownIntent.candidates.length === 2 && <small>どちらかだよ。はやおしではないよ</small>}</div>
          <div className="cv2-turn">{remainingText}</div>
          <div className="cv2-triangle" role="group" aria-label="まもるはきるに強い。きるはためるに強い。ためるはまもるに強い">
            {COMBAT_ACTIONS.map((action) => <button type="button" className={`cv2-action cv2-action-${action}`} key={action} disabled={!usable("act")} onClick={() => act(action)}>
              <strong>{COMBAT_ACTION_LABEL[action]}</strong><span aria-hidden>{COMBAT_HAND[action]}</span><small>{advantages[action]}</small>
            </button>)}<span className="cv2-edge cv2-edge-a" aria-hidden>↘</span><span className="cv2-edge cv2-edge-b" aria-hidden>←</span><span className="cv2-edge cv2-edge-c" aria-hidden>↗</span>
          </div>
        </>}
        {!v2Sword(mining) && <p className="cv2-notice">剣を つくってから たたかおう</p>}
        {!isClosed && <div className="cv2-tools"><button type="button" disabled={!usable("heal")} onClick={() => setConfirm("heal")}>♥ かいふく<small>1枚・ハート＋5</small></button><button type="button" className="cv2-special-button" disabled={!usable("beginSpecial")} onClick={() => setConfirm("special")}>✦ ひっさつ<small>{"★".repeat(s.gauge)}{"☆".repeat(5 - s.gauge)}</small></button><button type="button" disabled={!usable("return")} onClick={() => setConfirm("return")}>かえる<small>おたからを もって</small></button></div>}
        {s.status === "cleared" && !busy && <div className="cv2-clear"><h3>2たい たおした！</h3><p>おたからは もう あんしん。</p><button type="button" onClick={() => send("next")}>つぎの2たいへ<small>{remainingText}</small></button><button type="button" onClick={() => setConfirm("return")}>きょうは かえる</button></div>}
        {isClosed && !busy && <div className="cv2-closed"><h3>{s.status === "defeated" ? "たおされた" : "ぶじに かえった！"}</h3><p>{s.status === "defeated" ? `ふくろの おたから ${event?.lost ?? 0}こを おとした。` : "おたからを もちかえったよ。"}<br />ここは また あした。ほかの場所では あそべるよ。</p>
          {location === "warped_forest" && s.status === "defeated" && s.failures > 0 && <p className="cv2-hint">{s.failures >= 2 ? "そうびを みなおすと、にがてなものを 近づけられるかも…" : "エンダーマンは、雨がふると どこかへ いってしまう…"}</p>}
          {usable("retryWater") && <button type="button" onClick={() => send("retryWater")}>あたらしい そうびで ためす<small>はじめての1回だけ・こうげきにはチケットがいるよ</small></button>}
          <button type="button" onClick={onClose}>ほかの場所へ</button>
        </div>}
        <footer className="cv2-bag"><span>ふくろ：<img src={MATERIAL_META[drop].image} alt={MATERIAL_META[drop].label} /> {s.bag}こ<small>かえると あんしん</small></span><span>もちかえった：{mining.materials[drop] ?? 0}こ</span></footer>
        {location === "fortress" && !mining.unlockedGachas.includes("warped_forest") && <p className="cv2-progress">歪んだ森まで：ロッド あと{Math.max(0, 4 - (mining.materials.blaze_rod ?? 0))}本を もちかえろう</p>}
        {s.status === "choosing" && mining.tickets === 0 && s.remainingActions === 0 && <p className="cv2-notice">チケットが ないよ。あとでつづける？ おたからをもって かえる？</p>}
        {confirm && <div className="cv2-modal" role="alertdialog" aria-modal="true" aria-label={confirm === "return" ? "持ち帰りの確認" : confirm === "heal" ? "回復の確認" : "必殺技の確認"}>
          <div><h3>{confirm === "return" ? "おたからを もって かえる？" : confirm === "heal" ? "チケット1枚で かいふく？" : "ひっさつを つかう？"}</h3>
            <p>{confirm === "return" ? `ここでの たたかいは また あした。のこり${s.remainingActions}手と つかったチケットは もどらないよ。あとで つづけたいなら「あとで」で 中断してね。` : confirm === "heal" ? `ハート ${s.hp / 2} → ${Math.min(20, s.hp + 10) / 2}。はんげきは こないよ。あいてのかまえは そのまま。` : "5びょうで 10かいまで。ゆっくりでも つよいよ。1手つかって、あいての はんげきを とめる！"}</p>
            <button type="button" autoFocus onClick={() => { const kind = confirm === "return" ? "return" : confirm === "heal" ? "heal" : "beginSpecial"; setConfirm(null); send(kind); }}>{confirm === "return" ? "かえる" : confirm === "heal" ? "かいふくする" : "はじめる"}</button><button type="button" onClick={() => setConfirm(null)}>やめる</button>
          </div>
        </div>}
        {special && <div className="cv2-modal cv2-rush" role="dialog" aria-modal="true" aria-label="必殺技の5秒入力"><div><h3>ちからを こめよう！</h3><p>のこり {Math.min(R.specialMs / 1000, Math.max(0, Math.ceil((special.deadline - now) / 1000)))}びょう</p><progress value={special.taps} max={R.maxTaps} aria-label={`追撃 ${special.taps} / 10`} /><button type="button" autoFocus disabled={special.taps >= R.maxTaps || now >= special.deadline} onClick={() => send("tap")} onKeyDown={(e) => { if (e.repeat) e.preventDefault(); }}>✦<small>{special.taps} / {R.maxTaps}</small></button><p>おさなくても こうげきするよ<br />いそがず タップ！</p><button type="button" onClick={onClose}>きろくして あとで</button></div></div>}
      </div>
    </div>, document.body,
  );
}
