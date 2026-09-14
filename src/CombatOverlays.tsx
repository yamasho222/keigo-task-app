/** 死亡・必殺ゲージ・10秒連打 */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ExplosionBurst, SlashBurst } from "./endFx";
import {
  SPECIAL_GAUGE_MAX,
  SPECIAL_TAP_DAMAGE,
  SPECIAL_TAP_MS,
  specialGaugeOf,
} from "./playerCombat";
import type { MiningState } from "./miningTypes";

export function SpecialGaugeBar({
  mining,
  ready,
  disabled,
  onFire,
}: {
  mining: MiningState;
  ready: boolean;
  disabled: boolean;
  onFire: () => void;
}) {
  const n = specialGaugeOf(mining);
  return (
    <div className={`mining-special-gauge${ready ? " is-ready" : ""}`}>
      <div className="mining-special-gauge-label">必殺 {n}/{SPECIAL_GAUGE_MAX}</div>
      <div className="mining-special-gauge-pips" aria-hidden>
        {Array.from({ length: SPECIAL_GAUGE_MAX }, (_, i) => (
          <span key={i} className={`mining-special-gauge-pip${i < n ? " is-on" : ""}`} />
        ))}
      </div>
      <button
        type="button"
        className="mining-special-arm"
        disabled={disabled || !ready}
        onClick={onFire}
      >
        {ready ? "必殺を使う" : "まだたりない"}
      </button>
    </div>
  );
}

function formatRushClock(ms: number): string {
  const total = Math.max(0, ms);
  const sec = Math.floor(total / 1000);
  const frac = Math.floor((total % 1000) / 10);
  return `00:${String(sec).padStart(2, "0")}.${String(frac).padStart(2, "0")}`;
}

export function SpecialTapRush({
  showHint,
  onFirstTap,
  onFinish,
}: {
  showHint: boolean;
  onFirstTap: () => void;
  onFinish: (taps: number) => void;
}) {
  const [taps, setTaps] = useState(0);
  const [leftMs, setLeftMs] = useState(SPECIAL_TAP_MS);
  const [running, setRunning] = useState(false);
  const tapsRef = useRef(0);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  const finishRef = useRef(onFinish);
  const firstTapRef = useRef(onFirstTap);
  finishRef.current = onFinish;
  firstTapRef.current = onFirstTap;

  useEffect(() => {
    if (!running) return;
    const started = performance.now();
    let raf = 0;
    const tick = () => {
      const left = Math.max(0, SPECIAL_TAP_MS - (performance.now() - started));
      setLeftMs(left);
      if (left <= 0) {
        if (!finishedRef.current) {
          finishedRef.current = true;
          finishRef.current(tapsRef.current);
        }
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [running]);

  const bump = () => {
    if (finishedRef.current) return;
    if (!startedRef.current) {
      startedRef.current = true;
      firstTapRef.current();
      setRunning(true);
    }
    tapsRef.current += 1;
    setTaps(tapsRef.current);
    navigator.vibrate?.(8);
  };

  const size = Math.min(220, 52 + taps * 3.6);
  const heat = Math.min(1, taps / 50);
  const clock = formatRushClock(running ? leftMs : SPECIAL_TAP_MS);
  const late = running && leftMs < 3000;

  return (
    <div className="mining-special-rush" role="dialog" aria-label="必殺連打">
      <div className="mining-special-rush-hud">
        <div className={`mining-special-rush-time${late ? " is-late" : ""}${running ? " is-run" : ""}`}>
          {clock}
        </div>
        <div className="mining-special-rush-dmg">×{SPECIAL_TAP_DAMAGE} ＝ {taps * SPECIAL_TAP_DAMAGE}ダメ</div>
      </div>
      {showHint && !running && (
        <div className="mining-special-rush-hint">
          枠を連打。回数×2ダメージ。最初のタップで10秒スタート
        </div>
      )}
      {!showHint && !running && (
        <div className="mining-special-rush-wait">タップしてスタート</div>
      )}
      <button
        type="button"
        className={`mining-special-rush-zone${taps >= 25 ? " is-hot" : ""}${taps >= 50 ? " is-max" : ""}`}
        onPointerDown={(e) => {
          e.preventDefault();
          bump();
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="mining-special-rush-ring" aria-hidden />
        <span className="mining-special-rush-ring is-2" aria-hidden />
        {taps > 0 && <span key={`burst-${taps}`} className="mining-special-rush-burst" aria-hidden />}
        <span
          key={taps}
          className={`mining-special-rush-count${taps > 0 ? " is-pop" : ""}`}
          style={{
            fontSize: `${size}px`,
            "--heat": `${heat}`,
          } as CSSProperties}
        >
          {taps}
        </span>
        <span className="mining-special-rush-copy">{taps > 0 ? "連打！" : "ここを連打！"}</span>
      </button>
    </div>
  );
}

export function SpecialFinale({
  active,
  taps,
  damage,
}: {
  active: boolean;
  taps: number;
  damage: number;
}) {
  if (!active) return null;
  return (
    <div className="mining-special-finale" aria-hidden>
      <SlashBurst swings={3} active emphasis="jackpot" seed={taps + 17} />
      <ExplosionBurst active size="xl" />
      <div className="mining-special-finale-num">-{damage}</div>
      <div className="mining-special-finale-sub">{taps}タップ</div>
    </div>
  );
}

export function YouDiedOverlay({
  tickets,
  busy,
  onRevive,
  onFlee,
}: {
  tickets: number;
  busy: boolean;
  onRevive: () => void;
  onFlee: () => void;
}) {
  return (
    <div className="mining-you-died" role="alertdialog" aria-label="倒された">
      <div className="mining-you-died-vignette" aria-hidden />
      <div className="mining-you-died-copy">
        <div className="mining-you-died-kicker">YOU DIED</div>
        <div className="mining-you-died-title">倒された</div>
        <div className="mining-you-died-sub">
          {tickets < 1
            ? "チケットがあれば起き上がれる。逃げることもできる"
            : "チケット1枚で起き上がる。殴るにはもう1枚"}
        </div>
        <button
          type="button"
          className="mining-you-died-revive"
          disabled={busy || tickets < 1}
          onClick={onRevive}
        >
          チケットで起き上がる
        </button>
        <button type="button" className="mining-you-died-flee" onClick={onFlee}>
          逃げる
        </button>
      </div>
    </div>
  );
}
