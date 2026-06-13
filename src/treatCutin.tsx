import type { ReactNode } from "react";
import { theme } from "./theme";
import type { RewardRarity } from "./stickerRewards";
import type { TeaseTier } from "./treatTease";

/** 偽ノーマル表示後、カットインまでの待ち時間 */
export const UPGRADE_FAKE_NORMAL_MS = 2000;
export const UPGRADE_CUTIN_MS = { superRare: 1200, ultraRare: 1500 } as const;

export const CUTIN_VIBRATE = {
  superRare: [30, 40, 30] as number[],
  ultraRare: [40, 50, 40, 50] as number[],
};

export function shouldPlayUpgradeReveal(rarity: RewardRarity): rarity is TeaseTier {
  return rarity === "superRare" || rarity === "ultraRare";
}

export function getCutinDuration(tier: TeaseTier): number {
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

function DecoyCrush({ emoji }: { emoji: string }) {
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
        fontSize: 64,
      }}>
        {emoji}
      </div>
    </div>
  );
}

function SrUpgradeCutin({ decoyEmoji }: { decoyEmoji: string }) {
  return (
    <CutinStage shake>
      <div className="cutin-tier-burst" style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(circle at 50% 50%, ${srPurple}66 0%, ${srPink}22 38%, transparent 68%)`,
      }} />
      <SpeedLines colors={[srPurple, srPink, srBlue, "#ffffff"]} count={28} />
      <DecoyCrush emoji={decoyEmoji} />
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

function UrUpgradeCutin({ decoyEmoji }: { decoyEmoji: string }) {
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
      <DecoyCrush emoji={decoyEmoji} />
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
  tier, decoyEmoji,
}: {
  tier: TeaseTier;
  decoyEmoji: string;
}) {
  if (tier === "superRare") return <SrUpgradeCutin decoyEmoji={decoyEmoji} />;
  return <UrUpgradeCutin decoyEmoji={decoyEmoji} />;
}
