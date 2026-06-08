import { theme } from "./theme";
import {
  ALARM_DURATION_PRESETS,
  ALARM_SOUND_OPTIONS,
  isVibrationSupported,
  previewAlarmSound,
  type AlarmSettings,
  type AlarmSoundType,
} from "./alarm";

function formatDuration(sec: number) {
  if (sec < 60) return `${sec}秒`;
  if (sec % 60 === 0) return `${sec / 60}分`;
  return `${Math.floor(sec / 60)}分${sec % 60}秒`;
}

export function AlarmSettingsPanel({
  settings,
  onChange,
  onTest,
  compact,
}: {
  settings: AlarmSettings;
  onChange: (next: AlarmSettings) => void;
  onTest?: () => void;
  compact?: boolean;
}) {
  const set = (patch: Partial<AlarmSettings>) => onChange({ ...settings, ...patch });
  const vibrateSupported = isVibrationSupported();

  const pickSound = (type: AlarmSoundType) => {
    set({ soundType: type });
    if (settings.soundEnabled) void previewAlarmSound(type);
  };

  return (
    <div style={{
      padding: compact ? 12 : 14,
      borderRadius: 14,
      border: `1.5px solid ${theme.stroke.secondary}`,
      backgroundColor: theme.fill.quaternary,
    }}>
      <div style={{ fontSize: 12, color: theme.text.tertiary, marginBottom: 10 }}>🔔 アラーム設定</div>

      <div style={{ fontSize: 12, color: theme.text.secondary, marginBottom: 8 }}>アラームの音</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {ALARM_SOUND_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => pickSound(opt.id)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 10, border: "none",
              cursor: "pointer", textAlign: "left",
              backgroundColor: settings.soundType === opt.id ? `${theme.accent.primary}22` : theme.fill.secondary,
              outline: settings.soundType === opt.id ? `2px solid ${theme.accent.primary}` : "none",
            }}
          >
            <span style={{ fontSize: 22 }}>{opt.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 14, fontWeight: settings.soundType === opt.id ? 700 : 600,
                color: settings.soundType === opt.id ? theme.accent.primary : theme.text.primary,
              }}>
                {opt.label}
              </div>
              <div style={{ fontSize: 11, color: theme.text.tertiary, marginTop: 2 }}>{opt.desc}</div>
            </div>
            {settings.soundType === opt.id && (
              <span style={{ fontSize: 11, color: theme.accent.primary, fontWeight: 700 }}>選択中</span>
            )}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 12, color: theme.text.secondary, marginBottom: 8 }}>鳴り続ける時間</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {ALARM_DURATION_PRESETS.map((sec) => (
          <button
            key={sec}
            type="button"
            onClick={() => set({ durationSec: sec })}
            style={{
              padding: "5px 10px", borderRadius: 8, border: "none", cursor: "pointer",
              backgroundColor: settings.durationSec === sec ? theme.accent.primary : theme.fill.secondary,
              color: settings.durationSec === sec ? "#fff" : theme.text.secondary,
              fontWeight: settings.durationSec === sec ? 700 : 400,
              fontSize: 12,
            }}
          >
            {formatDuration(sec)}
          </button>
        ))}
      </div>

      <ToggleRow
        label="音を鳴らす"
        hint="選んだ音でアラーム"
        checked={settings.soundEnabled}
        onChange={(soundEnabled) => set({ soundEnabled })}
      />
      <ToggleRow
        label="振動させる"
        hint={vibrateSupported ? "スマホがブルブル震える" : "この端末では振動非対応"}
        checked={settings.vibrationEnabled}
        onChange={(vibrationEnabled) => set({ vibrationEnabled })}
        disabled={!vibrateSupported}
      />

      {onTest && (
        <button
          type="button"
          onClick={onTest}
          style={{
            width: "100%", marginTop: 12, padding: "10px 0", borderRadius: 10, border: "none",
            cursor: "pointer", backgroundColor: theme.fill.secondary,
            color: theme.text.secondary, fontSize: 14, fontWeight: 600,
          }}
        >
          試しに鳴らす（3秒）
        </button>
      )}
    </div>
  );
}

function ToggleRow({
  label, hint, checked, onChange, disabled,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 0", borderTop: `1px solid ${theme.stroke.secondary}`,
      opacity: disabled ? 0.5 : 1,
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: theme.text.primary }}>{label}</div>
        <div style={{ fontSize: 11, color: theme.text.tertiary, marginTop: 2 }}>{hint}</div>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        style={{
          width: 48, height: 28, borderRadius: 14, border: "none", cursor: disabled ? "default" : "pointer",
          backgroundColor: checked ? theme.accent.primary : theme.fill.secondary,
          position: "relative", flexShrink: 0,
        }}
      >
        <span style={{
          position: "absolute", top: 3,
          left: checked ? 23 : 3,
          width: 22, height: 22, borderRadius: 11,
          backgroundColor: "#fff",
          transition: "left 0.15s ease",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </button>
    </div>
  );
}
