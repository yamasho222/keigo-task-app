import { MiningItemIcon } from "./MiningItemIcon";

type Props = {
  onDismiss: () => void;
};

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
          こうざんは 朝5時まで ねよう
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
