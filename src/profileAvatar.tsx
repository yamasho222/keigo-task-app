import type { CSSProperties } from "react";
import { MiningItemIcon } from "./MiningItemIcon";
import {
  GEAR_IMAGE,
  MATERIAL_META,
  gearLabel,
  type CraftedGearId,
} from "./miningTypes";
import { theme } from "./theme";

export const PROFILE_EMOJI_OPTIONS = [
  "🙂", "😎", "🐱", "🐶", "🐯", "🐻", "🐸", "🐧", "🌟", "🎮", "🚀", "🌈",
];

const EXTRA_ITEM_AVATARS: { label: string; src: string }[] = [
  { label: "スティーブ", src: "/mining/Steve.png" },
  { label: "チェスト", src: "/mining/Chest.png" },
  { label: "ベッド", src: "/mining/White_Bed.png" },
];

export function isProfileAvatarImage(value: string): boolean {
  return value.startsWith("/");
}

export function listProfileItemAvatars(): { label: string; src: string }[] {
  const seen = new Set<string>();
  const out: { label: string; src: string }[] = [];
  const add = (label: string, src: string) => {
    if (!src || seen.has(src)) return;
    seen.add(src);
    out.push({ label, src });
  };
  for (const item of EXTRA_ITEM_AVATARS) add(item.label, item.src);
  for (const meta of Object.values(MATERIAL_META)) {
    if (meta.image) add(meta.label, meta.image);
  }
  for (const [id, src] of Object.entries(GEAR_IMAGE)) {
    if (src) add(gearLabel(id as CraftedGearId), src);
  }
  return out;
}

const ITEM_AVATARS = listProfileItemAvatars();

interface ProfileAvatarProps {
  value: string;
  size?: number;
  alt?: string;
  style?: CSSProperties;
}

export function ProfileAvatar({ value, size = 28, alt = "", style }: ProfileAvatarProps) {
  const src = (value ?? "").trim();
  if (isProfileAvatarImage(src)) {
    return <MiningItemIcon src={src} size={size} alt={alt} style={style} />;
  }
  return (
    <span
      aria-hidden={!alt}
      aria-label={alt || undefined}
      style={{
        display: "inline-flex",
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.max(12, size * 0.72),
        lineHeight: 1,
        flexShrink: 0,
        ...style,
      }}
    >
      {src || "🙂"}
    </span>
  );
}

const chipBase: CSSProperties = {
  borderRadius: 10,
  padding: 0,
  width: 44,
  height: 44,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  backgroundColor: theme.fill.secondary,
};

interface AvatarPickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function AvatarPicker({ value, onChange, disabled }: AvatarPickerProps) {
  const selected = value.trim() || "🙂";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          backgroundColor: theme.fill.secondary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `1.5px solid ${theme.stroke.secondary}`,
        }}>
          <ProfileAvatar value={selected} size={36} />
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.5, color: theme.text.secondary }}>
          絵文字か、マイクラのアイテムを選べます。
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 800, color: theme.text.tertiary }}>絵文字</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {PROFILE_EMOJI_OPTIONS.map((emoji) => {
          const active = selected === emoji;
          return (
            <button
              key={emoji}
              type="button"
              disabled={disabled}
              onClick={() => onChange(emoji)}
              style={{
                ...chipBase,
                border: active ? `2px solid ${theme.accent.primary}` : `1.5px solid ${theme.stroke.secondary}`,
                fontSize: 22,
              }}
            >
              {emoji}
            </button>
          );
        })}
      </div>
      <input
        value={isProfileAvatarImage(selected) ? "" : selected}
        onChange={(e) => {
          const next = e.target.value.slice(0, 4);
          if (next.trim()) onChange(next);
        }}
        placeholder="好きな絵文字"
        disabled={disabled}
        aria-label="好きな絵文字"
        style={{
          borderRadius: 12,
          border: `1px solid ${theme.stroke.secondary}`,
          padding: "8px 10px",
          fontSize: 15,
        }}
      />

      <div style={{ fontSize: 12, fontWeight: 800, color: theme.text.tertiary }}>マイクラのアイテム</div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))",
        gap: 6,
        maxHeight: 176,
        overflowY: "auto",
        padding: 4,
        borderRadius: 12,
        backgroundColor: theme.fill.quaternary,
      }}>
        {ITEM_AVATARS.map((item) => {
          const active = selected === item.src;
          return (
            <button
              key={item.src}
              type="button"
              disabled={disabled}
              title={item.label}
              aria-label={item.label}
              onClick={() => onChange(item.src)}
              style={{
                ...chipBase,
                width: "100%",
                border: active ? `2px solid ${theme.accent.primary}` : `1.5px solid ${theme.stroke.secondary}`,
              }}
            >
              <MiningItemIcon src={item.src} size={28} alt="" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
