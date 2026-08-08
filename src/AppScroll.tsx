import { type ReactNode, type CSSProperties } from "react";

interface Props {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

/** アプリ全体の単一スクロールコンテナ（Pull-to-Refresh なし）
 *
 * 重要: 親から高さ拘束されたうえで overflowY:auto にする。
 * minHeight:100dvh のみだと中身分だけ伸び、実スクロールが window 側になり
 * 子の position:sticky も効かなくなる。
 */
export function AppScroll({ children, style, className }: Props) {
  return (
    <div
      data-app-scroll
      className={className}
      style={{
        flex: 1,
        minHeight: 0,
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
        overscrollBehaviorY: "contain",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
