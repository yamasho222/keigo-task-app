/** エンチャント専用パネル（親画面に埋め込み） */

import { useEffect, useMemo, useState } from "react";
import {
  ENCHANT_APPLY_COST,
  ENCHANT_LEVEL_UP_COST,
  applyEnchant,
  enchantLevelBlurb,
  getEnchant,
  levelUpEnchant,
  rollEnchantOffers,
  spendLapisForReroll,
} from "./miningEnchant";
import { MiningItemIcon } from "./MiningItemIcon";
import {
  ENCHANT_META,
  ENCHANT_TARGET_LABEL,
  getMaterialCount,
  parseToolId,
  type CraftedGearId,
  type EnchantId,
  type EnchantTarget,
  type MiningState,
} from "./miningTypes";
import { bestOwnedTool } from "./miningProgress";

function bestOwnedForTargetLocal(
  state: MiningState,
  target: EnchantTarget,
): CraftedGearId | null {
  if (target === "sword" || target === "axe" || target === "pickaxe") {
    return bestOwnedTool(state, target);
  }
  const tiers = ["netherite", "diamond", "gold", "iron"] as const;
  for (const t of tiers) {
    const id = `${target}_${t}` as CraftedGearId;
    if (state.crafted[id]) return id;
  }
  return null;
}

/** いまそうび中の対象装備（なければ最強所持を表示用に） */
function displayGearForTarget(
  state: MiningState,
  target: EnchantTarget,
): { gear: CraftedGearId | null; equipped: boolean } {
  if (target === "sword" || target === "axe" || target === "pickaxe") {
    const tool = state.equipped.tool;
    if (tool && parseToolId(tool)?.kind === target) {
      return { gear: tool, equipped: true };
    }
    return { gear: bestOwnedTool(state, target), equipped: false };
  }
  const eq = state.equipped[target];
  if (eq && state.crafted[eq]) return { gear: eq, equipped: true };
  return { gear: bestOwnedForTargetLocal(state, target), equipped: false };
}

type Props = {
  mining: MiningState;
  onChange: (next: MiningState) => void;
  showToast: (msg: string) => void;
  /** アカウント初回のエンチャント決定直後 */
  onFirstEnchant?: (id: EnchantId) => void;
};

const TARGETS: EnchantTarget[] = [
  "sword",
  "axe",
  "pickaxe",
  "helmet",
  "chest",
  "leggings",
  "boots",
];

const APPLY_SUCCESS_MS = 1100;

type ConfirmDialog =
  | {
      kind: "replace";
      enchantId: EnchantId;
      title: string;
      body: string;
    }
  | {
      kind: "levelUp";
      title: string;
      body: string;
    };

export function MiningEnchantPanel({
  mining,
  onChange,
  showToast,
  onFirstEnchant,
}: Props) {
  const [target, setTarget] = useState<EnchantTarget | null>(null);
  const [offers, setOffers] = useState<[EnchantId, EnchantId] | null>(null);
  const [rerollCount, setRerollCount] = useState(0);
  const [confirm, setConfirm] = useState<ConfirmDialog | null>(null);
  const [applySuccess, setApplySuccess] = useState<{
    target: EnchantTarget;
    id: EnchantId;
    gear: CraftedGearId | null;
    wasFirst: boolean;
  } | null>(null);
  const lapis = getMaterialCount(mining, "lapis");

  const ownedTargets = useMemo(
    () => TARGETS.filter((t) => !!bestOwnedForTargetLocal(mining, t)),
    [mining],
  );

  useEffect(() => {
    if (!applySuccess) return;
    const t = window.setTimeout(() => {
      const done = applySuccess;
      setApplySuccess(null);
      setOffers(null);
      setTarget(null);
      if (done.wasFirst) onFirstEnchant?.(done.id);
    }, APPLY_SUCCESS_MS);
    return () => window.clearTimeout(t);
  }, [applySuccess, onFirstEnchant]);

  const openTarget = (t: EnchantTarget) => {
    if (applySuccess || confirm) return;
    setTarget(t);
    setRerollCount(0);
    if (getEnchant(mining, t)) setOffers(null);
    else setOffers(rollEnchantOffers());
  };

  const current = target ? getEnchant(mining, target) : null;

  const onReroll = () => {
    const r = spendLapisForReroll(mining, rerollCount);
    if (r.error) {
      showToast(r.error);
      return;
    }
    onChange(r.state);
    setOffers(rollEnchantOffers());
    setRerollCount((n) => n + 1);
  };

  const commitApply = (id: EnchantId) => {
    if (!target) return;
    const wasFirst = !mining.firstEnchantClaimed;
    const r = applyEnchant(mining, target, id);
    if (r.error) {
      showToast(r.error);
      return;
    }
    onChange(r.state);
    const shown = displayGearForTarget(r.state, target);
    setApplySuccess({
      target,
      id,
      gear: shown.gear,
      wasFirst,
    });
  };

  const commitLevelUp = () => {
    if (!target) return;
    const r = levelUpEnchant(mining, target);
    if (r.error) {
      showToast(r.error);
      return;
    }
    const e = r.state.enchants[target];
    onChange(r.state);
    if (e) showToast(`${ENCHANT_META[e.id].label} が Lv${e.level} になった！`);
  };

  const onApply = (id: EnchantId) => {
    if (!target || applySuccess || confirm) return;
    if (current) {
      setConfirm({
        kind: "replace",
        enchantId: id,
        title: "つけかえる？",
        body: `いまの「${ENCHANT_META[current.id].label} Lv${current.level}」は消えて、新しいエンチャントが Lv1 になるよ`,
      });
      return;
    }
    commitApply(id);
  };

  const onLevelUp = () => {
    if (!target || !current || confirm) return;
    const nextLevel = (current.level + 1) as 2 | 3;
    const cost = ENCHANT_LEVEL_UP_COST[nextLevel];
    setConfirm({
      kind: "levelUp",
      title: "つよくする？",
      body: `${ENCHANT_META[current.id].label} が Lv${nextLevel} になるよ。ラピス${cost}こ使う`,
    });
  };

  const onConfirmOk = () => {
    if (!confirm) return;
    const pending = confirm;
    setConfirm(null);
    if (pending.kind === "replace") commitApply(pending.enchantId);
    else commitLevelUp();
  };

  const rerollCost = rerollCount === 0 ? 0 : ENCHANT_APPLY_COST;
  const applyCost = mining.firstEnchantClaimed ? ENCHANT_APPLY_COST : 0;

  if (applySuccess) {
    return (
      <div className="mining-enchant-embedded">
        <div className="mining-enchant-success" role="status" aria-live="polite">
          <div className="mining-enchant-success-sparkle" aria-hidden />
          <div className="mining-enchant-success-icon" aria-hidden>
            {applySuccess.gear ? (
              <MiningItemIcon gear={applySuccess.gear} size={56} alt="" />
            ) : (
              <span className="mining-enchant-target-placeholder">✨</span>
            )}
          </div>
          <div className="mining-enchant-success-title">エンチャントがついた！</div>
          <div className="mining-enchant-success-sub">
            {ENCHANT_TARGET_LABEL[applySuccess.target]} · {ENCHANT_META[applySuccess.id].label}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mining-enchant-embedded">
      {confirm && (
        <div
          className="mining-confirm-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mining-enchant-confirm-title"
        >
          <div className="mining-confirm-sheet">
            <div id="mining-enchant-confirm-title" className="mining-confirm-title">
              {confirm.title}
            </div>
            <div className="mining-confirm-body">{confirm.body}</div>
            <button type="button" className="mining-confirm-ok" onClick={onConfirmOk}>
              {confirm.kind === "replace" ? "つける" : "つよくする"}
            </button>
            <button
              type="button"
              className="mining-confirm-cancel"
              onClick={() => setConfirm(null)}
            >
              やめる
            </button>
          </div>
        </div>
      )}

      <div className="mining-enchant-head">
        <div>
          <div className="mining-enchant-sub">どうぐやぼうぐに効果をつけるよ</div>
          <div className="mining-enchant-slot-note">
            剣なら、木でもネザライトでも同じ効果がつくよ
          </div>
        </div>
        <div className="mining-enchant-lapis">🔵 ラピス {lapis}</div>
      </div>

      {!target && (
        <>
          <div className="mining-enchant-section">どれにつける？</div>
          <div className="mining-enchant-targets">
            {ownedTargets.map((t) => {
              const e = getEnchant(mining, t);
              const shown = displayGearForTarget(mining, t);
              return (
                <button
                  key={t}
                  type="button"
                  className="mining-enchant-target"
                  onClick={() => openTarget(t)}
                >
                  <span className="mining-enchant-target-main">
                    {shown.gear ? (
                      <MiningItemIcon gear={shown.gear} size={28} alt="" />
                    ) : (
                      <span className="mining-enchant-target-placeholder">？</span>
                    )}
                    <span className="mining-enchant-target-text">
                      <span>{ENCHANT_TARGET_LABEL[t]}</span>
                      <span className="mining-enchant-target-equip">
                        {shown.equipped ? "そうび中" : "そうびしてから効く"}
                      </span>
                    </span>
                  </span>
                  <span className="mining-enchant-target-meta">
                    {e
                      ? `${ENCHANT_META[e.id].label} Lv${e.level}`
                      : "まだない"}
                  </span>
                </button>
              );
            })}
            {ownedTargets.length === 0 && (
              <div className="mining-enchant-empty">どうぐやぼうぐを作ってからね</div>
            )}
          </div>
        </>
      )}

      {target && current && !offers && (
        <div className="mining-enchant-current">
          <div className="mining-enchant-current-name">
            {ENCHANT_TARGET_LABEL[target]}：{ENCHANT_META[current.id].label} Lv{current.level}
          </div>
          <div className="mining-enchant-blurb">
            {enchantLevelBlurb(current.id, current.level)}
          </div>
          {current.level < 3 && (
            <button type="button" className="mining-enchant-primary" onClick={onLevelUp}>
              つよくする（ラピス{ENCHANT_LEVEL_UP_COST[(current.level + 1) as 2 | 3]}）
            </button>
          )}
          {current.level >= 3 && (
            <div className="mining-enchant-max">さいきょう！</div>
          )}
          <button
            type="button"
            className="mining-enchant-secondary"
            onClick={() => {
              setOffers(rollEnchantOffers());
              setRerollCount(0);
            }}
          >
            べつのエンチャントにする
          </button>
          <button
            type="button"
            className="mining-enchant-secondary"
            onClick={() => {
              setTarget(null);
              setOffers(null);
            }}
          >
            もどる
          </button>
        </div>
      )}

      {target && offers && (
        <>
          <div className="mining-enchant-section">
            どっち？ · {ENCHANT_TARGET_LABEL[target]}
            {applyCost === 0 && (
              <span className="mining-enchant-free">（はじめては無料！）</span>
            )}
          </div>
          <div className="mining-enchant-offers">
            {offers.map((id) => (
              <button
                key={id}
                type="button"
                className="mining-enchant-offer is-primary-pick"
                onClick={() => onApply(id)}
              >
                <div className="mining-enchant-offer-name">{ENCHANT_META[id].label}</div>
                <div className="mining-enchant-offer-blurb">{ENCHANT_META[id].blurb}</div>
                <div className="mining-enchant-offer-cta">
                  これにきめる（ラピス{applyCost}）
                </div>
              </button>
            ))}
          </div>
          <button type="button" className="mining-enchant-secondary" onClick={onReroll}>
            とりなおす
            {rerollCost === 0 ? "（1回め無料）" : `（ラピス${rerollCost}）`}
          </button>
        </>
      )}
    </div>
  );
}
