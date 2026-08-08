import type { CSSProperties } from "react";
import { theme } from "./theme";

interface AuthScreenProps {
  firebaseConfigured: boolean;
  loading: boolean;
  error?: string;
  onSignInGoogle: () => void;
  onContinueLocal: () => void;
}

const panelStyle: CSSProperties = {
  width: "100%",
  maxWidth: 420,
  borderRadius: 22,
  padding: 22,
  backgroundColor: theme.bg.editor,
  border: `1.5px solid ${theme.stroke.secondary}`,
  boxShadow: "0 10px 28px rgba(0,0,0,0.10)",
};

export function AuthScreen({
  firebaseConfigured,
  loading,
  error,
  onSignInGoogle,
  onContinueLocal,
}: AuthScreenProps) {
  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 18,
      backgroundColor: theme.fill.secondary,
    }}>
      <div style={panelStyle}>
        <div style={{ fontSize: 28, fontWeight: 900, color: theme.text.primary, marginBottom: 8 }}>
          タスクアプリにログイン
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.7, color: theme.text.secondary, marginBottom: 18 }}>
          自分の Google でログインすると、子どもプロフィールごとにタスク・ごほうび・記録を端末をまたいで同期できます。
          iPhone では Safari で開いてログインしてください（プライベートブラウズや「すべてのCookieをブロック」だと失敗します）。
        </div>

        {!firebaseConfigured && (
          <div style={{
            borderRadius: 14,
            padding: 12,
            backgroundColor: `${theme.category.orange}14`,
            color: theme.text.secondary,
            fontSize: 13,
            lineHeight: 1.6,
            marginBottom: 14,
          }}>
            Firebase設定がまだ入っていません。`.env` にFirebaseの設定値を入れるとログインを使えます。
          </div>
        )}

        {error && (
          <div style={{
            borderRadius: 14,
            padding: 12,
            backgroundColor: `${theme.category.pink}14`,
            color: theme.category.pink,
            fontSize: 13,
            lineHeight: 1.6,
            marginBottom: 14,
          }}>
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={!firebaseConfigured || loading}
          onClick={onSignInGoogle}
          style={{
            width: "100%",
            border: "none",
            borderRadius: 14,
            padding: "13px 16px",
            backgroundColor: firebaseConfigured ? theme.accent.primary : theme.fill.secondary,
            color: firebaseConfigured ? "#fff" : theme.text.tertiary,
            fontSize: 15,
            fontWeight: 900,
            cursor: firebaseConfigured && !loading ? "pointer" : "default",
            marginBottom: 10,
          }}
        >
          Googleでログイン
        </button>

        <button
          type="button"
          onClick={onContinueLocal}
          style={{
            width: "100%",
            border: `1px solid ${theme.stroke.secondary}`,
            borderRadius: 14,
            padding: "12px 16px",
            backgroundColor: "transparent",
            color: theme.text.secondary,
            fontSize: 14,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          いまはローカル保存で使う
        </button>
      </div>
    </div>
  );
}
