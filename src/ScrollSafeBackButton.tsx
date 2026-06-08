import { useRef } from "react";
import { theme } from "./theme";

/** スクロール終了時の誤タップを防ぐ「もどる」ボタン */
export function ScrollSafeBackButton({ onBack }: { onBack: () => void }) {
  const pointer = useRef({ x: 0, y: 0, moved: false });

  return (
    <button
      type="button"
      onPointerDown={(e) => {
        pointer.current = { x: e.clientX, y: e.clientY, moved: false };
      }}
      onPointerMove={(e) => {
        const d = Math.hypot(e.clientX - pointer.current.x, e.clientY - pointer.current.y);
        if (d > 12) pointer.current.moved = true;
      }}
      onClick={() => {
        if (pointer.current.moved) return;
        onBack();
      }}
      style={{
        display: "flex", alignItems: "center", gap: 4, cursor: "pointer",
        color: theme.text.tertiary, fontSize: 13, padding: "4px 6px", borderRadius: 6,
        border: "none", background: "none", fontFamily: "inherit",
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      もどる
    </button>
  );
}
