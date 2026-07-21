import { useState, type CSSProperties } from "react";
import { theme } from "./theme";
import type { ChildProfile } from "./cloudStorage";

interface ChildProfileScreenProps {
  profiles: ChildProfile[];
  loading: boolean;
  error?: string;
  localImportAvailable: boolean;
  userLabel: string;
  onCreate: (name: string, avatarEmoji: string) => void;
  onOpen: (profile: ChildProfile, mode: "cloud" | "importLocal") => void;
  onDelete: (profile: ChildProfile) => void;
  onSignOut: () => void;
  onContinueLocal: () => void;
}

const buttonBase: CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};

export function ChildProfileScreen({
  profiles,
  loading,
  error,
  localImportAvailable,
  userLabel,
  onCreate,
  onOpen,
  onDelete,
  onSignOut,
  onContinueLocal,
}: ChildProfileScreenProps) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🙂");

  const submit = () => {
    if (!name.trim()) return;
    onCreate(name, emoji);
    setName("");
    setEmoji("🙂");
  };

  return (
    <div style={{
      minHeight: "100dvh",
      padding: "max(env(safe-area-inset-top, 16px), 16px) 16px 24px",
      backgroundColor: theme.fill.secondary,
      display: "flex",
      justifyContent: "center",
    }}>
      <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{
          borderRadius: 22,
          padding: 18,
          backgroundColor: theme.bg.editor,
          border: `1.5px solid ${theme.stroke.secondary}`,
        }}>
          <div style={{ fontSize: 12, color: theme.text.tertiary, marginBottom: 4 }}>
            ログイン中: {userLabel}
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: theme.text.primary }}>
            だれのデータで使う？
          </div>
          <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6, color: theme.text.secondary }}>
            子どもの名前を選ぶと、その子専用のデータで使えます。兄弟のデータは混ざりません。
          </div>
          {localImportAvailable ? (
            <div style={{
              marginTop: 12,
              borderRadius: 12,
              padding: 10,
              backgroundColor: `${theme.category.yellow}18`,
              color: theme.text.secondary,
              fontSize: 12,
              lineHeight: 1.6,
            }}>
              このスマホには、すでにやること・シールなどの記録が残っています。
              <br />
              <strong style={{ color: theme.text.primary }}>
                はじめてつなぐときは、正しい子どもの「このスマホの記録を、この子につなぐ」を押してください。
              </strong>
              <br />
              間違った子を選ぶと、別の子の記録に混ざるので注意してください。
            </div>
          ) : (
            <div style={{
              marginTop: 12,
              borderRadius: 12,
              padding: 10,
              backgroundColor: `${theme.category.blue}14`,
              color: theme.text.secondary,
              fontSize: 12,
              lineHeight: 1.6,
            }}>
              出張中に使うスマホなど、すでに記録がある子の続きを開くときは「別のスマホの続きを開く」を使います。
              はじめてつなぐ作業はお父さんがやります。
            </div>
          )}
        </div>

        {error && (
          <div style={{
            borderRadius: 14,
            padding: 12,
            backgroundColor: `${theme.category.pink}14`,
            color: theme.category.pink,
            fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {profiles.map((profile) => (
          <div
            key={profile.id}
            style={{
              borderRadius: 18,
              padding: 14,
              backgroundColor: theme.bg.editor,
              border: `1.5px solid ${theme.stroke.secondary}`,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 28 }}>{profile.avatarEmoji}</span>
              <span style={{ flex: 1, fontSize: 18, fontWeight: 900, color: theme.text.primary }}>
                {profile.name}
              </span>
            </div>
            {localImportAvailable ? (
              <>
                <button
                  type="button"
                  onClick={() => onOpen(profile, "importLocal")}
                  disabled={loading}
                  style={{ ...buttonBase, backgroundColor: theme.category.orange, color: "#fff" }}
                >
                  このスマホの記録を、この子につなぐ（はじめて・安全）
                </button>
                <button
                  type="button"
                  onClick={() => onOpen(profile, "cloud")}
                  disabled={loading}
                  style={{ ...buttonBase, backgroundColor: theme.fill.secondary, color: theme.text.secondary }}
                >
                  別のスマホの続きを開く（このスマホの記録は消える）
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onOpen(profile, "cloud")}
                disabled={loading}
                style={{ ...buttonBase, backgroundColor: theme.accent.primary, color: "#fff" }}
              >
                この子の記録を開く
              </button>
            )}
            <button
              type="button"
              onClick={() => onDelete(profile)}
              disabled={loading}
              style={{
                border: "none",
                backgroundColor: "transparent",
                color: theme.text.tertiary,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                alignSelf: "flex-end",
              }}
            >
              プロフィール削除
            </button>
          </div>
        ))}

        <div style={{
          borderRadius: 18,
          padding: 14,
          backgroundColor: theme.bg.editor,
          border: `1.5px dashed ${theme.stroke.secondary}`,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: theme.text.primary }}>プロフィールを追加</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
              style={{ width: 54, borderRadius: 12, border: `1px solid ${theme.stroke.secondary}`, padding: "9px 8px", fontSize: 18, textAlign: "center" }}
              aria-label="プロフィール絵文字"
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="名前"
              style={{ flex: 1, borderRadius: 12, border: `1px solid ${theme.stroke.secondary}`, padding: "9px 10px", fontSize: 15 }}
              aria-label="プロフィール名"
            />
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={loading || !name.trim()}
            style={{ ...buttonBase, backgroundColor: name.trim() ? theme.category.green : theme.fill.secondary, color: name.trim() ? "#fff" : theme.text.tertiary }}
          >
            追加する
          </button>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onContinueLocal} style={{ ...buttonBase, flex: 1, backgroundColor: theme.fill.secondary, color: theme.text.secondary }}>
            ローカル保存で使う
          </button>
          <button type="button" onClick={onSignOut} style={{ ...buttonBase, flex: 1, backgroundColor: theme.fill.secondary, color: theme.text.secondary }}>
            ログアウト
          </button>
        </div>
      </div>
    </div>
  );
}
