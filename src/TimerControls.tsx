import { theme } from "./theme";

export const TIMER_MINUTES = Array.from({ length: 30 }, (_, i) => i + 1);

// ── タイマー時間設定パネル ─────────────────────────────

export function TimerDurationPanel({
  duration,
  onSetDuration,
  disabled,
  showStartButton,
  onStart,
  compact,
  runningHint,
  needsApprovalMessage,
}: {
  duration: number;
  onSetDuration: (m: number) => void;
  disabled?: boolean;
  showStartButton?: boolean;
  onStart?: () => void;
  compact?: boolean;
  runningHint?: boolean;
  needsApprovalMessage?: boolean;
}) {
  const pick = (m: number) => {
    if (disabled) return;
    onSetDuration(m);
  };

  return (
    <div style={{
      padding: compact ? 12 : 14,
      borderRadius: 14,
      border: `1.5px solid ${theme.stroke.secondary}`,
      backgroundColor: theme.fill.quaternary,
      opacity: disabled ? 0.45 : 1,
    }}>
      <div style={{ fontSize: 12, color: theme.text.tertiary, marginBottom: 8 }}>🎮 ゲームのじかん</div>

      {runningHint && (
        <div style={{ fontSize: 11, color: theme.text.tertiary, marginBottom: 8 }}>
          時間を選んでからスタートボタンをおしてね
        </div>
      )}

      {needsApprovalMessage && (
        <div style={{ fontSize: 12, color: theme.category.orange, marginBottom: 8, textAlign: "center" }}>
          先に親のはんこをもらってね！
        </div>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: compact ? 5 : 6,
        marginBottom: showStartButton ? 10 : 0,
      }}>
        {TIMER_MINUTES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => pick(m)}
            style={{
              padding: compact ? "7px 0" : "8px 0",
              borderRadius: 8,
              border: "none",
              cursor: disabled ? "default" : "pointer",
              backgroundColor: duration === m ? theme.accent.primary : theme.fill.secondary,
              color: duration === m ? "#fff" : theme.text.secondary,
              fontWeight: duration === m ? 700 : 400,
              fontSize: compact ? 12 : 13,
              minWidth: 0,
            }}
          >
            {m}分
          </button>
        ))}
      </div>

      {showStartButton && (
        <button
          type="button"
          onClick={disabled ? undefined : onStart}
          style={{
            width: "100%", marginTop: 10, padding: "12px 0", borderRadius: 10, border: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            backgroundColor: disabled ? theme.fill.secondary : theme.accent.primary,
            color: disabled ? theme.text.tertiary : "#fff",
            fontSize: 15, fontWeight: 700,
          }}
        >
          {duration}分スタート 🎮
        </button>
      )}
    </div>
  );
}
