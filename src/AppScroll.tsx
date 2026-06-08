import { type ReactNode, type CSSProperties } from "react";

interface Props {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

/** アプリ全体の単一スクロールコンテナ（Pull-to-Refresh なし） */
export function AppScroll({ children, style, className }: Props) {
  return (
    <div
      className={className}
      style={{
        minHeight: "100dvh",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        overscrollBehaviorY: "contain",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
