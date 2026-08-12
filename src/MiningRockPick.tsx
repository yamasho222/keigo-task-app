/** 掘り3択「どの岩をほる？」 */

type Props = {
  placeLabel: string;
  /** こううんほりばでヒント表示 */
  hintLucky: boolean;
  luckyIndex: number;
  onPick: (luckyRock: boolean) => void;
  onCancel: () => void;
};

export function MiningRockPick({
  placeLabel,
  hintLucky,
  luckyIndex,
  onPick,
  onCancel,
}: Props) {
  return (
    <div className="mining-rock-pick-backdrop" role="dialog" aria-label="どの岩をほる？">
      <div className="mining-rock-pick-sheet">
        <div className="mining-rock-pick-title">どの岩をほる？</div>
        <div className="mining-rock-pick-sub">{placeLabel}</div>
        {hintLucky && (
          <div className="mining-rock-pick-hint">こううんの日！キラッと光る岩があたりだよ</div>
        )}
        <div className="mining-rock-pick-row">
          {[0, 1, 2].map((i) => {
            const isLucky = i === luckyIndex;
            const glow = hintLucky && isLucky;
            return (
              <button
                key={i}
                type="button"
                className={`mining-rock-card${glow ? " is-glow" : ""}`}
                onClick={() => onPick(isLucky)}
              >
                <span className="mining-rock-emoji" aria-hidden>
                  🪨
                </span>
                <span className="mining-rock-label">いわ {i + 1}</span>
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
