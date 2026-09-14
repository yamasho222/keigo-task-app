/** 歪んだ森／要塞の戦闘3択 */

import { useEffect, useState } from "react";
import { SpecialGaugeBar } from "./CombatOverlays";
import { DamageFloater, IncomingHitFx, SlashBurst, type IncomingKind, type SlashEmphasis } from "./endFx";
import type { HelmetRockHint } from "./miningProgress";
import type { MiningState } from "./miningTypes";
import {
  BLAZE_IMAGE,
  ENDERMAN_IMAGE,
  combatHeartCount,
  combatMaxHp,
  combatSwordId,
  combatSwordImage,
  visibleCombatEncounter,
  type CombatGachaId,
} from "./miningCombat";
import { HeartRow, PlayerCombatHud } from "./PlayerCombatHud";
import { canPlayerFight, specialGaugeReady } from "./playerCombat";

type Props = {
  mining: MiningState;
  gacha: CombatGachaId;
  hint: HelmetRockHint;
  busy: boolean;
  fallen: number[];
  flash: number[];
  gone: number[];
  swings: number;
  hitDamage?: number;
  emphasis?: SlashEmphasis;
  slashSeed?: number;
  tickets: number;
  takenHearts: number | null;
  playerDied: boolean;
  incoming: { kind: IncomingKind; hearts: number } | null;
  striking: number[];
  onFireSpecial: () => void;
  onPick: (index: number) => void;
  onRevive: () => void;
};

export function MiningCombatPanel({
  mining,
  gacha,
  hint,
  busy,
  fallen,
  flash,
  gone,
  swings,
  hitDamage = 0,
  emphasis = "normal",
  slashSeed = 1,
  tickets,
  takenHearts,
  playerDied,
  incoming,
  striking,
  onFireSpecial,
  onPick,
  onRevive,
}: Props) {
  const encounter = visibleCombatEncounter(mining, gacha);
  const sprite = gacha === "warped_forest" ? ENDERMAN_IMAGE : BLAZE_IMAGE;
  const hearts = combatHeartCount(gacha);
  const maxHp = combatMaxHp(gacha);
  const swordId = combatSwordId(mining);
  const swordImg = combatSwordImage(mining);
  const fighting = canPlayerFight(mining) && !playerDied;
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

  const incomingOn = !!incoming;
  const shake = incomingOn;

  return (
    <div className={`mining-combat-stage${fighting ? "" : " is-player-down"}${shake ? " is-shake" : ""}`}>
      {incoming && (
        <IncomingHitFx kind={incoming.kind} hearts={incoming.hearts} active />
      )}
      <div className="mining-combat-mobs">
        {encounter.mobs.map((mob, i) => {
          const isGone = gone.includes(i);
          const isFallen = (fallen.includes(i) || (mob.hp <= 0 && !busy)) && !isGone;
          const isHit = flash.includes(i);
          const isStrike = striking.includes(i);
          return (
            <div
              key={`${encounter.wave ?? 0}-${i}`}
              className={`mining-combat-mob${gacha === "fortress" ? " is-blaze" : " is-enderman"}${isHit ? " is-flash" : ""}${isStrike ? " is-striking" : ""}${isGone ? " is-gone" : ""}`}
            >
              <div className={`mining-combat-sprite-wrap${isFallen ? " is-fallen" : ""}`}>
                <img className="mining-combat-sprite" src={sprite} alt="" draggable={false} />
                <SlashBurst
                  swings={swings}
                  active={isHit && busy && !incomingOn}
                  emphasis={emphasis}
                  seed={slashSeed}
                />
                <DamageFloater
                  damage={hitDamage}
                  active={isHit && busy && !incomingOn}
                  emphasis={emphasis}
                  stay={emphasis === "jackpot"}
                />
              </div>
              <HeartRow hp={mob.hp} hearts={hearts} />
              <div className="mining-combat-hp-num">{mob.hp}/{maxHp}</div>
            </div>
          );
        })}
      </div>

      {!swordId && (
        <div className="mining-combat-need-sword">剣を作ってからたたこう</div>
      )}
      <PlayerCombatHud
        mining={mining}
        takenHearts={takenHearts}
        died={playerDied || !canPlayerFight(mining)}
        busy={busy}
        tickets={tickets}
        onRevive={onRevive}
        hideDown
      />
      <SpecialGaugeBar
        mining={mining}
        ready={specialGaugeReady(mining)}
        disabled={busy || !fighting}
        onFire={onFireSpecial}
      />
      <div className="mining-rock-hero-row">
        {(["左", "まんなか", "みぎ"] as const).map((label, i) => {
          const isHitHint = hint.kind === "hit" && hint.index === i;
          const isMissHint = hint.kind === "miss" && hint.index === i;
          return (
            <button
              key={label}
              type="button"
              className={`mining-rock-tile v${i}${isHitHint ? " is-glow" : ""}${isMissHint ? " is-miss-hint" : ""}${swingPose ? " is-combat-swing" : ""}`}
              disabled={busy || tickets < 1 || !swordId || !fighting}
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
