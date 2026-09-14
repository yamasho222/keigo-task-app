/** 戦闘中のプレイヤーハート・カット%・起き上がり */

import {
  HEART_FULL_IMAGE,
  HEART_HALF_IMAGE,
  heartSlots,
} from "./miningCombat";
import {
  PLAYER_MAX_HEARTS,
  PLAYER_MAX_HP,
  armorCutPercent,
  playerHpOf,
} from "./playerCombat";
import type { MiningState } from "./miningTypes";

export function HeartRow({
  hp,
  hearts,
  player = false,
}: {
  hp: number;
  hearts: number;
  player?: boolean;
}) {
  const slots = heartSlots(hp, hearts);
  const mid = Math.ceil(slots.length / 2);
  const rows = slots.length > 10 ? [slots.slice(0, mid), slots.slice(mid)] : [slots];
  return (
    <div className={`mining-combat-hearts${player ? " is-player" : ""}`}>
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

type Props = {
  mining: MiningState;
  takenHearts: number | null;
  died: boolean;
  heavy?: boolean;
  busy: boolean;
  tickets: number;
  onRevive: () => void;
  hideDown?: boolean;
};

export function PlayerCombatHud({
  mining,
  takenHearts,
  died,
  heavy = false,
  busy,
  tickets,
  onRevive,
  hideDown = false,
}: Props) {
  const hp = playerHpOf(mining);
  const cut = armorCutPercent(mining);
  const down = died || hp <= 0;
  return (
    <div className={`mining-player-hud${down ? " is-down" : ""}`}>
      <div className="mining-player-hud-row">
        <HeartRow hp={hp} hearts={PLAYER_MAX_HEARTS} player />
        <span className="mining-player-hud-hp">{hp / 2}/{PLAYER_MAX_HEARTS}</span>
        <span className="mining-player-hud-cut">カット {cut}%</span>
      </div>
      {takenHearts != null && takenHearts > 0 && (
        <div className={`mining-player-hud-hit${heavy ? " is-heavy" : ""}`}>
          -{takenHearts}{heavy ? " ブレス" : ""}
        </div>
      )}
      {takenHearts === 0 && !down && (
        <div className={`mining-player-hud-hit is-zero${heavy ? " is-heavy" : ""}`}>
          {heavy ? "ブレス 0ダメ" : "0ダメ"}
        </div>
      )}
      {down && !hideDown && (
        <div className="mining-player-down">
          <div className="mining-player-down-title">倒された！</div>
          <div className="mining-player-down-sub">
            {tickets < 1
              ? "チケットがあれば起き上がれる。戻ってもよい"
              : "チケット1枚で起き上がる。殴るにはもう1枚"}
          </div>
          <button
            type="button"
            className="mining-player-revive"
            disabled={busy || tickets < 1}
            onClick={onRevive}
          >
            チケットで起き上がる
          </button>
        </div>
      )}
    </div>
  );
}

export const PLAYER_HUD_MAX_HP = PLAYER_MAX_HP;
