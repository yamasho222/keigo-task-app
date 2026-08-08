import type { CSSProperties } from "react";
import { theme } from "./theme";

/**
 * こうざん／クラフトを一度でも開いたか。
 * 未訪問のあいだは、アプリ起動のたびにハンバーガー案内を出す。
 */
export const MINING_MENU_TUTORIAL_KEY = "keigo-mining-visited-v1";

export type MiningMenuTutorialStep = "idle" | "hamburger" | "menuItem";

export function isMiningMenuTutorialDone(): boolean {
  try {
    return localStorage.getItem(MINING_MENU_TUTORIAL_KEY) === "1";
  } catch {
    return true;
  }
}

/** こうざん／クラフト画面へ入ったときに呼ぶ */
export function markMiningMenuTutorialDone(): void {
  try {
    localStorage.setItem(MINING_MENU_TUTORIAL_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function resetMiningMenuTutorial(): void {
  try {
    localStorage.removeItem(MINING_MENU_TUTORIAL_KEY);
  } catch {
    /* ignore */
  }
}

const cardBase: CSSProperties = {
  backgroundColor: theme.bg.editor,
  borderRadius: 16,
  padding: "16px 16px 14px",
  boxShadow: "0 12px 36px rgba(0,0,0,0.28)",
  border: `2px solid ${theme.accent.primary}`,
};

const btnPrimary: CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "12px 14px",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
  backgroundColor: theme.accent.primary,
  color: "#fff",
  flex: 1,
};

const btnGhost: CSSProperties = {
  border: `1.5px solid ${theme.stroke.secondary}`,
  borderRadius: 12,
  padding: "12px 14px",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  backgroundColor: theme.fill.secondary,
  color: theme.text.primary,
  flex: 1,
};

/** ハンバーガーボタン向けの初回スポットライト */
export function MiningHamburgerCoachmark({
  onView,
  onDismiss,
}: {
  onView: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="mining-menu-tutorial-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="あたらしいメニューの案内"
    >
      <div className="mining-menu-tutorial-dim" onClick={onDismiss} />
      <div className="mining-menu-tutorial-fab-hole" aria-hidden />
      <div className="mining-menu-tutorial-card" style={cardBase}>
        <div style={{ fontSize: 13, fontWeight: 800, color: theme.accent.primary, marginBottom: 4 }}>
          NEW
        </div>
        <div style={{ fontSize: 17, fontWeight: 900, color: theme.text.primary, lineHeight: 1.4, marginBottom: 6 }}>
          メニューに あたらしいばしょが できたよ！
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: theme.text.secondary, lineHeight: 1.5, marginBottom: 14 }}>
          「こうざん／クラフト」で、ほったり つくったりできるよ
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" style={btnGhost} onClick={onDismiss}>とじる</button>
          <button type="button" style={btnPrimary} onClick={onView}>みてみる</button>
        </div>
      </div>
    </div>
  );
}

/** メニュー内の案内バナー */
export function MiningMenuTipBanner({ onGotIt }: { onGotIt: () => void }) {
  return (
    <div
      className="mining-menu-tutorial-banner"
      style={{
        margin: "0 12px 10px",
        padding: "12px 12px 10px",
        borderRadius: 12,
        backgroundColor: `${theme.accent.primary}14`,
        border: `1.5px solid ${theme.accent.primary}66`,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 900, color: theme.text.primary, lineHeight: 1.4, marginBottom: 4 }}>
        ここが新しいよ！ ⛏️ こうざん／クラフト
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: theme.text.secondary, lineHeight: 1.45, marginBottom: 10 }}>
        チケットをつかって、ほったりクラフトできるよ
      </div>
      <button type="button" style={{ ...btnPrimary, width: "100%", flex: "none" }} onClick={onGotIt}>
        あとで
      </button>
    </div>
  );
}
