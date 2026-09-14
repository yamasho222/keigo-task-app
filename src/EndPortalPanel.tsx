/** エンドポータル：アイを12こはめる */

import { END_PORTAL_EYE_SLOTS } from "./endChapter";
import { END_PORTAL_LINKED_IMAGE } from "./endFx";
import type { MiningState } from "./miningTypes";
import { getMaterialCount } from "./miningTypes";

const FRAME_EMPTY = "/mining/End_Portal_Frame.webp";
const FRAME_FILLED = "/mining/End_Portal_Frame_Filled.webp";
const WELL_EMPTY = "/mining/End_Portal_Empty.jpg";

type Props = {
  mining: MiningState;
  shaking: boolean;
  insertPulse: number;
  onInsert: () => void;
  onUnlockTheEnd: () => void;
};

export function EndPortalPanel({
  mining,
  shaking,
  insertPulse,
  onInsert,
  onUnlockTheEnd,
}: Props) {
  const quest = mining.endQuest;
  const eyes = quest?.eyes ?? 0;
  const linked = !!quest?.linked || eyes >= END_PORTAL_EYE_SLOTS;
  const unlocked = !!quest?.theEndUnlocked;
  const have = getMaterialCount(mining, "ender_eye");
  const justFilled = insertPulse > 0 ? Math.max(0, eyes - 1) : -1;

  return (
    <div className={`mining-portal-stage${shaking ? " is-shake" : ""}${insertPulse ? " is-insert" : ""}`}>
      <div className="mining-portal-count">{eyes}/{END_PORTAL_EYE_SLOTS} はめた</div>
      <div className="mining-portal-frames" aria-hidden>
        {Array.from({ length: END_PORTAL_EYE_SLOTS }, (_, i) => (
          <span key={i} className={`mining-portal-frame-wrap${i === justFilled ? " is-pop" : ""}`}>
            <img
              className="mining-portal-frame"
              src={i < eyes ? FRAME_FILLED : FRAME_EMPTY}
              alt=""
              draggable={false}
            />
          </span>
        ))}
      </div>
      {linked ? (
        <button
          type="button"
          className="mining-portal-end-enter"
          onClick={onUnlockTheEnd}
        >
          <img src={END_PORTAL_LINKED_IMAGE} alt="" draggable={false} />
          <span>
            {unlocked ? "ほりばのジ・エンドへ" : "つながったポータルをタップ"}
          </span>
        </button>
      ) : (
        <button
          type="button"
          className="mining-portal-well-btn"
          onClick={onInsert}
          disabled={have < 1}
        >
          <img
            className="mining-portal-well"
            src={WELL_EMPTY}
            alt=""
            draggable={false}
          />
          {insertPulse > 0 && <span className="mining-eye-insert-burst" aria-hidden />}
          <span className="mining-portal-well-label">
            {have < 1 ? "エンダーアイがないよ" : "タップしてはめる（チケットなし）"}
          </span>
        </button>
      )}
      <div className="mining-portal-have">エンダーアイ 所持 {have}</div>
    </div>
  );
}
