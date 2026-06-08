import { useState, useMemo, type CSSProperties } from "react";
import { theme } from "./theme";

export interface NewRecordCelebration {
  emoji: string;
  title: string;
  timeSec: number;
}

interface RewardItem {
  id: string;
  emoji: string;
  label: string;
  message: string;
}

const DAILY_REWARDS: RewardItem[] = [
  { id: "star", emoji: "⭐", label: "スター", message: "きょうも星みたいにかがやいた！" },
  { id: "cat", emoji: "🐱", label: "ねこ", message: "にゃー！ごほうびゲット！" },
  { id: "dog", emoji: "🐶", label: "いぬ", message: "わん！よくがんばったね！" },
  { id: "cake", emoji: "🎂", label: "ケーキ", message: "おいしそうなケーキのごほうび！" },
  { id: "gift", emoji: "🎁", label: "プレゼント", message: "サプライズプレゼント！" },
  { id: "party", emoji: "🎉", label: "パーティー", message: "パーティーじかん！" },
  { id: "rainbow", emoji: "🌈", label: "にじ", message: "にじ色のごほうび！" },
  { id: "fire", emoji: "🔥", label: "ファイヤー", message: "メラメラパワー全開！" },
];

const WEEKLY_REWARDS: RewardItem[] = [
  { id: "crown", emoji: "👑", label: "王さま", message: "1しゅうかんの王さま！" },
  { id: "trophy", emoji: "🏆", label: "トロフィー", message: "チャンピオンのトロフィー！" },
  { id: "medal", emoji: "🥇", label: "金メダル", message: "金メダルゲット！" },
  { id: "dragon", emoji: "🐉", label: "ドラゴン", message: "ドラゴンが味方になった！" },
  { id: "unicorn", emoji: "🦄", label: "ユニコーン", message: "ユニコーンが空を飛んだ！" },
  { id: "rocket", emoji: "🚀", label: "ロケット", message: "ロケットで宇宙へ！" },
  { id: "gem", emoji: "💎", label: "ダイヤ", message: "超レア！ダイヤモンド！" },
  { id: "hero", emoji: "🦸", label: "ヒーロー", message: "ヒーローになった！" },
  { id: "panda", emoji: "🐼", label: "パンダ", message: "パンダがお祝いしてくれた！" },
  { id: "dino", emoji: "🦕", label: "きょうりゅう", message: "きょうりゅうもびっくり！" },
];

export const REWARD_LOOKUP: Record<string, { emoji: string; label: string }> = Object.fromEntries(
  [...DAILY_REWARDS, ...WEEKLY_REWARDS].map((r) => [r.id, { emoji: r.emoji, label: r.label }]),
);

function pickReward(pool: RewardItem[], exclude: Set<string>): RewardItem {
  const available = pool.filter((r) => !exclude.has(r.id));
  const list = available.length > 0 ? available : pool;
  return list[Math.floor(Math.random() * list.length)];
}

function MegaConfetti({ count, celebKey }: { count: number; celebKey: number }) {
  const colors = [
    theme.category.purple, theme.category.blue, theme.category.green,
    theme.category.yellow, theme.category.orange, theme.category.pink,
  ];
  const pieces = useMemo(() => [...Array(count)].map((_, i) => {
    const s = i * 17 + celebKey * 11;
    return {
      x: (s * 31) % Math.max(window.innerWidth - 20, 200) + 10,
      delay: (i * 0.04) % 0.8,
      colorIdx: (i + celebKey) % 6,
      size: (s % 10) + 8,
      isCircle: s % 3 !== 1,
      spin: ((s % 7) + 3) * 180,
      dur: 1.8 + (s % 6) * 0.12,
    };
  }), [count, celebKey]);

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
  const angles = [...Array(24)].map((_, i) => i * 15);
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
  mode, onClose, onCollect,
}: {
  mode: "daily" | "weekly";
  onClose: () => void;
  onCollect: (rewardId: string) => void;
}) {
  const [opened, setOpened] = useState(false);
  const [reward, setReward] = useState<RewardItem | null>(null);
  const pool = mode === "weekly" ? WEEKLY_REWARDS : DAILY_REWARDS;
  const isWeekly = mode === "weekly";

  const handleOpen = () => {
    if (opened) return;
    const picked = pickReward(pool, new Set());
    setReward(picked);
    setOpened(true);
    onCollect(picked.id);
    navigator.vibrate?.(20);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 65,
      backgroundColor: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
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
            : "朝・帰宅後・夜、3つ全部クリア！"}
        </div>

        <div style={{ marginBottom: 20, minHeight: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
            <div className="treat-reveal">
              <div style={{ fontSize: 64, marginBottom: 8 }}>{reward.emoji}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: theme.text.primary }}>{reward.label}</div>
              <div style={{ fontSize: 14, color: theme.text.secondary, marginTop: 8 }}>{reward.message}</div>
              <div style={{ fontSize: 11, color: theme.text.tertiary, marginTop: 10 }}>
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
