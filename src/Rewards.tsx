import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { theme } from "./theme";
import { pickTreatReward, pickStickerByTier, pickDecoyNormalReward, getStickerById, RARITY_LABELS, type EmojiReward, type RewardItem, type RewardRarity, type StickerRarity, type StickerReward, type TreatMode } from "./stickerRewards";
import {
  pickTeaseVariant, shouldPlayTease,
  type TeaseVariant, type TeaseVariantId,
} from "./treatTease";
import {
  CUTIN_VIBRATE, getCutinDuration, shouldPlayUpgradeReveal, UpgradeCutinScene,
  UPGRADE_FAKE_NORMAL_MS,
} from "./treatCutin";
export type { RewardItem, StickerReward, TreatMode, RewardRarity };
export {
  REWARD_LOOKUP, STICKER_REWARDS, DAILY_EMOJI_REWARDS, ALL_REWARDS, TOTAL_REWARD_COUNT, RARITY_LABELS,
  pickStickerReward, pickDailyReward, pickWeeklyReward, pickTreatReward, pickStickerByTier,
} from "./stickerRewards";

export function getRarityBadgeStyle(rarity: RewardRarity): { color: string; backgroundColor: string; label: string } {
  switch (rarity) {
    case "normal":
      return { color: theme.category.green, backgroundColor: `${theme.category.green}18`, label: RARITY_LABELS.normal };
    case "rare":
      return { color: theme.category.blue, backgroundColor: `${theme.category.blue}18`, label: RARITY_LABELS.rare };
    case "superRare":
      return { color: theme.category.purple, backgroundColor: `${theme.category.purple}18`, label: RARITY_LABELS.superRare };
    case "ultraRare":
      return { color: theme.category.orange, backgroundColor: `${theme.category.orange}18`, label: RARITY_LABELS.ultraRare };
  }
}

export interface RarityRevealConfig {
  confettiCount: number;
  burstCount: number;
  flashColor: string | null;
  flashClass: string | null;
  revealClass: string;
  chestClass: string;
  revealSize: number;
  vibratePattern: number | number[];
  showFullScreenFx: boolean;
  borderGlow: string;
  badgeClass: string;
  labelClass: string;
  glowPulse: boolean;
  overlayShake: boolean;
  sparkleCount: number;
  celebKey: number;
  confettiColors: string[];
}

export function getRarityRevealConfig(rarity: RewardRarity): RarityRevealConfig {
  const badge = getRarityBadgeStyle(rarity);
  switch (rarity) {
    case "normal":
      return {
        confettiCount: 0,
        burstCount: 0,
        flashColor: null,
        flashClass: null,
        revealClass: "treat-reveal",
        chestClass: "chest-open",
        revealSize: 160,
        vibratePattern: 20,
        showFullScreenFx: false,
        borderGlow: badge.color,
        badgeClass: "",
        labelClass: "",
        glowPulse: false,
        overlayShake: false,
        sparkleCount: 0,
        celebKey: 1,
        confettiColors: [],
      };
    case "rare":
      return {
        confettiCount: 16,
        burstCount: 0,
        flashColor: null,
        flashClass: null,
        revealClass: "treat-reveal-rare",
        chestClass: "chest-open",
        revealSize: 165,
        vibratePattern: [15, 30, 15],
        showFullScreenFx: false,
        borderGlow: badge.color,
        badgeClass: "record-badge-pop",
        labelClass: "",
        glowPulse: false,
        overlayShake: false,
        sparkleCount: 0,
        celebKey: 2,
        confettiColors: [theme.category.blue, theme.category.green, theme.category.purple],
      };
    case "superRare":
      return {
        confettiCount: 40,
        burstCount: 16,
        flashColor: theme.category.purple,
        flashClass: "record-flash",
        revealClass: "treat-reveal-sr",
        chestClass: "chest-open",
        revealSize: 175,
        vibratePattern: [20, 40, 20, 40],
        showFullScreenFx: true,
        borderGlow: badge.color,
        badgeClass: "rarity-badge-pop-delay",
        labelClass: "",
        glowPulse: true,
        overlayShake: true,
        sparkleCount: 0,
        celebKey: 3,
        confettiColors: [theme.category.purple, theme.category.pink, theme.category.blue, theme.category.yellow],
      };
    case "ultraRare":
      return {
        confettiCount: 70,
        burstCount: 24,
        flashColor: theme.category.orange,
        flashClass: "record-flash",
        revealClass: "treat-reveal-ur",
        chestClass: "chest-open-ur",
        revealSize: 190,
        vibratePattern: [30, 50, 30, 50, 30],
        showFullScreenFx: true,
        borderGlow: badge.color,
        badgeClass: "rarity-badge-pop-delay",
        labelClass: "ur-shimmer",
        glowPulse: true,
        overlayShake: true,
        sparkleCount: 10,
        celebKey: 4,
        confettiColors: [
          theme.category.orange, theme.category.yellow, theme.category.pink,
          theme.category.purple, theme.category.blue,
        ],
      };
  }
}

function vibrateTreat(pattern: number | number[]) {
  navigator.vibrate?.(pattern);
}

export function RarityBadge({ rarity, className = "" }: { rarity: RewardRarity; className?: string }) {
  const badge = getRarityBadgeStyle(rarity);
  return (
    <div className={className} style={{
      fontSize: 10, fontWeight: 800, color: badge.color,
      backgroundColor: badge.backgroundColor, padding: "2px 8px", borderRadius: 6,
    }}>
      {badge.label}
    </div>
  );
}

const COMPACT_RARITY_LABELS: Record<RewardRarity, string> = {
  normal: "N",
  rare: "レア",
  superRare: "SR",
  ultraRare: "UR",
};

export function RarityBadgeCorner({
  rarity, compact = false,
}: {
  rarity: RewardRarity;
  compact?: boolean;
}) {
  const badge = getRarityBadgeStyle(rarity);
  return (
    <div style={{
      position: "absolute", top: compact ? 3 : 8, left: compact ? 3 : 8,
      zIndex: 2, fontSize: compact ? 7 : 10, fontWeight: 800,
      color: badge.color, backgroundColor: badge.backgroundColor,
      padding: compact ? "1px 4px" : "2px 8px", borderRadius: compact ? 4 : 6,
      boxShadow: "0 1px 6px rgba(0,0,0,0.28)",
      lineHeight: 1.2, pointerEvents: "none",
    }}>
      {compact ? COMPACT_RARITY_LABELS[rarity] : badge.label}
    </div>
  );
}

export function StickerFrameWithBadge({
  rarity, compact = false, children, style,
}: {
  rarity: RewardRarity;
  compact?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div style={{ position: "relative", ...style }}>
      {children}
      <RarityBadgeCorner rarity={rarity} compact={compact} />
    </div>
  );
}

export interface NewRecordCelebration {
  emoji: string;
  title: string;
  timeSec: number;
}

export function StickerImg({
  src, alt, padding = "10%", style,
}: {
  src: string; alt: string; padding?: number | string; style?: CSSProperties;
}) {
  return (
    <div style={{
      width: "100%", height: "100%",
      padding, boxSizing: "border-box",
      display: "flex", alignItems: "center", justifyContent: "center",
      ...style,
    }}>
      <img
        src={src}
        alt={alt}
        style={{
          maxWidth: "100%", maxHeight: "100%",
          width: "auto", height: "auto",
          objectFit: "contain", objectPosition: "center",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

function StickerImage({ reward, size = 160, borderGlow, glowPulse = false }: {
  reward: StickerReward; size?: number; borderGlow: string; glowPulse?: boolean;
}) {
  return (
    <div
      className={glowPulse ? "rarity-glow-pulse" : undefined}
      style={{
        width: size, height: size, borderRadius: 16, overflow: "hidden",
        backgroundColor: theme.fill.secondary,
        border: `3px solid ${borderGlow}88`,
        boxShadow: `0 8px 32px ${borderGlow}55`,
        display: "flex", alignItems: "center", justifyContent: "center",
        "--glow-color": `${borderGlow}88`,
      } as CSSProperties}
    >
      <StickerImg src={reward.image} alt={reward.label} padding={12} />
    </div>
  );
}

function RewardReveal({ reward, size = 160, borderGlow, glowPulse = false }: {
  reward: RewardItem; size?: number; borderGlow: string; glowPulse?: boolean;
}) {
  if (reward.kind === "emoji") {
    return (
      <div style={{
        width: size, height: size, borderRadius: 16,
        backgroundColor: `${borderGlow}14`,
        border: `3px solid ${borderGlow}55`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.45,
      }}>
        {reward.emoji}
      </div>
    );
  }
  return <StickerImage reward={reward} size={size} borderGlow={borderGlow} glowPulse={glowPulse} />;
}

function SparkleRing({ color, count = 10 }: { color: string; count?: number }) {
  const particles = Array.from({ length: count }, (_, i) => {
    const angle = (360 / count) * i;
    const rad = (angle * Math.PI) / 180;
    const dist = 85 + (i % 3) * 22;
    return {
      sx: Math.cos(rad) * dist,
      sy: Math.sin(rad) * dist,
      size: 8 + (i % 4) * 5,
      delay: i * 0.05,
    };
  });

  return (
    <div style={{ position: "absolute", left: "50%", top: "50%", pointerEvents: "none" }}>
      {particles.map((p, i) => (
        <div key={i} className="sparkle-in" style={{
          position: "absolute", width: p.size, height: p.size, borderRadius: "50%",
          backgroundColor: color, animationDelay: `${p.delay}s`,
          "--sx": `${p.sx}px`, "--sy": `${p.sy}px`,
        } as CSSProperties} />
      ))}
    </div>
  );
}

function MegaConfetti({ count, celebKey, colors }: { count: number; celebKey: number; colors?: string[] }) {
  const palette = colors ?? [
    theme.category.purple, theme.category.blue, theme.category.green,
    theme.category.yellow, theme.category.orange, theme.category.pink,
  ];
  const pieces = Array.from({ length: count }, (_, i) => {
    const s = i * 17 + celebKey * 11;
    return {
      x: (s * 31) % Math.max(typeof window !== "undefined" ? window.innerWidth - 20 : 300, 200) + 10,
      delay: (i * 0.04) % 0.8,
      colorIdx: (i + celebKey) % 6,
      size: (s % 10) + 8,
      isCircle: s % 3 !== 1,
      spin: ((s % 7) + 3) * 180,
      dur: 1.8 + (s % 6) * 0.12,
    };
  });

  return (
    <>
      {pieces.map((p, i) => (
        <div key={i} style={{
          position: "absolute", left: p.x, top: -20,
          width: p.size, height: p.isCircle ? p.size : p.size * 0.55,
          borderRadius: p.isCircle ? "50%" : 3,
          backgroundColor: palette[p.colorIdx],
          animationName: "confettiPiece",
          animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s`,
          animationFillMode: "both", animationTimingFunction: "linear",
          "--spin": `${p.spin}deg`,
        } as CSSProperties} />
      ))}
    </>
  );
}

function MegaBurst({ colors, count = 24 }: { colors: string[]; count?: number }) {
  const angles = Array.from({ length: count }, (_, i) => (360 / count) * i);
  return (
    <div style={{ position: "absolute", left: "50%", top: "42%" }}>
      {angles.map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const d = 100 + (i % 4) * 35;
        const sz = 20 + (i % 4) * 10;
        return (
          <div key={i} style={{
            position: "absolute", width: sz, height: sz, borderRadius: "50%",
            backgroundColor: colors[i % colors.length], left: -sz / 2, top: -sz / 2,
            animationName: "burstParticle", animationDuration: "1.3s",
            animationDelay: `${i * 0.025}s`, animationFillMode: "both",
            animationTimingFunction: "cubic-bezier(0.1, 0.6, 0.3, 1)",
            "--tx": `${Math.cos(rad) * d}px`, "--ty": `${Math.sin(rad) * d}px`,
          } as CSSProperties} />
        );
      })}
    </div>
  );
}

export function NewRecordOverlay({
  data, celebKey, onDone,
}: {
  data: NewRecordCelebration;
  celebKey: number;
  onDone: () => void;
}) {
  const colors = [
    theme.category.orange, theme.category.yellow, theme.category.pink,
    theme.category.purple, theme.category.green, theme.category.blue,
  ];

  return (
    <div
      data-modal-overlay
      onClick={onDone}
      style={{
        position: "fixed", inset: 0, zIndex: 55, pointerEvents: "auto",
        overflow: "hidden", cursor: "pointer",
      }}
    >
      <div className="record-flash" style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(circle at 50% 40%, ${theme.category.orange}55 0%, transparent 65%)`,
        pointerEvents: "none",
      }} />
      <MegaConfetti count={70} celebKey={celebKey} />
      <MegaBurst colors={colors} />
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 12, pointerEvents: "none",
      }}>
        <div className="record-text-pop" style={{ fontSize: 56 }}>🏆</div>
        <div className="record-text-pop" style={{
          fontSize: 32, fontWeight: 900, color: theme.category.orange,
          textShadow: `0 0 24px ${theme.category.orange}88`,
          letterSpacing: 2,
        }}>
          新記録！
        </div>
        <div className="record-text-pop-delay" style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 20px", borderRadius: 16,
          backgroundColor: theme.bg.editor,
          border: `2px solid ${theme.category.orange}`,
          boxShadow: `0 8px 32px ${theme.category.orange}44`,
        }}>
          <span style={{ fontSize: 28 }}>{data.emoji}</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: theme.text.primary }}>{data.title}</div>
            <div style={{
              fontSize: 24, fontWeight: 900, color: theme.category.orange,
              fontVariantNumeric: "tabular-nums",
            }}>
              {Math.floor(data.timeSec / 60)}:{String(data.timeSec % 60).padStart(2, "0")}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: theme.text.tertiary, marginTop: 8 }}>
          タップしてとじる
        </div>
      </div>
    </div>
  );
}

function TreasureChest({ opened, size = 80, chestClass = "chest-open", variant = "default" }: {
  opened: boolean; size?: number; chestClass?: string; variant?: "default" | "premium" | "mission";
}) {
  const isPremium = variant === "premium";
  const isMission = variant === "mission";
  const isFancy = isPremium || isMission;
  const closedClass = isFancy ? "chest-shake-premium" : "chest-shake";

  const chest = (
    <div
      className={opened ? chestClass : closedClass}
      style={{
        fontSize: size,
        lineHeight: 1,
        filter: isPremium && !opened
          ? `drop-shadow(0 0 10px ${theme.category.yellow}) drop-shadow(0 0 22px ${theme.category.orange}99)`
          : isMission && !opened
            ? `drop-shadow(0 0 10px ${theme.category.purple}) drop-shadow(0 0 22px ${theme.category.pink}99)`
            : undefined,
      }}
    >
      {opened ? "🎊" : "🎁"}
    </div>
  );

  if (isFancy && !opened) {
    return (
      <div className={isMission ? "chest-glow-pulse-mission" : "chest-glow-pulse"} style={{ position: "relative", display: "inline-block" }}>
        <div style={{
          position: "absolute", inset: -12, pointerEvents: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="chest-sparkle-orbit"
              style={{
                position: "absolute",
                fontSize: 17,
                "--orbit-r": "54px",
                "--orbit-dur": `${2.2 + i * 0.35}s`,
                animationDelay: `${i * 0.55}s`,
              } as CSSProperties}
            >
              ✨
            </span>
          ))}
        </div>
        {chest}
      </div>
    );
  }

  return chest;
}

function TreatFxLayer({ config }: { config: RarityRevealConfig }) {
  if (config.confettiCount === 0 && config.burstCount === 0 && !config.flashColor) return null;

  const burstColors = config.confettiColors.length > 0
    ? config.confettiColors
    : [theme.category.purple, theme.category.orange, theme.category.yellow, theme.category.pink];

  return (
    <div style={{
      position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden",
      zIndex: config.showFullScreenFx ? 0 : 1,
    }}>
      {config.flashColor && (
        <>
          <div className={config.flashClass ?? "record-flash"} style={{
            position: "absolute", inset: 0,
            background: `radial-gradient(circle at 50% 40%, ${config.flashColor}55 0%, transparent 65%)`,
          }} />
          {config.sparkleCount > 0 && (
            <div className="record-flash" style={{
              position: "absolute", inset: 0,
              background: `radial-gradient(circle at 50% 55%, ${config.flashColor}33 0%, transparent 70%)`,
              animationDelay: "0.15s",
            }} />
          )}
        </>
      )}
      {config.confettiCount > 0 && (
        <MegaConfetti count={config.confettiCount} celebKey={config.celebKey} colors={config.confettiColors} />
      )}
      {config.burstCount > 0 && <MegaBurst colors={burstColors} count={config.burstCount} />}
    </div>
  );
}

function TreatOverlay({
  mode, collectedIds, onClose, onCollect, devForceTier, devForceStickerId, devForceTease, devForceTeaseId,
  missionTitle,
}: {
  mode: TreatMode;
  collectedIds: string[];
  onClose: () => void;
  onCollect: (rewardId: string) => void;
  devForceTier?: StickerRarity;
  devForceStickerId?: string;
  devForceTease?: boolean;
  devForceTeaseId?: TeaseVariantId;
  missionTitle?: string;
}) {
  type TreatPhase = "closed" | "teasing" | "upgrading" | "revealed";
  type UpgradeStep = "fakeNormal" | "cutin";

  const [phase, setPhase] = useState<TreatPhase>("closed");
  const [upgradeStep, setUpgradeStep] = useState<UpgradeStep | null>(null);
  const [reward, setReward] = useState<RewardItem | null>(null);
  const [decoy, setDecoy] = useState<EmojiReward | null>(null);
  const [activeTease, setActiveTease] = useState<TeaseVariant | null>(null);
  const teaseTimerRef = useRef<number | null>(null);
  const upgradeTimerRef = useRef<number | null>(null);
  const isWeekly = mode === "weekly";
  const isFullDayBonus = mode === "fullDayBonus";
  const isSpecialMission = mode === "specialMission";
  const isOneOffSpecial = mode === "oneOffSpecial";
  const isMissionStyle = isSpecialMission || isOneOffSpecial;

  const clearTimers = () => {
    if (teaseTimerRef.current !== null) {
      window.clearTimeout(teaseTimerRef.current);
      teaseTimerRef.current = null;
    }
    if (upgradeTimerRef.current !== null) {
      window.clearTimeout(upgradeTimerRef.current);
      upgradeTimerRef.current = null;
    }
  };

  useEffect(() => () => clearTimers(), []);

  const finishReveal = (picked: RewardItem) => {
    setPhase("revealed");
    setUpgradeStep(null);
    setDecoy(null);
    setActiveTease(null);
    if (!devForceStickerId || import.meta.env.DEV) onCollect(picked.id);
    window.setTimeout(() => {
      vibrateTreat(getRarityRevealConfig(picked.rarity).vibratePattern);
    }, 200);
  };

  const startUpgradeReveal = (picked: RewardItem) => {
    setReward(picked);
    setDecoy(pickDecoyNormalReward());
    setUpgradeStep("fakeNormal");
    setPhase("upgrading");
    upgradeTimerRef.current = window.setTimeout(() => {
      setUpgradeStep("cutin");
      if (shouldPlayUpgradeReveal(picked.rarity)) {
        vibrateTreat(CUTIN_VIBRATE[picked.rarity]);
      }
      upgradeTimerRef.current = window.setTimeout(() => {
        finishReveal(picked);
      }, getCutinDuration(picked.rarity as "superRare" | "ultraRare"));
    }, UPGRADE_FAKE_NORMAL_MS);
  };

  const finishTease = (picked: RewardItem) => {
    setActiveTease(null);
    finishReveal(picked);
  };

  const handleOpen = () => {
    if (phase !== "closed") return;
    const forced = devForceStickerId ? getStickerById(devForceStickerId) : undefined;
    const picked = forced
      ?? (devForceTier
        ? pickStickerByTier(collectedIds, devForceTier)
        : pickTreatReward(collectedIds, mode));
    if (!picked) return;

    // DEV: 開封前teaseの単体プレビュー（本番SR/URフローとは別）
    if (devForceTease && shouldPlayTease(picked.rarity, true)) {
      const tease = pickTeaseVariant(picked.rarity, devForceTeaseId);
      setReward(picked);
      setActiveTease(tease);
      setPhase("teasing");
      vibrateTreat(tease.vibratePattern);
      teaseTimerRef.current = window.setTimeout(() => finishTease(picked), tease.durationMs);
      return;
    }

    if (!isMissionStyle && shouldPlayUpgradeReveal(picked.rarity)) {
      startUpgradeReveal(picked);
      return;
    }

    setReward(picked);
    finishReveal(picked);
  };

  const fxConfig = phase === "revealed" && reward ? getRarityRevealConfig(reward.rarity) : null;
  const isImmersive = phase === "teasing" || phase === "upgrading";
  const isBusy = isImmersive;
  const normalBadge = getRarityBadgeStyle("normal");
  const title = isWeekly
    ? "🎊 1週間クリア！ 🎊"
    : isFullDayBonus
      ? "🌟 1日全部クリア！ 🌟"
      : isOneOffSpecial
        ? "🎯 単発特別ミッション クリア！ 🎯"
        : isSpecialMission
          ? "⭐ 特別ミッション クリア！ ⭐"
          : "⭐ きょうのごほうび ⭐";

  const subtitle = isWeekly
    ? "7日連続ですべてクリア！スーパーレア以上！"
    : isFullDayBonus
      ? "ボーナスごほうび！レア以上！"
      : isOneOffSpecial
        ? missionTitle ? `${missionTitle} — クリア！` : "ミッション達成！レア以上のシール！"
        : isSpecialMission
          ? missionTitle ? `${missionTitle} — クリア！` : "ミッション達成！レア以上のシール！"
          : "この時間のやること、全部クリア！";

  const titleColor = isWeekly
    ? theme.category.purple
    : isFullDayBonus
      ? theme.category.orange
      : isMissionStyle
        ? theme.category.purple
        : theme.category.green;

  return (
    <div
      data-modal-overlay
      className={phase === "revealed" && fxConfig?.overlayShake ? "phone-shake" : undefined}
      style={{
        position: "fixed", inset: 0, zIndex: 65,
        backgroundColor: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, overflow: "hidden",
      }}
    >
      {phase === "teasing" && activeTease && (() => {
        const TeaseScene = activeTease.Component;
        return <TeaseScene key={activeTease.id} />;
      })()}
      {phase === "upgrading" && upgradeStep === "cutin" && reward && shouldPlayUpgradeReveal(reward.rarity) && decoy && (
        <UpgradeCutinScene
          key={`cutin-${reward.id}`}
          tier={reward.rarity}
          decoyEmoji={decoy.emoji}
        />
      )}
      {phase === "revealed" && fxConfig && <TreatFxLayer config={fxConfig} />}
      <div style={{
        position: "relative", zIndex: 2,
        width: "100%", maxWidth: 340, borderRadius: 24, padding: "28px 24px",
        backgroundColor: isImmersive ? "transparent" : theme.bg.editor,
        boxShadow: isImmersive ? "none" : "0 12px 48px rgba(0,0,0,0.25)",
        textAlign: "center",
      }}>
        <div style={{
          fontSize: isWeekly ? 22 : isFullDayBonus || isMissionStyle ? 20 : 18, fontWeight: 900,
          color: isImmersive ? "#fff" : titleColor,
          marginBottom: 8,
          textShadow: isImmersive ? "0 2px 12px rgba(0,0,0,0.65)" : undefined,
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 14,
          color: isImmersive ? "rgba(255,255,255,0.85)" : theme.text.secondary,
          marginBottom: isImmersive ? 12 : 20,
          textShadow: isImmersive ? "0 1px 8px rgba(0,0,0,0.55)" : undefined,
        }}>
          {subtitle}
        </div>

        <div style={{
          marginBottom: isImmersive ? 12 : 20,
          minHeight: isImmersive ? 0 : 180,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {phase === "closed" && (
            <button type="button" onClick={handleOpen} style={{
              background: "none", border: "none", cursor: "pointer", padding: 0,
            }}>
              <TreasureChest
                opened={false}
                size={isFullDayBonus ? 96 : isMissionStyle ? 88 : 80}
                variant={isFullDayBonus ? "premium" : isMissionStyle ? "mission" : "default"}
              />
              <div style={{
                fontSize: 14, fontWeight: 700, marginTop: 8,
                color: isFullDayBonus
                  ? theme.category.orange
                  : isMissionStyle
                    ? theme.category.purple
                    : theme.accent.primary,
              }}>
                {isFullDayBonus
                  ? "特別な宝箱を開ける！"
                  : isMissionStyle
                    ? "ミッション宝箱を開ける！"
                    : "タップして開ける！"}
              </div>
            </button>
          )}
          {phase === "upgrading" && upgradeStep === "fakeNormal" && decoy && (
            <div className="treat-reveal" style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
            }}>
              <RewardReveal
                reward={decoy}
                size={160}
                borderGlow={normalBadge.color}
              />
              <RarityBadge rarity="normal" />
              <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
                {decoy.label}
              </div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", textShadow: "0 1px 6px rgba(0,0,0,0.45)" }}>
                {decoy.message}
              </div>
            </div>
          )}
          {phase === "revealed" && reward && fxConfig && (            <div className={fxConfig.revealClass} style={{
              position: "relative",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
            }}>
              {fxConfig.sparkleCount > 0 && (
                <SparkleRing color={fxConfig.borderGlow} count={fxConfig.sparkleCount} />
              )}
              <RewardReveal
                reward={reward}
                size={fxConfig.revealSize}
                borderGlow={fxConfig.borderGlow}
                glowPulse={fxConfig.glowPulse}
              />
              <RarityBadge rarity={reward.rarity} className={fxConfig.badgeClass} />
              <div
                className={fxConfig.labelClass || undefined}
                style={{
                  fontSize: 18, fontWeight: 900, color: theme.text.primary,
                  "--shimmer-color": `${fxConfig.borderGlow}CC`,
                } as CSSProperties}
              >
                {reward.label}
              </div>
              <div style={{ fontSize: 14, color: theme.text.secondary }}>{reward.message}</div>
              <div style={{ fontSize: 11, color: theme.text.tertiary }}>
                アルバムに追加したよ！
              </div>
            </div>
          )}
        </div>

        <button type="button" onClick={onClose} disabled={isBusy} style={{
          width: "100%", padding: "14px", borderRadius: 12,
          border: isImmersive ? "1px solid rgba(255,255,255,0.28)" : "none",
          marginTop: isImmersive ? 176 : 0,
          backgroundColor: phase === "revealed"
            ? theme.accent.primary
            : isImmersive
              ? "rgba(0,0,0,0.38)"
              : theme.fill.secondary,
          color: phase === "revealed" ? "#fff" : isImmersive ? "#fff" : theme.text.tertiary,
          fontSize: 15, fontWeight: 700, cursor: isBusy ? "not-allowed" : "pointer",
          opacity: isBusy ? 0.75 : 1,
          boxShadow: isImmersive ? "0 4px 16px rgba(0,0,0,0.35)" : undefined,
        }}>
          {phase === "revealed" ? "やったー！" : isBusy ? "開けてる…" : "あとで"}
        </button>      </div>
    </div>
  );
}

export function DailyTreatOverlay(props: Omit<Parameters<typeof TreatOverlay>[0], "mode">) {
  return <TreatOverlay mode="daily" {...props} />;
}

export function WeeklyRewardOverlay(props: Omit<Parameters<typeof TreatOverlay>[0], "mode">) {
  return <TreatOverlay mode="weekly" {...props} />;
}

export function FullDayBonusTreatOverlay(props: Omit<Parameters<typeof TreatOverlay>[0], "mode">) {
  return <TreatOverlay mode="fullDayBonus" {...props} />;
}

export { TreatOverlay };
