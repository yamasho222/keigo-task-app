import { useState, type CSSProperties } from "react";
import { theme } from "./theme";
import type { ChildProfile } from "./cloudStorage";
import { AppScroll } from "./AppScroll";

interface ChildProfileScreenProps {
  profiles: ChildProfile[];
  loading: boolean;
  error?: string;
  /** レガシー共有スロットに未割当データがあるか（画面上部の説明用） */
  legacyImportAvailable: boolean;
  /** その子に初回「つなぐ」を出してよいか */
  canImportToChild: (childId: string) => boolean;
  userLabel: string;
  onCreate: (name: string, avatarEmoji: string) => void;
  onOpen: (profile: ChildProfile, mode: "cloud" | "importLocal") => void;
  onDelete: (profile: ChildProfile) => void;
  onRestoreOrphan: (orphanChildId: string, target: ChildProfile) => void;
  orphans: { childId: string; summary: string }[];
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
  legacyImportAvailable,
  canImportToChild,
  userLabel,
  onCreate,
  onOpen,
  onDelete,
  onRestoreOrphan,
  orphans,
  onSignOut,
  onContinueLocal,
}: ChildProfileScreenProps) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🙂");
  const [manageOpen, setManageOpen] = useState(false);
  const [deletingProfile, setDeletingProfile] = useState<ChildProfile | null>(null);
  const [deleteNameInput, setDeleteNameInput] = useState("");

  const submit = () => {
    if (!name.trim()) return;
    onCreate(name, emoji);
    setName("");
    setEmoji("🙂");
  };

  const closeDeleteModal = () => {
    setDeletingProfile(null);
    setDeleteNameInput("");
  };

  const nameMatchesDeleteTarget =
    deletingProfile !== null && deleteNameInput.trim() === deletingProfile.name.trim();

  const confirmDelete = () => {
    if (!deletingProfile || !nameMatchesDeleteTarget || loading) return;
    const target = deletingProfile;
    closeDeleteModal();
    onDelete(target);
  };

  const showLegacyImportHelp =
    legacyImportAvailable && profiles.some((profile) => canImportToChild(profile.id));

  return (
    <>
    <AppScroll style={{ backgroundColor: theme.fill.secondary }}>
    <div style={{
      minHeight: "100%",
      padding: "max(env(safe-area-inset-top, 16px), 16px) 16px max(env(safe-area-inset-bottom, 24px), 24px)",
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
            子どもの名前を選ぶと、その子専用のデータで使えます。兄弟のデータは端末の中でも分かれています。
          </div>
          {showLegacyImportHelp ? (
            <div style={{
              marginTop: 12,
              borderRadius: 12,
              padding: 10,
              backgroundColor: `${theme.category.yellow}18`,
              color: theme.text.secondary,
              fontSize: 12,
              lineHeight: 1.6,
            }}>
              このスマホには、まだどの子にもつないでない古い記録があります。
              <br />
              <strong style={{ color: theme.text.primary }}>
                初回だけ、正しい子どもの「このスマホの記録を、この子につなぐ」を押してください。
              </strong>
              <br />
              一度つないだあとは、このボタンは出なくなります。
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
              ふだんは「この子の記録を開く」だけで大丈夫です。
              けんご／けいごを切り替えても、もう片方の記録は消えません。
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

        {orphans.length > 0 && (
          <div style={{
            borderRadius: 18,
            padding: 14,
            backgroundColor: `${theme.category.orange}14`,
            border: `1.5px solid ${theme.category.orange}`,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: theme.text.primary }}>
              削除した記録が、このスマホに残っています
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: theme.text.secondary }}>
              先に下で「けんご」などのプロフィールを追加してから、正しい子へつないでください。
              けいごなど別の子にはつながないでください。
            </div>
            {orphans.map((orphan) => (
              <div
                key={orphan.childId}
                style={{
                  borderRadius: 12,
                  padding: 12,
                  backgroundColor: theme.bg.editor,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: theme.text.primary }}>
                  {orphan.summary}
                </div>
                {profiles.length === 0 ? (
                  <div style={{ fontSize: 12, color: theme.text.secondary }}>
                    つなぐ先のプロフィールを、下から追加してください。
                  </div>
                ) : (
                  profiles.map((profile) => (
                    <button
                      key={profile.id}
                      type="button"
                      disabled={loading}
                      onClick={() => onRestoreOrphan(orphan.childId, profile)}
                      style={{ ...buttonBase, backgroundColor: theme.category.orange, color: "#fff" }}
                    >
                      「{profile.name}」につなぐ
                    </button>
                  ))
                )}
              </div>
            ))}
          </div>
        )}

        {profiles.map((profile) => {
          const showImport = canImportToChild(profile.id);
          return (
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
              {showImport ? (
                <>
                  <button
                    type="button"
                    onClick={() => onOpen(profile, "importLocal")}
                    disabled={loading}
                    style={{ ...buttonBase, backgroundColor: theme.category.orange, color: "#fff" }}
                  >
                    このスマホの記録を、この子につなぐ（はじめてだけ）
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpen(profile, "cloud")}
                    disabled={loading}
                    style={{ ...buttonBase, backgroundColor: theme.fill.secondary, color: theme.text.secondary }}
                  >
                    クラウドの記録を開く（つなぐのは上のボタン）
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
            </div>
          );
        })}

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

        {profiles.length > 0 && (
          <div style={{
            borderRadius: 18,
            padding: 14,
            backgroundColor: theme.bg.editor,
            border: `1.5px solid ${theme.stroke.secondary}`,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}>
            <button
              type="button"
              onClick={() => setManageOpen((open) => !open)}
              style={{
                ...buttonBase,
                backgroundColor: "transparent",
                color: theme.text.secondary,
                textAlign: "left",
                padding: 0,
              }}
            >
              プロフィールの管理 {manageOpen ? "▲" : "▼"}
            </button>
            {manageOpen && (
              <>
                <div style={{ fontSize: 12, lineHeight: 1.6, color: theme.text.secondary }}>
                  ふだんは開きません。消すと、その子のクラウド記録も消えます。
                </div>
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 0",
                      borderTop: `1px solid ${theme.stroke.tertiary}`,
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{profile.avatarEmoji}</span>
                    <span style={{ flex: 1, fontSize: 15, fontWeight: 800, color: theme.text.primary }}>
                      {profile.name}
                    </span>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        setDeletingProfile(profile);
                        setDeleteNameInput("");
                      }}
                      style={{ ...buttonBase, backgroundColor: `${theme.category.pink}14`, color: theme.category.pink }}
                    >
                      削除する
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

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
    </AppScroll>
    {deletingProfile && (
      <div
        data-modal-overlay
        onClick={closeDeleteModal}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 140,
          backgroundColor: "rgba(0,0,0,0.55)",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: 420,
            borderRadius: "20px 20px 0 0",
            backgroundColor: theme.bg.editor,
            padding: "20px 18px max(env(safe-area-inset-bottom, 16px), 16px)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900, color: theme.text.primary }}>
            「{deletingProfile.name}」を削除します
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: theme.text.secondary }}>
            クラウドの記録も消えます。もどすボタンはありません。
            消すには、下に「{deletingProfile.name}」と入力してください。
          </div>
          <input
            value={deleteNameInput}
            onChange={(e) => setDeleteNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmDelete();
            }}
            placeholder={`${deletingProfile.name} と入力`}
            autoFocus
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="削除するプロフィール名"
            style={{
              borderRadius: 12,
              border: `1px solid ${theme.stroke.secondary}`,
              padding: "12px 10px",
              fontSize: 16,
            }}
          />
          <button
            type="button"
            onClick={confirmDelete}
            disabled={loading || !nameMatchesDeleteTarget}
            style={{
              ...buttonBase,
              padding: "14px 12px",
              fontSize: 15,
              backgroundColor: nameMatchesDeleteTarget ? theme.category.pink : theme.fill.secondary,
              color: nameMatchesDeleteTarget ? "#fff" : theme.text.tertiary,
            }}
          >
            削除する
          </button>
          <button
            type="button"
            onClick={closeDeleteModal}
            style={{
              ...buttonBase,
              padding: "12px 12px",
              fontSize: 14,
              backgroundColor: theme.fill.secondary,
              color: theme.text.secondary,
            }}
          >
            やめる
          </button>
        </div>
      </div>
    )}
    </>
  );
}
