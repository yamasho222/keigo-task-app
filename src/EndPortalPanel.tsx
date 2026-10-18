/** Twelve tappable frames. The picture itself is the insertion control. */
import { END_PORTAL_EYE_SLOTS, ensureEndQuest } from "./endChapter";
import { portalEyeSlots } from "./endJourneyProgress";
import { END_PORTAL_LINKED_IMAGE } from "./endFx";
import { getMaterialCount, type MiningState } from "./miningTypes";

const POSITIONS = [[1, 2], [1, 3], [1, 4], [2, 5], [3, 5], [4, 5], [5, 4], [5, 3], [5, 2], [4, 1], [3, 1], [2, 1]];
type Props = {
  mining: MiningState; shaking: boolean; insertPulse: number;
  onInsert: (slot: number) => void; onUnlockTheEnd: () => void; onCraft?: () => void;
};

export function EndPortalPanel({ mining, shaking, insertPulse, onInsert, onUnlockTheEnd, onCraft }: Props) {
  const quest = ensureEndQuest(mining), eyes = quest.eyes;
  const slots = portalEyeSlots(quest);
  const linked = quest.linked || eyes >= END_PORTAL_EYE_SLOTS;
  const have = getMaterialCount(mining, "ender_eye");
  const justFilled = insertPulse > 0 ? quest.lastEyeSlot ?? slots.at(-1) : -1;
  return <div className={`mining-portal-stage${shaking ? " is-shake" : ""}`}>
    <div className="mining-portal-count" role="status" aria-live="polite">{eyes}/12 はめた</div>
    <div className={`end-portal-map${linked ? " is-linked" : ""}`} aria-label="ポータルの12枠">
      <div className="end-portal-center" aria-hidden="true"><span>{linked ? "✦" : "✧"}</span></div>
      {POSITIONS.map(([row, col], i) => {
        const filled = slots.includes(i);
        return <button type="button" key={i} className={`end-portal-slot${filled ? " is-filled" : ""}${!filled && have > 0 ? " is-ready" : ""}${justFilled === i ? " is-pop" : ""}`}
          style={{ gridRow: row, gridColumn: col }} aria-label={filled ? `枠${i + 1}、アイがはまっている` : `アイをはめる 枠${i + 1}`}
          disabled={filled || linked || have < 1 || shaking} onClick={() => onInsert(i)}>
          <img src={filled ? "/mining/End_Portal_Frame_Filled.webp" : "/mining/End_Portal_Frame.webp"} alt="" draggable={false} />
          {!filled && have > 0 && <span className="end-portal-tap-cue" aria-hidden="true">＋</span>}
          {justFilled === i && <img key={insertPulse} className="end-portal-flying-eye" src="/mining/Eye_of_Ender.png" alt="" />}
        </button>;
      })}
    </div>
    {linked ? <button type="button" className="mining-portal-end-enter" onClick={onUnlockTheEnd}>
      <img src={END_PORTAL_LINKED_IMAGE} alt="" draggable={false} /><span>{quest.theEndUnlocked ? "ジ・エンドへ" : "ポータルのむこうへ"}</span>
    </button> : <div className="end-portal-instruction">
      <img src="/mining/Eye_of_Ender.png" alt="" /><span>{have > 0 ? "ひかる わくを タップ！" : "エンダーアイがないよ"}<small>チケットは つかわないよ</small></span>
    </div>}
    <div className="mining-portal-have">エンダーアイ 所持 {have}</div>
    {!linked && have < 1 && onCraft && <button type="button" className="end-journey-craft-link" onClick={onCraft}>材料をあつめて、アイをつくろう →</button>}
  </div>;
}
