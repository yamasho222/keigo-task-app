/** エンド章の発見・解放・斬撃・撃破演出 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { playMiningSfx } from "./alarm";

const EYE = "/mining/Eye_of_Ender.png";
const FRAME = "/mining/End_Portal_Frame.webp";
const WELL_EMPTY = "/mining/End_Portal_Empty.jpg";
const WELL_LINKED = "/mining/End_Portal_Connected.jpg";
const DRAGON_IMAGE = "/mining/Ender_Dragon.gif";

export type EndCinematicKind = "discover" | "unlock" | "dragon_win";
export type SlashEmphasis = "normal" | "hit" | "jackpot";

type SlashSpec = {
  ink: string;
  fill: string;
  core: string;
  rot: number;
  dx: number;
  dy: number;
  delay: number;
  sparks: Array<{ x1: number; y1: number; x2: number; y2: number }>;
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function r2(n: number) {
  return Math.round(n * 10) / 10;
}

/** 細長く先端の尖った斬撃。浅い弓なりで、丸いCカーブにはしない */
function makeSlashSpec(rand: () => number, delay: number): SlashSpec {
  const p0 = { x: 4 + rand() * 10, y: 58 + rand() * 34 };
  const p1 = { x: 86 + rand() * 12, y: 4 + rand() * 18 };
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bow = (6 + rand() * 10) * (rand() < 0.5 ? 1 : -1);
  const thick = 8.2 + rand() * 3.2;
  const mx = (p0.x + p1.x) / 2;
  const my = (p0.y + p1.y) / 2;
  const c = { x: mx + nx * bow, y: my + ny * bow };
  const blade = (w: number) => {
    const cOut = { x: c.x + nx * w, y: c.y + ny * w };
    const cIn = { x: c.x - nx * (w * 0.22), y: c.y - ny * (w * 0.22) };
    return `M ${r2(p0.x)} ${r2(p0.y)} Q ${r2(cOut.x)} ${r2(cOut.y)} ${r2(p1.x)} ${r2(p1.y)} Q ${r2(cIn.x)} ${r2(cIn.y)} ${r2(p0.x)} ${r2(p0.y)} Z`;
  };
  const fill = blade(thick);
  const ink = blade(thick + 5.5);
  const core = `M ${r2(p0.x)} ${r2(p0.y)} Q ${r2(c.x)} ${r2(c.y)} ${r2(p1.x)} ${r2(p1.y)}`;
  const hit = { x: mx + nx * (bow * 0.45), y: my + ny * (bow * 0.45) };
  const sparks = Array.from({ length: 4 }, () => {
    const ang = rand() * Math.PI * 2;
    const reach = 10 + rand() * 14;
    return {
      x1: r2(hit.x),
      y1: r2(hit.y),
      x2: r2(hit.x + Math.cos(ang) * reach),
      y2: r2(hit.y + Math.sin(ang) * reach),
    };
  });
  return {
    ink,
    fill,
    core,
    rot: Math.round((rand() * 360 - 18) * 10) / 10,
    dx: Math.round((rand() * 18 - 9) * 10) / 10,
    dy: Math.round((rand() * 18 - 9) * 10) / 10,
    delay,
    sparks,
  };
}

export function SlashBurst({
  swings,
  active,
  compact,
  emphasis = "normal",
  seed = 1,
}: {
  swings: number;
  active: boolean;
  compact?: boolean;
  emphasis?: SlashEmphasis;
  seed?: number;
}) {
  const n = active && swings >= 1 ? Math.max(1, Math.min(3, swings)) : 0;
  const specs = useMemo(() => {
    if (n < 1) return [];
    const rand = mulberry32((seed * 9973 + n * 131 + (emphasis === "jackpot" ? 17 : emphasis === "hit" ? 29 : 41)) >>> 0);
    return Array.from({ length: n }, (_, i) => makeSlashSpec(rand, i * 55));
  }, [n, seed, emphasis]);
  if (n < 1 || specs.length < 1) return null;
  return (
    <span
      className={`mining-slash-burst is-${emphasis}${compact ? " is-compact" : ""}`}
      aria-hidden
    >
      {specs.map((spec, i) => (
        <svg
          key={`${seed}-${i}`}
          className="mining-slash-cut"
          viewBox="0 0 100 100"
          style={{
            animationDelay: `${spec.delay}ms`,
            "--rot": `${spec.rot}deg`,
            "--dx": `${spec.dx}px`,
            "--dy": `${spec.dy}px`,
          } as CSSProperties}
        >
          <path className="mining-slash-ink" d={spec.ink} />
          <path className="mining-slash-fill" d={spec.fill} />
          <path className="mining-slash-core" d={spec.core} />
          {spec.sparks.map((s, si) => (
            <line
              key={si}
              className="mining-slash-tick"
              x1={s.x1}
              y1={s.y1}
              x2={s.x2}
              y2={s.y2}
            />
          ))}
        </svg>
      ))}
      <span className="mining-slash-spark" />
    </span>
  );
}

export function DamageFloater({
  damage,
  heal,
  active,
  emphasis = "normal",
  stay = false,
}: {
  damage: number;
  heal?: number;
  active: boolean;
  emphasis?: SlashEmphasis;
  stay?: boolean;
}) {
  if (!active || damage <= 0) return null;
  return (
    <span className={`mining-dmg-float is-${emphasis}${stay ? " is-stay" : ""}`} aria-hidden>
      <span className="mining-dmg-float-hit">-{damage}</span>
      {heal && heal > 0 ? <span className="mining-dmg-float-heal">+{heal}</span> : null}
    </span>
  );
}

export function ExplosionBurst({
  active,
  size = "md",
}: {
  active: boolean;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  if (!active) return null;
  const shards = size === "xl" ? 28 : 12;
  const step = 360 / shards;
  return (
    <span className={`mining-explode-burst is-${size}`} aria-hidden>
      <span className="mining-explode-flash" />
      <span className="mining-explode-core" />
      <span className="mining-explode-ring" />
      <span className="mining-explode-ring is-2" />
      <span className="mining-explode-ring is-3" />
      {size === "xl" && (
        <>
          <span className="mining-explode-ring is-4" />
          <span className="mining-explode-ring is-5" />
          <span className="mining-explode-shock" />
          <span className="mining-explode-shock is-2" />
        </>
      )}
      {Array.from({ length: shards }, (_, i) => (
        <span
          key={i}
          className={`mining-explode-shard${size === "xl" ? " is-xl" : ""}`}
          style={{ "--a": `${i * step}deg` } as CSSProperties}
        />
      ))}
    </span>
  );
}

/** エンドラの強攻撃＝ドラゴンブレス */
export function DragonBreathBurst({
  active,
  screen = false,
}: {
  active: boolean;
  screen?: boolean;
}) {
  if (!active) return null;
  return (
    <span className={`mining-breath-burst${screen ? " is-screen" : ""}`} aria-hidden>
      <span className="mining-breath-glow" />
      <span className="mining-breath-cone" />
      <span className="mining-breath-cone is-2" />
      {Array.from({ length: 16 }, (_, i) => (
        <span
          key={i}
          className="mining-breath-mote"
          style={{
            left: `${18 + (i * 17) % 64}%`,
            animationDelay: `${(screen ? 0.02 : 0.28) + (i % 8) * 0.05}s`,
            animationDuration: `${0.55 + (i % 5) * 0.08}s`,
            "--drift": `${-18 + (i % 7) * 6}px`,
          } as CSSProperties}
        />
      ))}
    </span>
  );
}

export type IncomingKind = "blaze" | "enderman" | "dragon" | "breath";

/** 敵の反撃が画面に乗る（炎・体当たり・斬撃・ブレス＋被ダメ数字） */
export function IncomingHitFx({
  kind,
  hearts,
  active,
}: {
  kind: IncomingKind;
  hearts: number;
  active: boolean;
}) {
  if (!active) return null;
  return (
    <span className={`mining-incoming is-${kind}`} aria-hidden>
      {kind === "blaze" && (
        <>
          <span className="mining-incoming-wash is-fire" />
          {Array.from({ length: 14 }, (_, i) => (
            <span
              key={i}
              className="mining-incoming-flame"
              style={{
                left: `${6 + (i * 7) % 88}%`,
                animationDelay: `${(i % 7) * 0.04}s`,
                "--h": `${48 + (i % 5) * 14}px`,
              } as CSSProperties}
            />
          ))}
        </>
      )}
      {kind === "enderman" && (
        <>
          <span className="mining-incoming-wash is-void" />
          <span className="mining-incoming-shock" />
          <span className="mining-incoming-shock is-2" />
          <span className="mining-incoming-shock is-3" />
        </>
      )}
      {kind === "dragon" && (
        <>
          <span className="mining-incoming-wash is-claw" />
          <SlashBurst swings={2} active emphasis="normal" seed={91} />
        </>
      )}
      {kind === "breath" && (
        <>
          <span className="mining-incoming-wash is-breath" />
          <DragonBreathBurst active screen />
        </>
      )}
      <span className={`mining-incoming-num${kind === "breath" ? " is-breath" : ""}`}>
        {hearts > 0
          ? `-${Number.isInteger(hearts) ? hearts : hearts.toFixed(1)}`
          : "0"}
      </span>
    </span>
  );
}

function StarField({ count }: { count: number }) {
  return (
    <div className="mining-end-cine-stars" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="mining-end-cine-star"
          style={{
            left: `${(i * 37) % 100}%`,
            top: `${(i * 53) % 100}%`,
            animationDelay: `${(i % 12) * 0.12}s`,
            animationDuration: `${1.6 + (i % 5) * 0.35}s`,
          }}
        />
      ))}
    </div>
  );
}

function EmberField() {
  return (
    <div className="mining-end-cine-embers" aria-hidden>
      {Array.from({ length: 18 }, (_, i) => (
        <span
          key={i}
          className="mining-end-cine-ember"
          style={{
            left: `${28 + (i * 13) % 44}%`,
            animationDelay: `${0.2 + (i % 9) * 0.11}s`,
            animationDuration: `${1.1 + (i % 4) * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
}

function EyeRing({ mode }: { mode: "frames" | "eyes" }) {
  const src = mode === "eyes" ? EYE : FRAME;
  const step = mode === "eyes" ? 0.1 : 0.05;
  const start = mode === "eyes" ? 0.42 : 0.55;
  const radius = mode === "eyes" ? -168 : -108;
  return (
    <div className={`mining-end-cine-ring${mode === "eyes" ? " is-eyes" : ""}`} aria-hidden>
      {Array.from({ length: 12 }, (_, i) => (
        <img
          key={i}
          src={src}
          alt=""
          draggable={false}
          style={{
            transform: `rotate(${i * 30}deg) translateY(${radius}px)`,
            animationDelay: `${start + i * step}s`,
          }}
        />
      ))}
    </div>
  );
}

function FlyingEyes() {
  return (
    <div className="mining-end-cine-eyes" aria-hidden>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <img
          key={i}
          className={`mining-end-cine-eye i${i}`}
          src={EYE}
          alt=""
          draggable={false}
        />
      ))}
    </div>
  );
}

function LavaShatter() {
  return (
    <div className="mining-end-cine-shatter" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <img
          key={i}
          className={`mining-end-cine-shard s${i}`}
          src={WELL_EMPTY}
          alt=""
          draggable={false}
        />
      ))}
    </div>
  );
}

const WIN_CONFETTI = ["#ffe566", "#ff4d9a", "#18f0ff", "#fff", "#7c4dff", "#ff9100", "#69f0ae", "#ff1744"];

function VictoryHype() {
  return (
    <div className="mining-end-win-hype" aria-hidden>
      <div className="mining-end-win-speedlines" />
      <div className="mining-end-win-bloom" />
      <div className="mining-end-win-ring r0" />
      <div className="mining-end-win-ring r1" />
      <div className="mining-end-win-ring r2" />
      {Array.from({ length: 56 }, (_, i) => (
        <span
          key={`c${i}`}
          className={`mining-end-win-bit s${i % 4}`}
          style={{
            "--a": `${(i * 137.508) % 360}deg`,
            "--d": `${72 + (i % 8) * 26}px`,
            animationDelay: `${0.08 + (i % 14) * 0.035}s`,
            background: WIN_CONFETTI[i % WIN_CONFETTI.length],
          } as CSSProperties}
        />
      ))}
      {Array.from({ length: 18 }, (_, i) => (
        <span
          key={`st${i}`}
          className="mining-end-win-star"
          style={{
            "--a": `${i * 20}deg`,
            animationDelay: `${0.12 + (i % 9) * 0.06}s`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}

export function EndCinematicOverlay({
  kind,
  onClose,
}: {
  kind: EndCinematicKind;
  onClose: () => void;
}) {
  const discover = kind === "discover";
  const unlock = kind === "unlock";
  const dragonWin = kind === "dragon_win";
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    void playMiningSfx(
      discover ? "end_discover" : unlock ? "end_unlock" : "end_dragon_win",
    );
    navigator.vibrate?.(discover
      ? [40, 50, 40, 50, 90, 40, 120]
      : unlock
        ? [40, 30, 40, 30, 40, 30, 40, 30, 80, 30, 140, 40, 180]
        : [40, 30, 80, 30, 40, 30, 120, 40, 60, 30, 180, 40, 240]);
    const btnAt = discover ? 2200 : unlock ? 4600 : 4200;
    const autoAt = discover ? 6200 : unlock ? 9800 : 11000;
    const unlockBtn = window.setTimeout(() => setReady(true), btnAt);
    const auto = window.setTimeout(() => onCloseRef.current(), autoAt);
    return () => {
      window.clearTimeout(unlockBtn);
      window.clearTimeout(auto);
    };
  }, [kind, discover, unlock]);

  return (
    <div
      className={`mining-end-cine is-${kind}`}
      role="dialog"
      aria-modal="true"
      aria-label={
        discover ? "エンドポータルをみつけた"
          : unlock ? "ポータルがつながった"
            : "エンドラをたおした"
      }
      onClick={ready ? onClose : undefined}
    >
      <div className="mining-end-cine-lava-glow" />
      <div className="mining-end-cine-void-glow" />
      <div className="mining-end-cine-vignette" />
      <div className="mining-end-cine-flash is-lava" />
      <div className="mining-end-cine-flash" />
      <div className="mining-end-cine-flash is-late" />
      <div className="mining-end-cine-shock" aria-hidden />
      <div className="mining-end-cine-shock is-late" aria-hidden />
      <div className="mining-end-cine-shock is-final" aria-hidden />
      <div className="mining-end-cine-rays" aria-hidden />
      <StarField count={discover ? 28 : dragonWin ? 56 : 42} />
      {unlock && <EmberField />}
      {discover && <FlyingEyes />}
      {dragonWin && <VictoryHype />}
      <div className="mining-end-cine-stage">
        {discover && <EyeRing mode="frames" />}
        {unlock && <EyeRing mode="eyes" />}
        {discover ? (
          <img className="mining-end-cine-well" src={WELL_EMPTY} alt="" draggable={false} />
        ) : unlock ? (
          <div className="mining-end-cine-well-stack">
            <span className="mining-end-cine-pillar" aria-hidden />
            <span className="mining-end-cine-rift" aria-hidden />
            <span className="mining-end-cine-bloom" aria-hidden />
            <img className="mining-end-cine-well is-lava" src={WELL_EMPTY} alt="" draggable={false} />
            <span className="mining-end-cine-cracks" aria-hidden />
            <LavaShatter />
            <img className="mining-end-cine-well is-void is-chroma-r" src={WELL_LINKED} alt="" draggable={false} />
            <img className="mining-end-cine-well is-void is-chroma-b" src={WELL_LINKED} alt="" draggable={false} />
            <img className="mining-end-cine-well is-void" src={WELL_LINKED} alt="" draggable={false} />
          </div>
        ) : (
          <div className="mining-end-cine-dragon-wrap">
            <img className="mining-end-cine-dragon" src={DRAGON_IMAGE} alt="" draggable={false} />
            <span className="mining-end-cine-dragon-burst" aria-hidden />
            <ExplosionBurst active size="lg" />
          </div>
        )}
      </div>
      <div className="mining-end-cine-copy">
        <div className="mining-end-cine-kicker">
          {discover ? "FOUND" : unlock ? "THE END" : "CLEAR"}
        </div>
        <div className="mining-end-cine-title">
          {discover ? "エンドポータル みつけた！" : unlock ? "ポータルがつながった！" : "エンドラをたおした"}
        </div>
        <div className="mining-end-cine-sub">
          {discover
            ? "行き先にあらわれたよ。アイを12こはめよう"
            : unlock
              ? "つながったポータルをタップして、ほりばへ"
              : "ジ・エンドを守りぬいた"}
        </div>
        <button
          type="button"
          className={`mining-end-cine-next${ready ? " is-ready" : ""}`}
          onClick={onClose}
        >
          つぎへ
        </button>
      </div>
    </div>
  );
}

export const EYE_OF_ENDER_IMAGE = EYE;
export const END_PORTAL_LINKED_IMAGE = WELL_LINKED;
