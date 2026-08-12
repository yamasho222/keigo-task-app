/** まほうをかける専用パネル */

import { useMemo, useState } from "react";
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
import {
  ENCHANT_META,
  ENCHANT_TARGET_LABEL,
  getMaterialCount,
  type EnchantId,
  type EnchantTarget,
  type MiningState,
} from "./miningTypes";
import { bestOwnedTool } from "./miningProgress";

function bestOwnedForTargetLocal(
  state: MiningState,
  target: EnchantTarget,
): string | null {
  if (target === "sword" || target === "axe" || target === "pickaxe") {
    return bestOwnedTool(state, target);
  }
  const tiers = ["netherite", "diamond", "gold", "iron"] as const;
  for (const t of tiers) {
    const id = `${target}_${t}` as const;
    if (state.crafted[id]) return id;
  }
  return null;
}

type Props = {
  mining: MiningState;
  onChange: (next: MiningState) => void;
  onClose: () => void;
  showToast: (msg: string) => void;
  /** アカウント初回のまほう決定直後 */
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

export function MiningEnchantPanel({
  mining,
  onChange,
  onClose,
  showToast,
  onFirstEnchant,
}: Props) {
  const [target, setTarget] = useState<EnchantTarget | null>(null);
  const [offers, setOffers] = useState<[EnchantId, EnchantId] | null>(null);
  const [rerollCount, setRerollCount] = useState(0);
  const lapis = getMaterialCount(mining, "lapis");

  const ownedTargets = useMemo(
    () => TARGETS.filter((t) => !!bestOwnedForTargetLocal(mining, t)),
    [mining],
  );

  const openTarget = (t: EnchantTarget) => {
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

  const onApply = (id: EnchantId) => {
    if (!target) return;
    if (current) {
      const ok = window.confirm(
        `いまの「${ENCHANT_META[current.id].label} Lv${current.level}」は消えて、新しいまほうが Lv1 になるよ。つける？`,
      );
      if (!ok) return;
    }
    const wasFirst = !mining.firstEnchantClaimed;
    const r = applyEnchant(mining, target, id);
    if (r.error) {
      showToast(r.error);
      return;
    }
    onChange(r.state);
    showToast(`${ENCHANT_META[id].label} をつけた！`);
    setOffers(null);
    setTarget(null);
    if (wasFirst) onFirstEnchant?.(id);
  };

  const onLevelUp = () => {
    if (!target || !current) return;
    const nextLevel = (current.level + 1) as 2 | 3;
    const cost = ENCHANT_LEVEL_UP_COST[nextLevel];
    const ok = window.confirm(
      `${ENCHANT_META[current.id].label} が Lv${nextLevel} になるよ。ラピス${cost}こ使う`,
    );
    if (!ok) return;
    const r = levelUpEnchant(mining, target);
    if (r.error) {
      showToast(r.error);
      return;
    }
    const e = r.state.enchants[target];
    onChange(r.state);
    if (e) showToast(`${ENCHANT_META[e.id].label} が Lv${e.level} になった！`);
  };

  const rerollCost = rerollCount === 0 ? 0 : ENCHANT_APPLY_COST;
  const applyCost = mining.firstEnchantClaimed ? ENCHANT_APPLY_COST : 0;

  return (
    <div className="mining-enchant-backdrop" role="dialog" aria-label="まほうをかける">
      <div className="mining-enchant-sheet">
        <div className="mining-enchant-head">
          <div>
            <div className="mining-enchant-title">まほうをかける</div>
            <div className="mining-enchant-sub">はじめてのときは「まほう（エンチャント）」だよ</div>
          </div>
          <div className="mining-enchant-lapis">🔵 ラピス {lapis}</div>
        </div>

        {!target && (
          <>
            <div className="mining-enchant-section">どれにつける？</div>
            <div className="mining-enchant-targets">
              {ownedTargets.map((t) => {
                const e = getEnchant(mining, t);
                return (
                  <button
                    key={t}
                    type="button"
                    className="mining-enchant-target"
                    onClick={() => openTarget(t)}
                  >
                    <span>{ENCHANT_TARGET_LABEL[t]}</span>
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
              べつのまほうにする
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
              {ENCHANT_TARGET_LABEL[target]} にどれをつける？
              {applyCost === 0 && (
                <span className="mining-enchant-free">（はじめては無料！）</span>
              )}
            </div>
            <div className="mining-enchant-offers">
              {offers.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="mining-enchant-offer"
                  onClick={() => onApply(id)}
                >
                  <div className="mining-enchant-offer-name">{ENCHANT_META[id].label}</div>
                  <div className="mining-enchant-offer-blurb">{ENCHANT_META[id].blurb}</div>
                  <div className="mining-enchant-offer-cost">
                    これにきめる（ラピス{applyCost}）
                  </div>
                </button>
              ))}
            </div>
            <button type="button" className="mining-enchant-secondary" onClick={onReroll}>
              とりなおす
              {rerollCost === 0 ? "（1回め無料）" : `（ラピス${rerollCost}）`}
            </button>
            <button
              type="button"
              className="mining-enchant-secondary"
              onClick={() => {
                if (current) {
                  setOffers(null);
                } else {
                  setTarget(null);
                  setOffers(null);
                }
              }}
            >
              もどる
            </button>
          </>
        )}

        <button type="button" className="mining-enchant-close" onClick={onClose}>
          とじる
        </button>
      </div>
    </div>
  );
}
