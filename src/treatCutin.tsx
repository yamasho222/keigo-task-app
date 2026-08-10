import type { ReactNode } from "react";
import { theme } from "./theme";
import type { RewardRarity } from "./stickerRewards";
import { LR_RAINBOW_COLORS } from "./rarityMeta";

/** 偽ノーマル表示後、カットインまでの待ち時間 */
export const UPGRADE_FAKE_NORMAL_MS = 2000;
export const UPGRADE_FAKE_NORMAL_LR_MS = 2000;
export const UPGRADE_FAKE_NORMAL_CRUSH_MS = 1000;
export const UPGRADE_FAKE_UR_MS = 1800;
export const UPGRADE_FREEZE_MS = 400;
export const UPGRADE_CRACK_MS = 600;
export const UPGRADE_CUTIN_LR_MS = 2000;
export const UPGRADE_DIRECT_BURST_MS = 280;
export const UPGRADE_CUTIN_MS = { superRare: 1200, ultraRare: 1500 } as const;

export const CUTIN_VIBRATE = {
  superRare: [30, 40, 30] as number[],
  ultraRare: [40, 50, 40, 50] as number[],
  legendary: [40, 60, 40, 60, 50, 70, 50, 80] as number[],
  lrNormalCrush: [35, 50, 35, 50] as number[],
  lrFakeUrBurst: [40, 55, 40, 55, 35] as number[],
};

export type LrCutinStep = "freeze" | "crack" | "cutin";

export function shouldPlayUpgradeReveal(rarity: RewardRarity): rarity is "superRare" | "ultraRare" {
  return rarity === "superRare" || rarity === "ultraRare";
}

export function shouldPlayLegendaryUpgrade(rarity: RewardRarity): rarity is "legendary" {
  return rarity === "legendary";
}

export function getCutinDuration(tier: "superRare" | "ultraRare"): number {
  return UPGRADE_CUTIN_MS[tier];
}

const srPurple = theme.category.purple;
const srPink = theme.category.pink;
const srBlue = theme.category.blue;
const urGold = theme.category.yellow;
const urOrange = theme.category.orange;

function CutinStage({ children, shake = false }: { children: ReactNode; shake?: boolean }) {
  return (
    <div
      className={shake ? "phone-shake" : undefined}
      style={{
        position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 3,
      }}
    >
      {children}
    </div>
  );
}

function SpeedLines({ colors, count = 24 }: { colors: string[]; count?: number }) {
  const lines = Array.from({ length: count }, (_, i) => ({
    angle: (360 / count) * i,
    length: 38 + (i % 5) * 14,
    width: 2 + (i % 3),
    delay: (i % 8) * 0.018,
    color: colors[i % colors.length],
  }));

  return (
    <>
      {lines.map((line, i) => (
        <div
          key={i}
          className="cutin-speed-line"
          style={{
            position: "absolute", left: "50%", top: "50%",
            width: line.length, height: line.width, borderRadius: 999,
            backgroundColor: line.color,
            transformOrigin: "0 50%",
            transform: `rotate(${line.angle}deg)`,
            animationDelay: `${line.delay}s`,
            boxShadow: `0 0 8px ${line.color}`,
          }}
        />
      ))}
    </>
  );
}

function DecoyCrush({ image, imageFit = "contain", label }: {
  image: string;
  imageFit?: "contain" | "cover";
  label: string;
}) {
  return (
    <div style={{
      position: "absolute", left: "50%", top: "50%",
      transform: "translate(-50%, -50%)",
    }}>
      <div className="cutin-fake-crush" style={{
        width: 140, height: 140, borderRadius: 16,
        backgroundColor: `${theme.category.green}14`,
        border: `3px solid ${theme.category.green}55`,
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden", padding: 12, boxSizing: "border-box",
      }}>
        <img
          src={image}
          alt={label}
          style={{ width: "100%", height: "100%", objectFit: imageFit, display: "block" }}
        />
      </div>
    </div>
  );
}

function SrUpgradeCutin({ decoyImage, decoyImageFit, decoyLabel }: {
  decoyImage: string;
  decoyImageFit?: "contain" | "cover";
  decoyLabel: string;
}) {
  return (
    <CutinStage shake>
      <div className="cutin-tier-burst" style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(circle at 50% 50%, ${srPurple}66 0%, ${srPink}22 38%, transparent 68%)`,
      }} />
      <SpeedLines colors={[srPurple, srPink, srBlue, "#ffffff"]} count={28} />
      <DecoyCrush image={decoyImage} imageFit={decoyImageFit} label={decoyLabel} />
      <div className="cutin-text-slam" style={{
        position: "absolute", left: "50%", top: "34%",
        transform: "translateX(-50%)",
        fontSize: 28, fontWeight: 900, color: "#fff",
        textShadow: `0 0 24px ${srPurple}, 0 4px 16px rgba(0,0,0,0.55)`,
        letterSpacing: 1, whiteSpace: "nowrap",
      }}>
        ちょっと待って！？
      </div>
      <div className="cutin-morph-flash" style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(circle at 50% 50%, ${srPurple}CC 0%, ${srBlue}55 35%, transparent 62%)`,
        animationDelay: "0.85s",
      }} />
    </CutinStage>
  );
}

function UrUpgradeCutin({ decoyImage, decoyImageFit, decoyLabel }: {
  decoyImage: string;
  decoyImageFit?: "contain" | "cover";
  decoyLabel: string;
}) {
  const rings = [0, 0.12];
  return (
    <CutinStage shake>
      <div className="cutin-freeze-dim" />
      <div className="cutin-tier-burst" style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(circle at 50% 50%, ${urOrange}55 0%, ${urGold}22 42%, transparent 70%)`,
      }} />
      {rings.map((delay, i) => (
        <div key={i} className="cutin-shock-ring" style={{
          position: "absolute", left: "50%", top: "50%",
          width: 80, height: 80, marginLeft: -40, marginTop: -40,
          borderRadius: "50%",
          border: `3px solid ${i === 0 ? urGold : urOrange}`,
          animationDelay: `${delay}s`,
        }} />
      ))}
      <SpeedLines colors={[urGold, urOrange, "#ffffff", urGold]} count={32} />
      <DecoyCrush image={decoyImage} imageFit={decoyImageFit} label={decoyLabel} />
      <div className="cutin-text-slam-ur" style={{
        position: "absolute", left: "50%", top: "32%",
        transform: "translateX(-50%)",
        fontSize: 34, fontWeight: 900, color: "#fff",
        textShadow: `0 0 32px ${urOrange}, 0 0 48px ${urGold}, 0 4px 20px rgba(0,0,0,0.6)`,
        letterSpacing: 2, whiteSpace: "nowrap",
      }}>
        えっ！？
      </div>
      <div className="cutin-morph-flash-ur" style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.95) 0%, rgba(255,200,80,0.55) 30%, transparent 58%)",
        animationDelay: "1.05s",
      }} />
    </CutinStage>
  );
}

export function UpgradeCutinScene({
  tier, decoyImage, decoyImageFit, decoyLabel,
}: {
  tier: "superRare" | "ultraRare";
  decoyImage: string;
  decoyImageFit?: "contain" | "cover";
  decoyLabel: string;
}) {
  if (tier === "superRare") {
    return <SrUpgradeCutin decoyImage={decoyImage} decoyImageFit={decoyImageFit} decoyLabel={decoyLabel} />;
  }
  return <UrUpgradeCutin decoyImage={decoyImage} decoyImageFit={decoyImageFit} decoyLabel={decoyLabel} />;
}

/** LR二段演出: 偽ノーマル → 偽UR の遷移ブリッジ（テキストなし） */
export function LrNormalToUrBridge({
  decoyImage, decoyImageFit, decoyLabel,
}: {
  decoyImage: string;
  decoyImageFit?: "contain" | "cover";
  decoyLabel: string;
}) {
  const urGold = theme.category.yellow;
  const urOrange = theme.category.orange;
  return (
    <CutinStage shake>
      <div className="cutin-freeze-dim" />
      <div className="lr-normal-ur-surge" style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(circle at 50% 50%, ${urOrange}66 0%, ${urGold}33 38%, transparent 72%)`,
      }} />
      <SpeedLines colors={[urGold, urOrange, "#ffffff", urGold]} count={36} />
      <DecoyCrush image={decoyImage} imageFit={decoyImageFit} label={decoyLabel} />
      {[0, 0.14, 0.28].map((delay, i) => (
        <div key={i} className="cutin-shock-ring" style={{
          position: "absolute", left: "50%", top: "50%",
          width: 70 + i * 24, height: 70 + i * 24,
          marginLeft: -(35 + i * 12), marginTop: -(35 + i * 12),
          borderRadius: "50%",
          border: `3px solid ${i % 2 ? urGold : urOrange}`,
          animationDelay: `${delay}s`,
        }} />
      ))}
      <div className="cutin-morph-flash-ur" style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.92) 0%, ${urGold}88 28%, ${urOrange}44 48%, transparent 68%)`,
        animationDelay: "0.62s",
      }} />
      <div className="lr-ur-impact-white" />
    </CutinStage>
  );
}

function LrFreezeOverlay() {
  return (
    <CutinStage>
      <div className="cutin-freeze-hold" />
    </CutinStage>
  );
}

function LrCrackOverlay() {
  const lrColors = LR_RAINBOW_COLORS;
  return (
    <CutinStage shake>
      <div className="cutin-freeze-hold" style={{ opacity: 0.35 }} />
      <div style={{
        position: "absolute", left: "50%", top: "50%",
        transform: "translate(-50%, -50%)",
      }}>
        <div className="lr-crack-shatter" style={{
          width: 190, height: 190, borderRadius: 20,
          border: `4px solid ${theme.category.orange}`,
          boxShadow: `0 0 32px ${theme.category.orange}, inset 0 0 24px ${theme.category.yellow}44`,
          overflow: "hidden", position: "relative",
        }}>
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} style={{
              position: "absolute",
              left: `${(i * 31) % 80 + 10}%`, top: `${(i * 23) % 80 + 10}%`,
              width: 2, height: `${30 + (i % 4) * 15}%`,
              backgroundColor: lrColors[i % lrColors.length],
              transform: `rotate(${(i * 30) % 180}deg)`,
              opacity: 0.9,
            }} />
          ))}
        </div>
      </div>
    </CutinStage>
  );
}

function LrUpgradeCutin() {
  const lrColors = LR_RAINBOW_COLORS;
  return (
    <CutinStage shake>
      <div className="cutin-freeze-dim" />
      <div className="cutin-tier-burst" style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(circle at 50% 50%, ${lrColors[0]}55 0%, ${lrColors[3]}22 42%, transparent 70%)`,
      }} />
      <SpeedLines colors={lrColors} count={48} />
      <div className="lr-morph-rainbow" style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.95) 0%, ${lrColors[1]}88 25%, ${lrColors[4]}55 45%, transparent 62%)`,
      }} />
    </CutinStage>
  );
}

export function LrCutinScene({ step }: { step: LrCutinStep }) {
  if (step === "freeze") return <LrFreezeOverlay />;
  if (step === "crack") return <LrCrackOverlay />;
  return <LrUpgradeCutin />;
}
