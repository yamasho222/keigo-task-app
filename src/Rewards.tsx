import { useState, type CSSProperties } from "react";
import { theme } from "./theme";
import { pickTreatReward, type RewardItem, type StickerReward } from "./stickerRewards";

export type { RewardItem, StickerReward };
export {
  REWARD_LOOKUP, STICKER_REWARDS, DAILY_EMOJI_REWARDS, ALL_REWARDS, TOTAL_REWARD_COUNT,
  pickStickerReward, pickDailyReward, pickTreatReward,
} from "./stickerRewards";

export interface NewRecordCelebration {
  emoji: string;
  title: string;
  timeSec: number;
}

function StickerImage({ reward, size = 160 }: { reward: StickerReward; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 16, overflow: "hidden",
      backgroundColor: theme.fill.secondary,
      border: `3px solid ${theme.accent.primary}44`,
      boxShadow: `0 8px 24px ${theme.accent.primary}22`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <img
        src={reward.image}
        alt={reward.label}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}

function RewardReveal({ reward, size = 160 }: { reward: RewardItem; size?: number }) {
  if (reward.kind === "emoji") {
    return (
      <div style={{
        width: size, height: size, borderRadius: 16,
        backgroundColor: `${theme.category.green}14`,
        border: `3px solid ${theme.category.green}55`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.45,
      }}>
        {reward.emoji}
      </div>
    );
  }
  return <StickerImage reward={reward} size={size} />;
}

function MegaConfetti({ count, celebKey }: { count: number; celebKey: number }) {
  const colors = [
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
          backgroundColor: colors[p.colorIdx],
          animationName: "confettiPiece",
          animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s`,
          animationFillMode: "both", animationTimingFunction: "linear",
          "--spin": `${p.spin}deg`,
        } as CSSProperties} />
      ))}
    </>
  );
}

function MegaBurst({ colors }: { colors: string[] }) {
  const angles = Array.from({ length: 24 }, (_, i) => i * 15);
  return (
    <div style={{ position: "absolute", left: "50%", top: "42%" }}>
      {angles.map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const d = 100 + (i % 4) * 35;
        const sz = 20 + (i % 4) * 10;
        return (
          <div key={i} style={{
            position: "absolute", width: sz, height: sz, borderRadius: "50%",
            backgroundColor: colors[i % 6], left: -sz / 2, top: -sz / 2,
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

function TreasureChest({ opened, size = 80 }: { opened: boolean; size?: number }) {
  return (
    <div className={opened ? "chest-open" : "chest-shake"} style={{ fontSize: size, lineHeight: 1 }}>
      {opened ? "🎊" : "🎁"}
    </div>
  );
}

function TreatOverlay({
  mode, collectedIds, onClose, onCollect,
}: {
  mode: "daily" | "weekly";
  collectedIds: string[];
  onClose: () => void;
  onCollect: (rewardId: string) => void;
}) {
  const [opened, setOpened] = useState(false);
  const [reward, setReward] = useState<RewardItem | null>(null);
  const isWeekly = mode === "weekly";

  const handleOpen = () => {
    if (opened) return;
    const picked = pickTreatReward(collectedIds, mode);
    setReward(picked);
    setOpened(true);
    onCollect(picked.id);
    navigator.vibrate?.(20);
  };

  return (
    <div
      data-modal-overlay
      style={{
        position: "fixed", inset: 0, zIndex: 65,
        backgroundColor: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div style={{
        width: "100%", maxWidth: 340, borderRadius: 24, padding: "28px 24px",
        backgroundColor: theme.bg.editor,
        boxShadow: "0 12px 48px rgba(0,0,0,0.25)",
        textAlign: "center",
      }}>
        {isWeekly && opened && <MegaConfetti count={40} celebKey={99} />}
        <div style={{
          fontSize: isWeekly ? 22 : 18, fontWeight: 900,
          color: isWeekly ? theme.category.purple : theme.category.green,
          marginBottom: 8,
        }}>
          {isWeekly ? "🎊 1週間クリア！ 🎊" : "⭐ きょうのごほうび ⭐"}
        </div>
        <div style={{ fontSize: 14, color: theme.text.secondary, marginBottom: 20 }}>
          {isWeekly
            ? "7日連続で3つ全部クリア！すごすぎ！"
            : "この時間のやること、全部クリア！"}
        </div>

        <div style={{ marginBottom: 20, minHeight: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {!opened ? (
            <button type="button" onClick={handleOpen} style={{
              background: "none", border: "none", cursor: "pointer", padding: 0,
            }}>
              <TreasureChest opened={false} size={isWeekly ? 96 : 80} />
              <div style={{ fontSize: 14, fontWeight: 700, color: theme.accent.primary, marginTop: 8 }}>
                タップして開ける！
              </div>
            </button>
          ) : reward && (
            <div className="treat-reveal" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <RewardReveal reward={reward} size={isWeekly ? 180 : 160} />
              {reward.rarity === "low" && (
                <div style={{
                  fontSize: 10, fontWeight: 800, color: theme.category.green,
                  backgroundColor: `${theme.category.green}18`, padding: "2px 8px", borderRadius: 6,
                }}>
                  ノーマル
                </div>
              )}
              {reward.rarity === "high" && !isWeekly && (
                <div style={{
                  fontSize: 10, fontWeight: 800, color: theme.category.purple,
                  backgroundColor: `${theme.category.purple}18`, padding: "2px 8px", borderRadius: 6,
                }}>
                  レア！
                </div>
              )}
              <div style={{ fontSize: 18, fontWeight: 900, color: theme.text.primary }}>{reward.label}</div>
              <div style={{ fontSize: 14, color: theme.text.secondary }}>{reward.message}</div>
              <div style={{ fontSize: 11, color: theme.text.tertiary }}>
                アルバムに追加したよ！
              </div>
            </div>
          )}
        </div>

        <button type="button" onClick={onClose} style={{
          width: "100%", padding: "14px", borderRadius: 12, border: "none",
          backgroundColor: opened ? theme.accent.primary : theme.fill.secondary,
          color: opened ? "#fff" : theme.text.tertiary,
          fontSize: 15, fontWeight: 700, cursor: "pointer",
        }}>
          {opened ? "やったー！" : "あとで"}
        </button>
      </div>
    </div>
  );
}

export function DailyTreatOverlay(props: Omit<Parameters<typeof TreatOverlay>[0], "mode">) {
  return <TreatOverlay mode="daily" {...props} />;
}

export function WeeklyRewardOverlay(props: Omit<Parameters<typeof TreatOverlay>[0], "mode">) {
  return <TreatOverlay mode="weekly" {...props} />;
}
