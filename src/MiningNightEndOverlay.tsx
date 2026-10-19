import { MiningItemIcon } from "./MiningItemIcon";

type Props = {
  onDismiss: () => void;
};

/** Battle-only stop: keep the mine open until 21:00 and never run a flee action. */
export function BattleNightEndOverlay({ onDismiss }: Props) {
  return <div className="mining-night-end-overlay" data-modal-overlay role="dialog" aria-labelledby="battle-night-end-title">
    <div className="mining-night-end-card">
      <span aria-hidden="true" style={{ fontSize: 64 }}>🌙</span>
      <div id="battle-night-end-title" className="mining-night-end-title">バトルは おしまい</div>
      <div className="mining-night-end-sub">つづきは のこっているよ。<br />こうざん・クラフトは 21:00まで あそべるよ。</div>
      <button type="button" className="mining-night-end-ok" onClick={onDismiss}>こうざんへ もどる</button>
    </div>
  </div>;
}

/** 21時のこうざん終了。ベッド画像＋「今日はおしまい」 */
export function MiningNightEndOverlay({ onDismiss }: Props) {
  return (
    <div
      className="mining-night-end-overlay"
      data-modal-overlay
      role="dialog"
      aria-labelledby="mining-night-end-title"
      onClick={onDismiss}
    >
      <div
        className="mining-night-end-card"
        onClick={(e) => e.stopPropagation()}
      >
        <MiningItemIcon bed size={72} alt="ベッド" />
        <div id="mining-night-end-title" className="mining-night-end-title">
          今日はおしまい
        </div>
        <div className="mining-night-end-sub">
          こうざんは 朝6:30まで ねよう
        </div>
        <button
          type="button"
          className="mining-night-end-ok"
          onClick={onDismiss}
        >
          わかった
        </button>
      </div>
    </div>
  );
}
