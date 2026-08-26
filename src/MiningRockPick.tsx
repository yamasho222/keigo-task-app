/** 掘り3択「どの岩をほる？」（シート外ダイアログ用・ヘルメットヒント対応） */

import type { HelmetRockHint } from "./miningProgress";

type Props = {
  placeLabel: string;
  rockHint?: HelmetRockHint;
  luckyIndex: number;
  onPick: (luckyRock: boolean) => void;
  onCancel: () => void;
  chestMode?: boolean;
};

export function MiningRockPick({
  placeLabel,
  rockHint = { kind: "none" },
  luckyIndex,
  onPick,
  onCancel,
  chestMode = false,
}: Props) {
  const thing = chestMode ? "チェスト" : "岩";
  return (
    <div className="mining-rock-pick-backdrop" role="dialog" aria-label={chestMode ? "どのチェスト？" : "どの岩をほる？"}>
      <div className="mining-rock-pick-sheet">
        <div className="mining-rock-pick-title">{chestMode ? "どのチェスト？" : "どの岩をほる？"}</div>
        <div className="mining-rock-pick-sub">{placeLabel}</div>
        {rockHint.kind === "hit" && (
          <div className="mining-rock-pick-hint">ヘルメットのヒント：キラッと光る{thing}があたりだよ</div>
        )}
        {rockHint.kind === "miss" && (
          <div className="mining-rock-pick-hint">ヘルメットのヒント：うすい{thing}ははずれだよ</div>
        )}
        <div className="mining-rock-pick-row">
          {[0, 1, 2].map((i) => {
            const isLucky = i === luckyIndex;
            const isHitHint = rockHint.kind === "hit" && rockHint.index === i;
            const isMissHint = rockHint.kind === "miss" && rockHint.index === i;
            return (
              <button
                key={i}
                type="button"
                className={`mining-rock-card${isHitHint ? " is-glow" : ""}${isMissHint ? " is-miss-hint" : ""}`}
                onClick={() => onPick(isLucky)}
              >
                <span className="mining-rock-emoji" aria-hidden>
                  {chestMode ? "📦" : "🪨"}
                </span>
                <span className="mining-rock-label">{chestMode ? `チェスト ${i + 1}` : `いわ ${i + 1}`}</span>
                {isMissHint && <span className="mining-rock-tile-badge is-miss">はずれ</span>}
                {isHitHint && <span className="mining-rock-tile-badge is-hit">あたり</span>}
              </button>
            );
          })}
        </div>
        <button type="button" className="mining-rock-cancel" onClick={onCancel}>
          やめる
        </button>
      </div>
    </div>
  );
}
