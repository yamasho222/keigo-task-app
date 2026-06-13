import type { CSSProperties, ReactNode } from "react";
import { theme } from "./theme";
import type { RewardRarity } from "./stickerRewards";

export const TEASE_DURATION_MS = 2000;
export const TEASE_TRIGGER_CHANCE = { superRare: 0.25, ultraRare: 0.50 } as const;

export type TeaseVariantId =
  | "sr-orbit" | "sr-ripple" | "sr-glimmer"
  | "ur-pillar" | "ur-meteor" | "ur-aurora" | "ur-supernova";

export type TeaseTier = "superRare" | "ultraRare";

export interface TeaseVariant {
  id: TeaseVariantId;
  tier: TeaseTier;
  durationMs: number;
  vibratePattern: number[];
  overlayShake?: boolean;
  Component: () => ReactNode;
}

const srPurple = theme.category.purple;
const srPink = theme.category.pink;
const srBlue = theme.category.blue;
const urGold = theme.category.yellow;
const urOrange = theme.category.orange;
const urPink = theme.category.pink;

function TeaseStage({ children, shake = false, dim = false }: { children: ReactNode; shake?: boolean; dim?: boolean }) {
  return (
    <div
      className={shake ? "phone-shake" : undefined}
      style={{
        position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 3,
      }}
    >
      {dim && <div className="tease-dim" />}
      {children}
    </div>
  );
}

function TeaseChest({ className = "chest-shake", size = 88, glowColor }: {
  className?: string; size?: number; glowColor?: string;
}) {
  return (
    <div style={{
      position: "absolute", left: "50%", top: "50%",
      transform: "translate(-50%, -50%)", zIndex: 8,
      filter: glowColor ? `drop-shadow(0 0 20px ${glowColor})` : undefined,
    }}>
      <div className={className} style={{ fontSize: size, lineHeight: 1 }}>🎁</div>
    </div>
  );
}

function FullFlash({ color, delay = 0, opacity = 0.65 }: { color: string; delay?: number; opacity?: number }) {
  return (
    <div className="record-flash" style={{
      position: "absolute", inset: 0,
      background: `radial-gradient(circle at 50% 50%, ${color}${Math.round(opacity * 255).toString(16).padStart(2, "0")} 0%, transparent 58%)`,
      animationDelay: `${delay}s`,
    }} />
  );
}

function SrMagicCircleTease() {
  const runes = Array.from({ length: 16 }, (_, i) => i);
  const beams = Array.from({ length: 8 }, (_, i) => i);
  return (
    <TeaseStage>
      <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}>
        <div className="sr-magic-floor-glow" style={{
          position: "absolute", width: 260, height: 90, left: -130, top: 38,
          borderRadius: "50%",
          background: `radial-gradient(ellipse, ${srPurple}66 0%, ${srBlue}33 42%, transparent 72%)`,
        }} />
        <div className="sr-magic-circle sr-magic-spin" style={{
          position: "absolute", width: 228, height: 228, left: -114, top: -114,
          borderRadius: "50%", border: `2.5px solid ${srPurple}DD`,
          boxShadow: `0 0 36px ${srPurple}99, inset 0 0 24px ${srBlue}66`,
        }}>
          {runes.map((i) => {
            const angle = (360 / runes.length) * i;
            return (
              <span key={i} style={{
                position: "absolute", left: "50%", top: 5,
                width: 5, height: 18, borderRadius: 999,
                backgroundColor: i % 2 ? srPink : srBlue,
                transform: `rotate(${angle}deg) translateY(-2px)`,
                transformOrigin: "0 109px",
                boxShadow: `0 0 10px ${i % 2 ? srPink : srBlue}`,
              }} />
            );
          })}
        </div>
        <div className="sr-magic-circle sr-magic-spin-reverse" style={{
          position: "absolute", width: 148, height: 148, left: -74, top: -74,
          borderRadius: "50%", border: `2px dashed ${srPink}DD`,
          boxShadow: `0 0 24px ${srPink}88`,
        }} />
        {beams.map((i) => {
          const angle = (360 / beams.length) * i;
          return (
            <div key={i} className="sr-magic-beam" style={{
              position: "absolute", left: -2, top: -88,
              width: 5, height: 78, borderRadius: 999,
              background: `linear-gradient(to bottom, ${srBlue}00, ${srPurple}DD)`,
              transformOrigin: "2.5px 88px",
              "--beam-rot": `${angle}deg`,
              animationDelay: `${0.15 + i * 0.035}s`,
            } as CSSProperties} />
          );
        })}
      </div>
      <TeaseChest className="chest-levitate" size={90} glowColor={`${srPurple}CC`} />
      <FullFlash color={srPurple} delay={1.58} opacity={0.52} />
    </TeaseStage>
  );
}

function SrStarRainTease() {
  const stars = Array.from({ length: 30 }, (_, i) => ({
    left: (i * 29) % 100,
    size: 4 + (i % 4) * 2,
    delay: (i % 10) * 0.07,
    color: [srBlue, srPurple, "#ffffff", srPink][i % 4],
  }));

  return (
    <TeaseStage>
      <div style={{ position: "absolute", inset: 0 }}>
        {stars.map((s, i) => (
          <div key={i} className="sr-star-rain" style={{
            position: "absolute", left: `${s.left}%`, top: -20,
            width: s.size, height: s.size, borderRadius: "50%",
            backgroundColor: s.color,
            boxShadow: `0 0 ${s.size * 2}px ${s.color}`,
            animationDelay: `${s.delay}s`,
          }} />
        ))}
      </div>
      <div className="sr-star-ground-glow" style={{
        position: "absolute", left: "50%", top: "58%",
        width: 220, height: 72, marginLeft: -110, marginTop: -10,
        borderRadius: "50%",
        background: `radial-gradient(ellipse, ${srBlue}55 0%, ${srPurple}22 45%, transparent 72%)`,
      }} />
      <TeaseChest className="chest-shake" size={88} glowColor={`${srBlue}88`} />
      <FullFlash color={srBlue} delay={1.62} opacity={0.42} />
    </TeaseStage>
  );
}

function SrMistTease() {
  const mist = Array.from({ length: 22 }, (_, i) => ({
    x: -78 + (i % 7) * 26,
    y: (i % 3) * 10,
    size: 20 + (i % 4) * 14,
    delay: i * 0.04,
    color: i % 3 === 0 ? srPink : i % 3 === 1 ? srPurple : srBlue,
  }));
  const sparks = Array.from({ length: 14 }, (_, i) => ({
    x: -58 + (i % 7) * 18,
    delay: 0.3 + i * 0.035,
  }));

  return (
    <TeaseStage>
      <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}>
        <div className="sr-mist-spread" style={{
          position: "absolute", width: 260, height: 110, left: -130, top: -20,
          borderRadius: "50%",
          background: `radial-gradient(ellipse, ${srPurple}77 0%, ${srPink}44 40%, transparent 74%)`,
          filter: "blur(4px)",
        }} />
        {mist.map((m, i) => (
          <div key={`m-${i}`} className="sr-mist-rise" style={{
            position: "absolute", left: m.x, top: m.y,
            width: m.size, height: m.size * 0.72, borderRadius: "50%",
            backgroundColor: `${m.color}99`,
            filter: "blur(5px)",
            animationDelay: `${m.delay}s`,
          }} />
        ))}
        {sparks.map((s, i) => (
          <div key={`s-${i}`} className="glimmer-rise" style={{
            position: "absolute", left: s.x, top: 0,
            width: 6, height: 6, borderRadius: "50%",
            backgroundColor: i % 2 ? "#fff" : srPink,
            boxShadow: `0 0 12px ${i % 2 ? "#fff" : srPink}`,
            animationDelay: `${s.delay}s`,
          }} />
        ))}
      </div>
      <TeaseChest className="chest-shake" size={88} glowColor={`${srPurple}CC`} />
      <FullFlash color={srPurple} delay={1.68} opacity={0.45} />
    </TeaseStage>
  );
}

function UrPillarTease() {
  const embers = Array.from({ length: 30 }, (_, i) => ({
    left: 42 + (i % 7) * 2.6,
    delay: (i % 10) * 0.06,
    size: 5 + (i % 4) * 3,
  }));
  return (
    <TeaseStage shake dim>
      <TeaseChest className="chest-shake-fast" size={102} glowColor={`${urOrange}CC`} />
      <div className="ur-light-column-max" style={{
        position: "absolute", left: "50%", bottom: "22%", width: 136, height: "82%",
        marginLeft: -68,
        background: `linear-gradient(to top, ${urOrange}00, ${urOrange}EE 28%, #fff7 58%, ${urGold}FF)`,
        filter: "blur(2px)",
        transformOrigin: "bottom center",
      }} />
      {embers.map((p, i) => (
        <div key={i} className="ur-ember-rise" style={{
          position: "absolute", left: `${p.left}%`, bottom: "28%",
          width: p.size, height: p.size, borderRadius: "50%",
          backgroundColor: i % 2 ? urGold : urOrange,
          boxShadow: `0 0 12px ${i % 2 ? urGold : urOrange}`,
          animationDelay: `${p.delay}s`,
        }} />
      ))}
      {[0, 0.28].map((delay) => (
        <div key={delay} className="ur-shockwave-max" style={{
          position: "absolute", left: "50%", top: "60%",
          width: 130, height: 130, marginLeft: -65, marginTop: -65,
          borderRadius: "50%", border: `5px solid ${urGold}`,
          animationDelay: `${1.05 + delay}s`,
        }} />
      ))}
      <FullFlash color={urOrange} delay={1.55} opacity={0.78} />
    </TeaseStage>
  );
}

function UrMeteorTease() {
  const meteors = [
    { mx: "-58vw", my: "-48vh", rot: 42 },
    { mx: "58vw", my: "-48vh", rot: -42 },
    { mx: "-62vw", my: "-8vh", rot: 18 },
    { mx: "62vw", my: "-8vh", rot: -18 },
    { mx: "-48vw", my: "42vh", rot: -28 },
    { mx: "48vw", my: "42vh", rot: 28 },
  ];
  return (
    <TeaseStage shake dim>
      <TeaseChest className="chest-shake-fast" size={100} glowColor={`${urOrange}CC`} />
      <div style={{ position: "absolute", left: "50%", top: "50%" }}>
        {meteors.map((m, i) => (
          <div key={i} className="ur-meteor-max" style={{
            position: "absolute", width: 18, height: 18, borderRadius: "50%",
            backgroundColor: i % 2 ? urGold : urOrange,
            boxShadow: `0 0 20px ${urOrange}, 0 0 40px ${urGold}`,
            animationDelay: `${0.12 + i * 0.075}s`,
            "--mx": m.mx, "--my": m.my, "--meteor-rot": `${m.rot}deg`,
          } as CSSProperties} />
        ))}
      </div>
      <div className="ur-impact-white" style={{ animationDelay: "1.05s" }} />
      <FullFlash color={urOrange} delay={1.36} opacity={0.8} />
      <FullFlash color={urGold} delay={1.62} opacity={0.68} />
    </TeaseStage>
  );
}

function UrAuroraTease() {
  const arcs = [0, 1, 2];
  const confetti = Array.from({ length: 34 }, (_, i) => i);
  return (
    <TeaseStage dim>
      <div style={{ position: "absolute", left: "50%", top: "50%" }}>
        {arcs.map((i) => (
          <div key={i} className="ur-gate-spin" style={{
            position: "absolute", left: -130 - i * 20, top: -130 - i * 20,
            width: 260 + i * 40, height: 260 + i * 40,
            borderRadius: "50%",
            border: `8px solid transparent`,
            borderTopColor: [urOrange, urGold, srPurple][i],
            borderRightColor: [urGold, urPink, urOrange][i],
            filter: "blur(0.5px)",
            animationDelay: `${i * 0.08}s`,
          }} />
        ))}
      </div>
      <div className="ur-gate-core" style={{
        position: "absolute", left: "50%", top: "50%",
        width: 180, height: 180, marginLeft: -90, marginTop: -90,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${urGold}66 0%, ${urOrange}33 38%, transparent 70%)`,
      }} />
      <TeaseChest className="chest-open-ur" size={104} glowColor={`${urGold}CC`} />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {confetti.map((i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${(i * 31) % 100}%`, top: -18,
            width: 8 + (i % 3) * 3, height: i % 2 ? 8 : 5,
            borderRadius: i % 2 ? "50%" : 2,
            backgroundColor: [urOrange, urGold, urPink, srPurple][i % 4],
            animationName: "confettiPiece",
            animationDuration: "1.15s", animationDelay: `${1.05 + i * 0.018}s`,
            animationFillMode: "both", animationTimingFunction: "linear",
            "--spin": `${i * 110}deg`,
          } as CSSProperties} />
        ))}
      </div>
      <FullFlash color={urOrange} delay={1.65} opacity={0.66} />
    </TeaseStage>
  );
}

function UrSupernovaTease() {
  const burstColors = [urOrange, urGold, urPink, srPurple, "#ffffff"];
  const dust = Array.from({ length: 46 }, (_, i) => i);
  return (
    <TeaseStage shake>
      <TeaseChest className="chest-shake-fast" size={104} glowColor="#fff" />
      <div className="ur-whiteout-max" style={{ position: "absolute", inset: 0 }} />
      <div className="tease-dim ur-blackout" />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {Array.from({ length: 44 }, (_, i) => {
          const deg = (360 / 44) * i;
          const rad = (deg * Math.PI) / 180;
          const d = 150 + (i % 5) * 42;
          const sz = 18 + (i % 4) * 9;
          return (
            <div key={`b-${i}`} style={{
              position: "absolute", left: "50%", top: "48%",
              width: sz, height: sz, borderRadius: "50%",
              backgroundColor: burstColors[i % burstColors.length],
              boxShadow: `0 0 18px ${burstColors[i % burstColors.length]}`,
              animationName: "burstParticle", animationDuration: "0.86s",
              animationDelay: `${0.98 + i * 0.01}s`, animationFillMode: "both",
              animationTimingFunction: "cubic-bezier(0.1, 0.6, 0.3, 1)",
              "--tx": `${Math.cos(rad) * d}px`, "--ty": `${Math.sin(rad) * d}px`,
            } as CSSProperties} />
          );
        })}
        {dust.map((i) => (
          <div key={`d-${i}`} className="ur-stardust-fall" style={{
            position: "absolute", left: `${(i * 23) % 100}%`, top: -16,
            width: 4 + (i % 4), height: 4 + (i % 4), borderRadius: "50%",
            backgroundColor: burstColors[(i + 2) % burstColors.length],
            boxShadow: `0 0 8px ${burstColors[(i + 2) % burstColors.length]}`,
            animationDelay: `${1.22 + (i % 12) * 0.025}s`,
          }} />
        ))}
      </div>
      <FullFlash color={urOrange} delay={0.98} opacity={0.9} />
      <FullFlash color={urGold} delay={1.24} opacity={0.76} />
    </TeaseStage>
  );
}

export const SR_TEASE_VARIANTS: TeaseVariant[] = [
  { id: "sr-orbit", tier: "superRare", durationMs: TEASE_DURATION_MS, vibratePattern: [12, 20], Component: SrMagicCircleTease },
  { id: "sr-ripple", tier: "superRare", durationMs: TEASE_DURATION_MS, vibratePattern: [15, 25, 15], Component: SrStarRainTease },
  { id: "sr-glimmer", tier: "superRare", durationMs: TEASE_DURATION_MS, vibratePattern: [10, 18, 10], Component: SrMistTease },
];

export const UR_TEASE_VARIANTS: TeaseVariant[] = [
  { id: "ur-pillar", tier: "ultraRare", durationMs: TEASE_DURATION_MS, vibratePattern: [25, 45, 25, 45], overlayShake: true, Component: UrPillarTease },
  { id: "ur-meteor", tier: "ultraRare", durationMs: TEASE_DURATION_MS, vibratePattern: [30, 50, 30, 50], overlayShake: true, Component: UrMeteorTease },
  { id: "ur-aurora", tier: "ultraRare", durationMs: TEASE_DURATION_MS, vibratePattern: [20, 40, 20, 40], Component: UrAuroraTease },
  { id: "ur-supernova", tier: "ultraRare", durationMs: TEASE_DURATION_MS, vibratePattern: [35, 60, 35, 60], overlayShake: true, Component: UrSupernovaTease },
];

const ALL_TEASE_VARIANTS: TeaseVariant[] = [...SR_TEASE_VARIANTS, ...UR_TEASE_VARIANTS];

export function shouldPlayTease(rarity: RewardRarity, devForceTease?: boolean): rarity is TeaseTier {
  if (rarity !== "superRare" && rarity !== "ultraRare") return false;
  if (devForceTease) return true;
  if (rarity === "superRare") return Math.random() < TEASE_TRIGGER_CHANCE.superRare;
  return Math.random() < TEASE_TRIGGER_CHANCE.ultraRare;
}

export function pickTeaseVariant(tier: TeaseTier, forceId?: TeaseVariantId): TeaseVariant {
  if (forceId) {
    const found = ALL_TEASE_VARIANTS.find((v) => v.id === forceId);
    if (found && found.tier === tier) return found;
  }
  const pool = tier === "superRare" ? SR_TEASE_VARIANTS : UR_TEASE_VARIANTS;
  return pool[Math.floor(Math.random() * pool.length)];
}
