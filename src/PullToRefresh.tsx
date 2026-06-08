import { useRef, useState, useEffect, type ReactNode, type CSSProperties } from "react";
import { theme } from "./theme";

const THRESHOLD = 64;
const MAX_PULL = 96;

interface Props {
  children: ReactNode;
  disabled?: boolean;
  style?: CSSProperties;
  className?: string;
}

export function PullToRefresh({ children, disabled, style, className }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const pullingRef = useRef(false);
  const pullRef = useRef(0);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    pullRef.current = pull;
  }, [pull]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || disabled) return;

    const reset = () => {
      pullingRef.current = false;
      if (!refreshing) {
        pullRef.current = 0;
        setPull(0);
      }
    };

    const isModalTouch = (e: TouchEvent) =>
      !!(e.target as Element).closest?.("[data-modal-overlay]");

    const onTouchStart = (e: TouchEvent) => {
      if (isModalTouch(e) || refreshing || el.scrollTop > 0) return;
      startY.current = e.touches[0].clientY;
      pullingRef.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (isModalTouch(e) || !pullingRef.current || refreshing) return;
      if (el.scrollTop > 0) {
        reset();
        return;
      }
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0) {
        if (delta > 8) e.preventDefault();
        const next = Math.min(delta * 0.45, MAX_PULL);
        pullRef.current = next;
        setPull(next);
      } else {
        reset();
      }
    };

    const onTouchEnd = async () => {
      if (!pullingRef.current) return;
      pullingRef.current = false;
      const distance = pullRef.current;
      if (distance >= THRESHOLD) {
        setRefreshing(true);
        setPull(48);
        if ("serviceWorker" in navigator) {
          try {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) await reg.update();
          } catch { /* ignore */ }
        }
        window.location.reload();
        return;
      }
      pullRef.current = 0;
      setPull(0);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [disabled, refreshing]);

  const hint =
    refreshing ? "更新中..."
    : pull >= THRESHOLD ? "離して更新"
    : pull > 16 ? "引っ張って更新"
    : "";

  return (
    <div
      ref={scrollRef}
      className={className}
      style={{
        minHeight: "100dvh",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        ...style,
      }}
    >
      <div
        style={{
          height: refreshing ? 48 : pull,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          overflow: "hidden",
          color: theme.text.tertiary,
          fontSize: 13,
          fontWeight: 600,
          transition: refreshing ? "none" : "height 0.2s ease",
          flexShrink: 0,
        }}
      >
        {(hint || refreshing) && (
          <>
            <span
              style={{
                display: "inline-block",
                transform: refreshing ? undefined : `rotate(${Math.min(pull / THRESHOLD, 1) * 180}deg)`,
                transition: "transform 0.15s ease",
              }}
            >
              🔄
            </span>
            {hint}
          </>
        )}
      </div>
      {children}
    </div>
  );
}
