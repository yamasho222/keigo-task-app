import { useState, useRef, useEffect } from "react";
import { theme } from "./theme";

export const TIMER_PRESETS = [5, 10, 15, 20, 30] as const;

const WHEEL_ITEM_H = 44;
const WHEEL_VISIBLE = 5;

function isPresetValue(m: number) {
  return (TIMER_PRESETS as readonly number[]).includes(m);
}

// ── 分ピッカー（ロール式） ─────────────────────────────

export function MinutePicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (m: number) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const wheelRef = useRef<HTMLDivElement>(null);
  const custom = !isPresetValue(value);

  useEffect(() => {
    if (!open) return;
    setDraft(value);
    requestAnimationFrame(() => {
      wheelRef.current?.scrollTo({ top: (value - 1) * WHEEL_ITEM_H });
    });
  }, [open, value]);

  const syncFromScroll = () => {
    const el = wheelRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / WHEEL_ITEM_H);
    setDraft(Math.min(180, Math.max(1, idx + 1)));
  };

  const confirm = () => {
    onChange(draft);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(true)}
        style={{
          flex: 1, padding: "8px 12px", borderRadius: 8, textAlign: "left",
          border: custom ? `2px solid ${theme.accent.primary}` : `1px solid ${theme.stroke.secondary}`,
          fontSize: 14, backgroundColor: theme.bg.editor, color: theme.text.primary,
          fontFamily: "inherit", cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {custom ? `${value}分` : "自由に入力（分）"}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            backgroundColor: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 420,
              backgroundColor: theme.bg.editor,
              borderRadius: "16px 16px 0 0",
              padding: "12px 16px max(env(safe-area-inset-bottom, 16px), 16px)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: theme.text.primary }}>時間をえらぶ</span>
              <button type="button" onClick={confirm} style={{
                padding: "6px 14px", borderRadius: 8, border: "none",
                backgroundColor: theme.accent.primary, color: "#fff",
                fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}>
                決定
              </button>
            </div>

            <div style={{ position: "relative", height: WHEEL_ITEM_H * WHEEL_VISIBLE }}>
              <div style={{
                position: "absolute", left: 16, right: 16, top: "50%",
                transform: "translateY(-50%)", height: WHEEL_ITEM_H,
                borderRadius: 10, backgroundColor: `${theme.accent.primary}18`,
                border: `1.5px solid ${theme.accent.primary}44`, pointerEvents: "none", zIndex: 1,
              }} />
              <div
                ref={wheelRef}
                onScroll={syncFromScroll}
                className="minute-wheel"
                style={{
                  height: "100%", overflowY: "auto",
                  scrollSnapType: "y mandatory",
                  WebkitOverflowScrolling: "touch",
                  maskImage: "linear-gradient(transparent, #000 28%, #000 72%, transparent)",
                }}
              >
                <div style={{ height: WHEEL_ITEM_H * 2 }} />
                {Array.from({ length: 180 }, (_, i) => i + 1).map((m) => (
                  <div
                    key={m}
                    className="minute-wheel-item"
                    style={{
                      height: WHEEL_ITEM_H, lineHeight: `${WHEEL_ITEM_H}px`,
                      textAlign: "center", scrollSnapAlign: "center",
                      fontSize: m === draft ? 22 : 17,
                      fontWeight: m === draft ? 800 : 400,
                      color: m === draft ? theme.accent.primary : theme.text.secondary,
                    }}
                  >
                    {m}分
                  </div>
                ))}
                <div style={{ height: WHEEL_ITEM_H * 2 }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

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
  const custom = !isPresetValue(duration);

  const pickPreset = (m: number) => {
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
          時間を変えると、タイマーが新しい時間ではじまるよ
        </div>
      )}

      {needsApprovalMessage && (
        <div style={{ fontSize: 12, color: theme.category.orange, marginBottom: 8, textAlign: "center" }}>
          先に親のはんこをもらってね！
        </div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {TIMER_PRESETS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => pickPreset(m)}
            style={{
              padding: compact ? "4px 8px" : "5px 10px", borderRadius: 8, border: "none",
              cursor: disabled ? "default" : "pointer",
              backgroundColor: duration === m && !custom ? theme.accent.primary : theme.fill.secondary,
              color: duration === m && !custom ? "#fff" : theme.text.secondary,
              fontWeight: duration === m && !custom ? 700 : 400,
              fontSize: compact ? 12 : 13,
            }}
          >
            {m}分
          </button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: showStartButton ? 10 : 0 }}>
        <MinutePicker value={duration} onChange={onSetDuration} disabled={disabled} />
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
