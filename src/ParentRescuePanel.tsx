/** 親の救済メニュー（パスワード＋チケット／ごほうび増減） */

import { useState, type CSSProperties } from "react";
import { theme } from "./theme";
import {
  isValidNewParentRescuePassword,
  verifyParentRescuePassword,
} from "./parentRescueAuth";
import {
  EMPTY_REWARD_TICKETS,
  REWARD_TICKET_KINDS,
  rewardTicketLabel,
  type RewardTicketInventory,
  type RewardTicketKind,
} from "./rewardTickets";
import { RARITY_META } from "./rarityMeta";

type Props = {
  /** 解決済みの現行パスワード */
  password: string;
  miningTickets: number;
  rewardTickets: RewardTicketInventory;
  onAdjustMiningTickets: (delta: number) => void;
  onAdjustRewardTicket: (kind: RewardTicketKind, delta: number) => void;
  miningNightLockEnabled: boolean;
  onToggleMiningNightLock: (enabled: boolean) => void;
  onChangePassword: (next: string) => void;
  onClose: () => void;
};

const PRESETS = [1, 5, 10] as const;

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 14px",
  borderRadius: 12,
  border: `1.5px solid ${theme.stroke.secondary}`,
  fontSize: 16,
  fontWeight: 700,
  marginBottom: 8,
};

export function ParentRescuePanel({
  password: currentPassword,
  miningTickets,
  rewardTickets,
  onAdjustMiningTickets,
  onAdjustRewardTicket,
  miningNightLockEnabled,
  onToggleMiningNightLock,
  onChangePassword,
  onClose,
}: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [gateInput, setGateInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState("1");
  const [showPwChange, setShowPwChange] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNext, setPwNext] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState<string | null>(null);
  const [pendingMining, setPendingMining] = useState(0);
  const [pendingRewards, setPendingRewards] = useState<RewardTicketInventory>({
    ...EMPTY_REWARD_TICKETS,
  });
  const [applyOk, setApplyOk] = useState<string | null>(null);

  const amount = (() => {
    const n = Math.floor(Number(customAmount));
    return Number.isFinite(n) && n > 0 ? n : 1;
  })();
  const hasPending =
    pendingMining !== 0
    || REWARD_TICKET_KINDS.some((kind) => pendingRewards[kind] !== 0);

  const stageMining = (delta: number) => {
    setApplyOk(null);
    setPendingMining((prev) => Math.max(-miningTickets, prev + delta));
  };

  const stageReward = (kind: RewardTicketKind, delta: number) => {
    setApplyOk(null);
    setPendingRewards((prev) => ({
      ...prev,
      [kind]: Math.max(-rewardTickets[kind], prev[kind] + delta),
    }));
  };

  const clearPending = () => {
    setPendingMining(0);
    setPendingRewards({ ...EMPTY_REWARD_TICKETS });
    setApplyOk(null);
  };

  const applyPending = () => {
    if (!hasPending) return;
    if (pendingMining !== 0) onAdjustMiningTickets(pendingMining);
    for (const kind of REWARD_TICKET_KINDS) {
      const delta = pendingRewards[kind];
      if (delta !== 0) onAdjustRewardTicket(kind, delta);
    }
    setPendingMining(0);
    setPendingRewards({ ...EMPTY_REWARD_TICKETS });
    setApplyOk("反映したよ");
  };

  const tryUnlock = () => {
    if (verifyParentRescuePassword(gateInput, currentPassword)) {
      setUnlocked(true);
      setError(null);
      setGateInput("");
      return;
    }
    setError("パスワードが違うよ");
  };

  const tryChangePassword = () => {
    setPwOk(null);
    if (!verifyParentRescuePassword(pwCurrent, currentPassword)) {
      setPwError("いまのパスワードが違うよ");
      return;
    }
    const next = pwNext.trim();
    if (!isValidNewParentRescuePassword(next)) {
      setPwError("新しいパスワードは4文字以上にしてね");
      return;
    }
    if (next !== pwConfirm.trim()) {
      setPwError("確認用パスワードが一致しないよ");
      return;
    }
    onChangePassword(next);
    setPwCurrent("");
    setPwNext("");
    setPwConfirm("");
    setPwError(null);
    setPwOk("パスワードを変えたよ");
  };

  if (!unlocked) {
    return (
      <div
        data-modal-overlay
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 140,
          backgroundColor: "rgba(0,0,0,0.55)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%", maxWidth: 420,
            borderRadius: "20px 20px 0 0",
            backgroundColor: theme.bg.editor,
            padding: "20px 18px max(env(safe-area-inset-bottom, 16px), 16px)",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>親の救済メニュー</div>
          <div style={{ fontSize: 13, color: theme.text.secondary, marginBottom: 14, lineHeight: 1.45 }}>
            データ連携がうまくいかないときの、チケット／ごほうび配布用です。
          </div>
          <input
            type="password"
            value={gateInput}
            onChange={(e) => setGateInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") tryUnlock();
            }}
            placeholder="パスワード"
            autoFocus
            style={inputStyle}
          />
          {error && (
            <div style={{ fontSize: 13, fontWeight: 800, color: theme.category.orange, marginBottom: 8 }}>
              {error}
            </div>
          )}
          <button
            type="button"
            onClick={tryUnlock}
            style={{
              width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
              backgroundColor: theme.accent.primary, color: "#fff",
              fontSize: 15, fontWeight: 900, cursor: "pointer", marginBottom: 8,
            }}
          >
            ひらく
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "100%", padding: "12px 0", borderRadius: 12,
              border: `1.5px solid ${theme.stroke.secondary}`,
              backgroundColor: theme.fill.secondary, color: theme.text.secondary,
              fontSize: 14, fontWeight: 800, cursor: "pointer",
            }}
          >
            やめる
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-modal-overlay
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 140,
        backgroundColor: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 420, maxHeight: "88dvh",
          borderRadius: "20px 20px 0 0",
          backgroundColor: theme.bg.editor,
          padding: "18px 16px max(env(safe-area-inset-bottom, 16px), 16px)",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 900 }}>親の救済メニュー</div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none", background: "none", cursor: "pointer",
              fontSize: 22, color: theme.text.tertiary, lineHeight: 1, padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          marginBottom: 16, padding: "12px 14px", borderRadius: 12,
          border: `1.5px solid ${theme.stroke.secondary}`,
          backgroundColor: theme.fill.quaternary,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: theme.text.primary }}>
              夜の遊びロック（21時〜朝6:30）
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: theme.text.secondary, marginTop: 4, lineHeight: 1.4 }}>
              {miningNightLockEnabled
                ? "いま ON。子どもは夜にこうざん・ガチャ・交換所で遊べないよ"
                : "いま OFF。夜でも遊べるよ"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onToggleMiningNightLock(!miningNightLockEnabled)}
            aria-pressed={miningNightLockEnabled}
            style={{
              flexShrink: 0,
              minWidth: 64,
              padding: "10px 12px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              fontWeight: 900,
              fontSize: 14,
              backgroundColor: miningNightLockEnabled ? theme.accent.primary : theme.fill.secondary,
              color: miningNightLockEnabled ? "#fff" : theme.text.primary,
            }}
          >
            {miningNightLockEnabled ? "ON" : "OFF"}
          </button>
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          marginBottom: 14, padding: "10px 12px", borderRadius: 12,
          backgroundColor: theme.fill.quaternary,
        }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: theme.text.secondary }}>一度に動かす枚数</span>
          {PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCustomAmount(String(n))}
              style={{
                padding: "6px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                fontWeight: 900, fontSize: 13,
                backgroundColor: amount === n ? theme.accent.primary : theme.fill.secondary,
                color: amount === n ? "#fff" : theme.text.primary,
              }}
            >
              {n}
            </button>
          ))}
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            style={{
              width: 72, padding: "6px 8px", borderRadius: 8,
              border: `1.5px solid ${theme.stroke.secondary}`,
              fontWeight: 800, fontSize: 14,
            }}
          />
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: theme.text.secondary, margin: "-6px 0 12px", lineHeight: 1.45 }}>
          ＋/− はまだ仮の変更です。下の「この内容で反映する」を押すと確定します。
        </div>

        <AdjustRow
          title="こうざんチケット"
          count={miningTickets}
          pending={pendingMining}
          accent={theme.category.orange}
          amount={amount}
          onPlus={() => stageMining(amount)}
          onMinus={() => stageMining(-amount)}
        />

        <div style={{ fontSize: 13, fontWeight: 900, color: theme.text.secondary, margin: "16px 0 8px" }}>
          ごほうびチケット
        </div>
        {REWARD_TICKET_KINDS.map((kind) => (
          <AdjustRow
            key={kind}
            title={rewardTicketLabel(kind)}
            count={rewardTickets[kind]}
            pending={pendingRewards[kind]}
            accent={RARITY_META[kind].color}
            amount={amount}
            onPlus={() => stageReward(kind, amount)}
            onMinus={() => stageReward(kind, -amount)}
          />
        ))}

        {applyOk && (
          <div style={{ fontSize: 13, fontWeight: 800, color: theme.category.green, margin: "4px 0 8px" }}>
            {applyOk}
          </div>
        )}
        <button
          type="button"
          onClick={applyPending}
          disabled={!hasPending}
          style={{
            width: "100%",
            padding: "14px 0",
            borderRadius: 12,
            border: "none",
            backgroundColor: hasPending ? theme.accent.primary : theme.fill.secondary,
            color: hasPending ? "#fff" : theme.text.tertiary,
            fontSize: 15,
            fontWeight: 900,
            cursor: hasPending ? "pointer" : "default",
            marginTop: 8,
          }}
        >
          この内容で反映する
        </button>
        <button
          type="button"
          onClick={clearPending}
          disabled={!hasPending}
          style={{
            width: "100%",
            padding: "12px 0",
            borderRadius: 12,
            border: `1.5px solid ${theme.stroke.secondary}`,
            backgroundColor: theme.fill.secondary,
            color: theme.text.secondary,
            fontSize: 14,
            fontWeight: 800,
            cursor: hasPending ? "pointer" : "default",
            opacity: hasPending ? 1 : 0.5,
            marginTop: 8,
          }}
        >
          やりなおす
        </button>

        <div style={{
          marginTop: 18,
          paddingTop: 14,
          borderTop: `1px solid ${theme.stroke.secondary}`,
        }}>
          <button
            type="button"
            onClick={() => {
              setShowPwChange((v) => !v);
              setPwError(null);
              setPwOk(null);
            }}
            style={{
              width: "100%",
              padding: "12px 0",
              borderRadius: 12,
              border: `1.5px solid ${theme.stroke.secondary}`,
              backgroundColor: theme.fill.secondary,
              color: theme.text.primary,
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
              marginBottom: showPwChange ? 12 : 0,
            }}
          >
            {showPwChange ? "パスワード変更を閉じる" : "パスワードを変える"}
          </button>
          {showPwChange && (
            <div>
              <input
                type="password"
                value={pwCurrent}
                onChange={(e) => setPwCurrent(e.target.value)}
                placeholder="いまのパスワード"
                style={inputStyle}
              />
              <input
                type="password"
                value={pwNext}
                onChange={(e) => setPwNext(e.target.value)}
                placeholder="新しいパスワード（4文字以上）"
                style={inputStyle}
              />
              <input
                type="password"
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") tryChangePassword();
                }}
                placeholder="新しいパスワード（確認）"
                style={inputStyle}
              />
              {pwError && (
                <div style={{ fontSize: 13, fontWeight: 800, color: theme.category.orange, marginBottom: 8 }}>
                  {pwError}
                </div>
              )}
              {pwOk && (
                <div style={{ fontSize: 13, fontWeight: 800, color: theme.category.green, marginBottom: 8 }}>
                  {pwOk}
                </div>
              )}
              <button
                type="button"
                onClick={tryChangePassword}
                style={{
                  width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
                  backgroundColor: theme.accent.primary, color: "#fff",
                  fontSize: 15, fontWeight: 900, cursor: "pointer",
                }}
              >
                パスワードを保存
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdjustRow({
  title,
  count,
  pending,
  accent,
  amount,
  onPlus,
  onMinus,
}: {
  title: string;
  count: number;
  pending: number;
  accent: string;
  amount: number;
  onPlus: () => void;
  onMinus: () => void;
}) {
  const after = count + pending;
  const minusDisabled = after <= 0;
  const pendingLabel = pending === 0
    ? null
    : pending > 0
      ? `+${pending}`
      : String(pending);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "10px 12px", borderRadius: 12, marginBottom: 8,
      border: `1.5px solid ${accent}44`,
      backgroundColor: `${accent}12`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: theme.text.primary }}>{title}</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: accent }}>
          {pending === 0 ? count : `${count} → ${after}`}
        </div>
        {pendingLabel && (
          <div style={{ fontSize: 12, fontWeight: 800, color: theme.text.secondary }}>
            変更 {pendingLabel}（まだ反映してない）
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onMinus}
        disabled={minusDisabled}
        style={adjustBtnStyle(minusDisabled)}
      >
        −{amount}
      </button>
      <button
        type="button"
        onClick={onPlus}
        style={adjustBtnStyle(false, true)}
      >
        +{amount}
      </button>
    </div>
  );
}

function adjustBtnStyle(disabled: boolean, primary = false): CSSProperties {
  return {
    flexShrink: 0,
    minWidth: 56,
    padding: "10px 8px",
    borderRadius: 10,
    border: "none",
    cursor: disabled ? "default" : "pointer",
    fontWeight: 900,
    fontSize: 13,
    opacity: disabled ? 0.4 : 1,
    backgroundColor: primary ? theme.accent.primary : theme.fill.secondary,
    color: primary ? "#fff" : theme.text.primary,
  };
}
