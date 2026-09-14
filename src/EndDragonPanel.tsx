/** ジ・エンド：エンドラ戦（ハートは使わない） */

import { useEffect, useRef, useState } from "react";
import {
  CRYSTAL_MAX_HP,
  DRAGON_MAX_HP,
  dragonHitDamage,
  ensureDragonFight,
  livingCrystalCount,
  type DragonTarget,
} from "./endChapter";
import { DamageFloater, DragonBreathBurst, ExplosionBurst, IncomingHitFx, SlashBurst, type IncomingKind } from "./endFx";
import { SpecialGaugeBar } from "./CombatOverlays";
import { combatSwordId, combatSwordImage } from "./miningCombat";
import { getMaterialCount, type MiningState } from "./miningTypes";
import type { BuddyProgressMap } from "./buddyProgress";
import { PlayerCombatHud } from "./PlayerCombatHud";
import { canPlayerFight, specialGaugeReady } from "./playerCombat";

const DRAGON_IMAGE = "/mining/Ender_Dragon.gif";
const CRYSTAL_IMAGE = "/mining/End_Crystal.jpg";
const BED_IMAGE = "/mining/White_Bed.png";

const CRYSTAL_POS = [
  { top: "2%", left: "41%" },
  { top: "16%", left: "72%" },
  { top: "41%", left: "80%" },
  { top: "66%", left: "72%" },
  { top: "80%", left: "41%" },
  { top: "66%", left: "10%" },
  { top: "41%", left: "2%" },
  { top: "16%", left: "10%" },
];

export type DragonFx = {
  seq: number;
  target: DragonTarget;
  damage: number;
  heal: number;
  swings: number;
  usedBed: boolean;
  crystalDestroyed: boolean;
  emphasis: "normal" | "hit" | "jackpot";
  heavy: boolean;
};

type Props = {
  mining: MiningState;
  buddyProgress?: BuddyProgressMap;
  busy: boolean;
  tickets: number;
  selected: DragonTarget;
  fx: DragonFx | null;
  takenHearts: number | null;
  playerDied: boolean;
  heavyHit: boolean;
  incoming: { kind: IncomingKind; hearts: number } | null;
  onSelect: (target: DragonTarget) => void;
  onPick: (index: number) => void;
  onBed: () => void;
  onRevive: () => void;
  onFlee: () => void;
  onFireSpecial: () => void;
};

function HpBar({ hp, max, compact }: { hp: number; max: number; compact?: boolean }) {
  const pct = Math.max(0, Math.min(100, (hp / Math.max(1, max)) * 100));
  return (
    <div className={`mining-dragon-bar${compact ? " is-compact" : ""}`}>
      <div className="mining-dragon-bar-fill" style={{ width: `${pct}%` }} />
      <span className="mining-dragon-bar-num">{hp}/{max}</span>
    </div>
  );
}

export function EndDragonPanel({
  mining,
  buddyProgress,
  busy,
  tickets,
  selected,
  fx,
  takenHearts,
  playerDied,
  heavyHit,
  incoming,
  onSelect,
  onPick,
  onBed,
  onRevive,
  onFlee,
  onFireSpecial,
}: Props) {
  const state = ensureDragonFight(mining);
  const fight = state.dragonFight!;
  const swordId = combatSwordId(mining);
  const swordImg = combatSwordImage(mining);
  const beds = getMaterialCount(mining, "spare_bed");
  const hit = dragonHitDamage(mining, buddyProgress);
  const living = livingCrystalCount(fight);
  const fighting = canPlayerFight(mining) && !playerDied;
  const [swingPose, setSwingPose] = useState(false);
  const goneRef = useRef<boolean[]>(Array.from({ length: fight.crystals.length }, () => false));
  if (fight.crystals.every((hp) => hp >= CRYSTAL_MAX_HP)) {
    goneRef.current = fight.crystals.map(() => false);
  }
  fight.crystals.forEach((hp, i) => {
    if (hp <= 0) goneRef.current[i] = true;
  });
  const fxActive = !!fx && busy;
  const bedBoom = fxActive && !!fx?.usedBed;
  const dragonHit = fxActive && (fx?.target === "dragon" || !!fx?.usedBed);
  const breath = fxActive && !!fx?.heavy;
  const incomingOn = !!incoming;
  const strike = incomingOn && !bedBoom;

  useEffect(() => {
    if (!busy) {
      setSwingPose(false);
      return;
    }
    setSwingPose(true);
    const t = window.setTimeout(() => setSwingPose(false), 220);
    return () => window.clearTimeout(t);
  }, [busy, fx?.seq]);

  if (fight.defeated && !busy) {
    return (
      <div className="mining-dragon-stage">
        <div className="mining-dragon-win">エンドラをたおした！</div>
        <div className="mining-dragon-win-sub">ジ・エンドを守りぬいた</div>
      </div>
    );
  }

  return (
    <div className={`mining-dragon-stage${fighting ? "" : " is-player-down"}${incomingOn ? " is-shake" : ""}`}>
      {incoming && (
        <IncomingHitFx kind={incoming.kind} hearts={incoming.hearts} active />
      )}
      <div className="mining-dragon-toolbar">
        <div className={`mining-dragon-tickets${tickets < 1 ? " is-empty" : ""}`}>🎫 {tickets}</div>
        <div className="mining-dragon-hit">1振り {hit}</div>
      </div>

      <div className={`mining-dragon-arena${bedBoom ? " is-explode" : ""}${breath ? " is-breath" : ""}`}>
        {fight.crystals.map((hp, i) => {
          const isHit = fxActive && fx?.target === i && !fx.usedBed;
          const bursting = fxActive && !fx?.usedBed && fx?.target === i && fx.crystalDestroyed;
          const gone = (hp <= 0 || goneRef.current[i]) && !bursting;
          return (
            <button
              key={i}
              type="button"
              className={`mining-dragon-crystal${selected === i ? " is-selected" : ""}${gone ? " is-gone" : ""}${isHit ? " is-hit" : ""}`}
              style={CRYSTAL_POS[i]}
              hidden={gone}
              disabled={busy || hp <= 0 || gone || !fighting}
              onClick={() => onSelect(i)}
            >
              <img src={CRYSTAL_IMAGE} alt="" draggable={false} />
              <HpBar hp={Math.max(0, hp)} max={CRYSTAL_MAX_HP} compact />
              <SlashBurst
                swings={fx?.swings ?? 1}
                active={isHit && !incomingOn}
                compact
                emphasis={fx?.emphasis ?? "normal"}
                seed={fx?.seq ?? 1}
              />
              <DamageFloater
                damage={fx?.damage ?? 0}
                active={isHit}
                emphasis={fx?.emphasis ?? "normal"}
              />
              <ExplosionBurst active={bursting} size="sm" />
            </button>
          );
        })}
        <button
          type="button"
          className={`mining-dragon-boss${selected === "dragon" ? " is-selected" : ""}${dragonHit ? " is-hit" : ""}${bedBoom ? " is-bed-boom" : ""}${breath ? " is-breath" : ""}${strike ? " is-striking" : ""}${fight.defeated ? " is-fall" : ""}`}
          disabled={busy}
          onClick={() => onSelect("dragon")}
        >
          <img src={DRAGON_IMAGE} alt="" draggable={false} />
          <SlashBurst
            swings={fx?.swings ?? 1}
            active={fxActive && fx?.target === "dragon" && !fx.usedBed && !incomingOn}
            emphasis={fx?.emphasis ?? "normal"}
            seed={fx?.seq ?? 1}
          />
          <ExplosionBurst active={bedBoom} size="xl" />
          <DragonBreathBurst active={breath} />
          <DamageFloater
            damage={fx?.damage ?? 0}
            heal={fx?.heal}
            active={dragonHit && !bedBoom}
            emphasis={fx?.emphasis ?? "normal"}
          />
        </button>
        {bedBoom && (fx?.damage ?? 0) > 0 && (
          <div className="mining-dragon-big-dmg" aria-hidden>
            -{fx?.damage}
          </div>
        )}
      </div>

      <HpBar hp={fight.hp} max={DRAGON_MAX_HP} />
      <div className="mining-dragon-crystal-note">結晶 のこり {living}本（本体をたたくと×{living * 5}回復）</div>

      {!swordId && (
        <div className="mining-combat-need-sword">剣を作ってからたたこう</div>
      )}
      <PlayerCombatHud
        mining={mining}
        takenHearts={takenHearts}
        died={playerDied || !canPlayerFight(mining)}
        heavy={heavyHit || breath}
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
      <div className="mining-dragon-picks">
        <button
          type="button"
          className="mining-dragon-flee"
          disabled={busy}
          onClick={onFlee}
        >
          逃げる
        </button>
        {beds >= 1 ? (
          <button
            type="button"
            className="mining-dragon-bed"
            disabled={busy || tickets < 1 || !fighting}
            onClick={onBed}
          >
            <img src={BED_IMAGE} alt="" draggable={false} />
            ベッド {beds}
          </button>
        ) : (
          <span />
        )}
        <div className="mining-rock-hero-row">
          {(["左", "まんなか", "みぎ"] as const).map((label, i) => (
            <button
              key={label}
              type="button"
              className={`mining-rock-tile v${i}${swingPose ? " is-combat-swing" : ""}`}
              disabled={busy || tickets < 1 || !swordId || !fighting}
              onClick={() => onPick(i)}
            >
              <span className="mining-rock-tile-face" aria-hidden>
                <img className="mining-rock-tile-img" src={swordImg} alt="" draggable={false} />
              </span>
              <span className="mining-rock-tile-label">{label}</span>
            </button>
          ))}
        </div>
      </div>
      {tickets < 1 && (
        <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800 }}>チケットが足りないよ。画面をとじてまたこよう</div>
      )}
    </div>
  );
}
