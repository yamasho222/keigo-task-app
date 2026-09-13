/** 歪んだ森／要塞の戦闘3択 */

import { useEffect, useState } from "react";
import type { HelmetRockHint } from "./miningProgress";
import type { MiningState } from "./miningTypes";
import {
  BLAZE_IMAGE,
  ENDERMAN_IMAGE,
  HEART_FULL_IMAGE,
  HEART_HALF_IMAGE,
  combatHeartCount,
  combatMaxHp,
  combatSwordId,
  combatSwordImage,
  ensureCombatEncounter,
  heartSlots,
  type CombatGachaId,
} from "./miningCombat";

type Props = {
  mining: MiningState;
  gacha: CombatGachaId;
  hint: HelmetRockHint;
  busy: boolean;
  fallen: number[];
  flash: number[];
  tickets: number;
  onPick: (index: number) => void;
};

function HeartRow({ hp, hearts }: { hp: number; hearts: number }) {
  const slots = heartSlots(hp, hearts);
  const mid = Math.ceil(slots.length / 2);
  const rows = slots.length > 10 ? [slots.slice(0, mid), slots.slice(mid)] : [slots];
  return (
    <div className="mining-combat-hearts">
      {rows.map((row, ri) => (
        <div key={ri} className="mining-combat-heart-row">
          {row.map((kind, i) => (
            kind === "empty" ? (
              <span key={`${ri}-${i}`} className="mining-combat-heart is-empty" />
            ) : (
              <img
                key={`${ri}-${i}`}
                className="mining-combat-heart"
                src={kind === "half" ? HEART_HALF_IMAGE : HEART_FULL_IMAGE}
                alt=""
                draggable={false}
              />
            )
          ))}
        </div>
      ))}
    </div>
  );
}

export function MiningCombatPanel({
  mining,
  gacha,
  hint,
  busy,
  fallen,
  flash,
  tickets,
  onPick,
}: Props) {
  const encounter = ensureCombatEncounter(mining, gacha);
  const sprite = gacha === "warped_forest" ? ENDERMAN_IMAGE : BLAZE_IMAGE;
  const hearts = combatHeartCount(gacha);
  const maxHp = combatMaxHp(gacha);
  const swordId = combatSwordId(mining);
  const swordImg = combatSwordImage(mining);
  const [swingPose, setSwingPose] = useState(false);

  useEffect(() => {
    if (!busy) {
      setSwingPose(false);
      return;
    }
    setSwingPose(true);
    const t = window.setTimeout(() => setSwingPose(false), 180);
    return () => window.clearTimeout(t);
  }, [busy, flash.join(",")]);

  return (
    <div className="mining-combat-stage">
      <div className="mining-combat-mobs">
        {encounter.mobs.map((mob, i) => (
          <div
            key={i}
            className={`mining-combat-mob${flash.includes(i) ? " is-flash" : ""}${fallen.includes(i) || mob.hp <= 0 ? " is-fallen" : ""}`}
          >
            <img className="mining-combat-sprite" src={sprite} alt="" draggable={false} />
            <HeartRow hp={mob.hp} hearts={hearts} />
            <div className="mining-combat-hp-num">{mob.hp}/{maxHp}</div>
          </div>
        ))}
      </div>

      <div className="mining-rock-pick-stage-title">どれをたたく？</div>
      <div className="mining-rock-pick-stage-sub">あたりはひみつ。すきなのを選ぼう</div>
      {!swordId && (
        <div className="mining-combat-need-sword">剣を作ってからたたこう</div>
      )}
      <div className="mining-rock-hero-row">
        {(["左", "まんなか", "みぎ"] as const).map((label, i) => {
          const isHitHint = hint.kind === "hit" && hint.index === i;
          const isMissHint = hint.kind === "miss" && hint.index === i;
          return (
            <button
              key={label}
              type="button"
              className={`mining-rock-tile v${i}${isHitHint ? " is-glow" : ""}${isMissHint ? " is-miss-hint" : ""}${swingPose ? " is-combat-swing" : ""}`}
              disabled={busy || tickets < 1 || !swordId}
              onClick={() => onPick(i)}
            >
              <span className="mining-rock-tile-face" aria-hidden>
                <img className="mining-rock-tile-img" src={swordImg} alt="" draggable={false} />
              </span>
              <span className="mining-rock-tile-label">{label}</span>
              {isMissHint && <span className="mining-rock-tile-badge is-miss">普通</span>}
              {isHitHint && <span className="mining-rock-tile-badge is-hit">大当たり</span>}
            </button>
          );
        })}
      </div>
      {tickets < 1 && (
        <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800 }}>チケットが足りないよ</div>
      )}
      {hint.kind === "hit" && (
        <div className="mining-rock-pick-lucky-hint">ヘルメットのヒント：キラッと光る剣が大当たりだよ</div>
      )}
      {hint.kind === "miss" && (
        <div className="mining-rock-pick-lucky-hint">ヘルメットのヒント：うすい剣は普通だよ</div>
      )}
    </div>
  );
}
