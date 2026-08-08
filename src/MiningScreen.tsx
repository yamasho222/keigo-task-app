import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { theme } from "./theme";
import { ScrollSafeBackButton } from "./ScrollSafeBackButton";
import { StickerFrameWithBadge, StickerImg } from "./Rewards";
import { BuddyFrame } from "./BuddyFrame";
import { getBuddyEntry, type BuddyProgressMap } from "./buddyProgress";
import { REWARD_LOOKUP, STICKER_CATEGORIES, STICKER_REWARDS, type RewardCategory, type RewardLookupEntry } from "./stickerRewards";
import {
  EXCHANGE_LOG_COST,
  EXCHANGE_WOOL_COST,
  EXCHANGE_DEBRIS_COST,
  QUARTZ_TO_POINTS,
  bestOwnedTool,
  canAffordRecipe,
  equipArmor,
  equipTool,
  exchangeCost,
  exchangePointsForCobble,
  exchangePointsForDebris,
  exchangePointsForLog,
  exchangePointsForWool,
  exchangeQuartzForPoints,
  hasFurnace,
  hasWorkbench,
  luckyGachaForDate,
  netheriteFullComplete,
  ownedArmorForSlot,
  previewDigBoost,
  recommendToolKind,
  recipesForState,
  resolveDig,
  setPartySlot,
  specialtyForGacha,
  tryCraft,
  type DigResult,
  type MiningRecipe,
} from "./miningProgress";
import { NETHERITE_UPGRADE_REQUIRES, recipeProgress } from "./miningRecipes";
import { MiningItemIcon } from "./MiningItemIcon";
import { boostStrengthLabel, miningNextGoal, nextGachaUnlock } from "./miningUiHelpers";
import {
  ARMOR_KIND_LABEL,
  GACHA_META,
  MATERIAL_META,
  MAX_BEDS,
  TOOL_KIND_LABEL,
  TOOL_EFFECT_BLURB,
  ARMOR_EFFECT_BLURB,
  toolEffectForGacha,
  SPECIALTY_META,
  specialtyBlurb,
  specialtyOfCategory,
  gearLabel,
  getMaterialCount,
  parseToolId,
  partySlotCount,
  type CraftedGearId,
  type GachaId,
  type MaterialId,
  type MiningState,
  type ToolKind,
} from "./miningTypes";

interface Props {
  mining: MiningState;
  stickerAlbum: string[];
  buddyProgress: BuddyProgressMap;
  dateKey: string;
  onChange: (next: MiningState) => void;
  /** パーティ候補に出すため、未所持シールをアルバムへ足す */
  onEnsureStickers?: (ids: string[]) => void;
  onBack: () => void;
}

type TabId = "mine" | "craft" | "bag";
type OverlayId = "party" | "equip" | null;
type DigFxPhase = "idle" | "swing" | "reveal";
type ArmorSlot = "helmet" | "chest" | "leggings" | "boots";

const card: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  backgroundColor: theme.bg.editor,
  border: `1.5px solid ${theme.stroke.secondary}`,
};

const btnPrimary: CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "12px 14px",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
  backgroundColor: theme.accent.primary,
  color: "#fff",
};

const btnGhost: CSSProperties = {
  border: `1.5px solid ${theme.stroke.secondary}`,
  borderRadius: 12,
  padding: "10px 12px",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  backgroundColor: theme.fill.secondary,
  color: theme.text.primary,
};

function StickerThumb({
  item,
  level,
  size = 56,
}: {
  item: RewardLookupEntry;
  level: number;
  size?: number;
}) {
  return (
    <div style={{ width: size, height: size }}>
      <BuddyFrame level={level} size="cell" showLevelBadge rarity={item.rarity}>
        <StickerFrameWithBadge
          rarity={item.rarity}
          compact
          showBadge={false}
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: item.emoji ? size * 0.45 : undefined,
          }}
        >
          {item.emoji ? (
            item.emoji
          ) : item.image ? (
            <StickerImg
              src={item.image}
              alt={item.label}
              padding={4}
              objectFit={item.imageFit ?? "contain"}
            />
          ) : (
            "?"
          )}
        </StickerFrameWithBadge>
      </BuddyFrame>
    </div>
  );
}

function DigFxOverlay({
  phase,
  gacha,
  result,
  onClose,
}: {
  phase: DigFxPhase;
  gacha: GachaId;
  result: DigResult | null;
  onClose: () => void;
}) {
  if (phase === "idle") return null;
  const meta = GACHA_META[gacha];
  return (
    <div className="mining-dig-overlay" role="dialog" aria-modal="true">
      <div className={`mining-dig-card ${phase === "reveal" ? "is-reveal" : "is-swing"}`}>
        {phase === "swing" && (
          <>
            <div className="mining-dig-scene">{meta.emoji}</div>
            <div className="mining-dig-tool">
              {result?.usedTool ? (
                <MiningItemIcon gear={result.usedTool} size={48} alt="" />
              ) : (
                "⛏️"
              )}
            </div>
            <div className="mining-dig-dust">✨</div>
            <div className="mining-dig-title">ほっている…</div>
            <div className="mining-dig-sub">{meta.label}</div>
          </>
        )}
        {phase === "reveal" && result && (
          <>
            <div className="mining-dig-title">ほった！</div>
            <div className="mining-dig-drops">
              {result.drops.map((d) => (
                <div key={d.material} className="mining-dig-drop">
                  <span className="mining-dig-drop-emoji"><MiningItemIcon material={d.material} size={28} alt={MATERIAL_META[d.material].label} /></span>
                  <span className="mining-dig-drop-label">{MATERIAL_META[d.material].label}</span>
                  <span className="mining-dig-drop-amount">×{d.amount}</span>
                </div>
              ))}
            </div>
            <div className="mining-dig-breakdown">
              {result.breakdown.join(" · ")}
              {result.usedTool ? ` · ${gearLabel(result.usedTool)}` : ""}
            </div>
            {result.ticketRefunded && (
              <div className="mining-dig-bonus">🎫 チケットがもどった！</div>
            )}
            <button type="button" className="mining-dig-close" onClick={onClose}>
              つぎへ
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function MiningScreen({
  mining,
  stickerAlbum,
  buddyProgress,
  dateKey,
  onChange,
  onEnsureStickers,
  onBack,
}: Props) {
  const [tab, setTab] = useState<TabId>("mine");
  const [overlay, setOverlay] = useState<OverlayId>(null);
  const [selectedGacha, setSelectedGacha] = useState<GachaId>("wood");
  const [toolKind, setToolKind] = useState<ToolKind>("axe");
  const [lastDig, setLastDig] = useState<DigResult | null>(null);
  const [digFx, setDigFx] = useState<DigFxPhase>("idle");
  const [toast, setToast] = useState<string | null>(null);
  const [partySlotEdit, setPartySlotEdit] = useState<number | null>(null);
  const [partyCategoryFilter, setPartyCategoryFilter] = useState<RewardCategory | null>(null);
  const [digBusy, setDigBusy] = useState(false);
  const [boostDetailOpen, setBoostDetailOpen] = useState(false);
  const [craftShowAll, setCraftShowAll] = useState(false);

  const recipes = useMemo(() => recipesForState(mining), [mining]);
  const hasHelmet = !!(mining.equipped.helmet && mining.crafted[mining.equipped.helmet]);
  const lucky = luckyGachaForDate(dateKey, mining.unlockedGachas, hasHelmet);
  const boost = useMemo(
    () => previewDigBoost({
      state: mining,
      gacha: selectedGacha,
      toolKind,
      buddyProgress,
      dateKey,
    }),
    [mining, selectedGacha, toolKind, buddyProgress, dateKey],
  );

  useEffect(() => {
    if (digFx !== "swing") return;
    const t = window.setTimeout(() => setDigFx("reveal"), 1100);
    return () => window.clearTimeout(t);
  }, [digFx]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const have = (id: MaterialId) => getMaterialCount(mining, id);

  const selectToolKind = (kind: ToolKind) => {
    setToolKind(kind);
    const best = bestOwnedTool(mining, kind);
    if (best) onChange(equipTool(mining, best));
  };

  const onDig = () => {
    if (digBusy) return;
    const result = resolveDig({
      state: mining,
      gacha: selectedGacha,
      toolKind,
      buddyProgress,
      dateKey,
    });
    if ("error" in result) {
      showToast(result.error);
      return;
    }
    setDigBusy(true);
    onChange(result.state);
    setLastDig(result);
    setDigFx("swing");
    navigator.vibrate?.([18, 30, 18, 30, 40]);
  };

  const closeDigFx = () => {
    setDigFx("idle");
    setDigBusy(false);
  };

  const onCraft = (recipe: MiningRecipe) => {
    const result = tryCraft(mining, recipe);
    if (result.error) {
      showToast(result.error);
      return;
    }
    const before = new Set(mining.unlockedGachas);
    const beforeBeds = partySlotCount(mining);
    onChange(result.state);
    if (recipe.grantsBed && partySlotCount(result.state) > beforeBeds) {
      showToast(`ベッドを作った！パーティが${partySlotCount(result.state)}人までになった！`);
    } else {
      showToast(`${recipe.label} を作った！`);
    }
    const unlockMessages: { id: typeof result.state.unlockedGachas[number]; label: string }[] = [
      { id: "stone", label: "いしのどうくつ が解放された！" },
      { id: "iron", label: "てつのこうざん が解放された！" },
      { id: "gold", label: "きんのこうざん が解放された！" },
      { id: "diamond", label: "ダイヤのしんそう が解放された！" },
      { id: "nether", label: "ネザー が解放された！" },
    ];
    let delay = 900;
    for (const msg of unlockMessages) {
      if (!before.has(msg.id) && result.state.unlockedGachas.includes(msg.id)) {
        window.setTimeout(() => showToast(msg.label), delay);
        delay += 900;
      }
    }
  };

  const ownedStickers = stickerAlbum
    .filter((id) => !!REWARD_LOOKUP[id])
    .map((id) => ({ id, ...REWARD_LOOKUP[id]! }));

  const partyCandidates = (() => {
    if (partyCategoryFilter) {
      return STICKER_REWARDS
        .filter((reward) => reward.category === partyCategoryFilter)
        .map((reward) => ({ id: reward.id, ...REWARD_LOOKUP[reward.id]! }));
    }
    return ownedStickers;
  })();

  const slots = partySlotCount(mining);

  useEffect(() => {
    if (partySlotEdit !== null && partySlotEdit >= slots) {
      setPartySlotEdit(slots > 0 ? slots - 1 : null);
    }
  }, [slots, partySlotEdit]);

  const tabs: { id: TabId; label: string }[] = [
    { id: "mine", label: "ほる" },
    { id: "craft", label: "クラフト" },
    { id: "bag", label: "もちもの" },
  ];
  const unlockCard = nextGachaUnlock(mining);

  const armorSlots: ArmorSlot[] = ["helmet", "chest", "leggings", "boots"];

  const nextGoal = miningNextGoal(mining);
  const strength = boostStrengthLabel(boost.expectedExtra);
  const wantSpec = specialtyForGacha(selectedGacha);
  const digDisabled = digBusy || mining.tickets < 1 || !mining.unlockedGachas.includes(selectedGacha);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: "80vh", paddingBottom: tab === "mine" ? 120 : 72 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ScrollSafeBackButton onBack={onBack} />
        <div style={{ fontSize: 18, fontWeight: 800, color: theme.text.primary }}>こうざん／クラフト</div>
      </div>

      <div style={{ ...card, padding: "10px 12px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <span style={{ fontWeight: 900, color: theme.category.orange, fontSize: 16 }}>🎫 {mining.tickets}</span>
          <span style={{ fontWeight: 800, color: theme.text.secondary, fontSize: 15 }}>⚡ {mining.miningPoints}</span>
        </div>
        <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: theme.accent.primary }}>
          {nextGoal}
        </div>
        {netheriteFullComplete(mining) && (
          <div style={{ marginTop: 4, fontSize: 11, fontWeight: 800, color: theme.category.green }}>
            ネザライトそろい特典ON
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          type="button"
          onClick={() => { setOverlay("party"); setPartySlotEdit(0); }}
          style={{ ...card, textAlign: "left", cursor: "pointer", width: "100%", padding: 12 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: theme.accent.primary }}>
              パーティ（ベッド {slots}/{MAX_BEDS}）
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: theme.text.tertiary }}>›</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {Array.from({ length: slots }, (_, i) => {
              const id = mining.partyIds[i];
              const item = id ? REWARD_LOOKUP[id] : null;
              const lv = id ? getBuddyEntry(buddyProgress, id).level : 1;
              const match = !!(item && specialtyOfCategory(item.category) === wantSpec);
              return (
                <div
                  key={i}
                  style={{
                    width: 56, height: 64, borderRadius: 10,
                    border: `1.5px ${match ? "solid" : "dashed"} ${match ? theme.category.green : theme.stroke.primary}`,
                    background: match ? `${theme.category.green}14` : theme.fill.quaternary,
                    padding: 3, display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {item ? <StickerThumb item={item} level={lv} size={48} /> : (
                    <span style={{ fontSize: 11, color: theme.text.tertiary }}>空</span>
                  )}
                </div>
              );
            })}
          </div>
          {slots < MAX_BEDS && (
            <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: theme.text.secondary }}>
              ベッドをクラフトすると枠が1つ増えるよ
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={() => setOverlay("equip")}
          style={{ ...card, textAlign: "left", cursor: "pointer", width: "100%", padding: 12 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: theme.accent.primary }}>そうび</div>
            <span style={{ fontSize: 12, fontWeight: 800, color: theme.text.tertiary }}>›</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {([
              mining.equipped.tool,
              mining.equipped.helmet,
              mining.equipped.chest,
              mining.equipped.leggings,
              mining.equipped.boots,
            ] as const).map((gearId, idx) => (
              <div
                key={idx}
                style={{
                  width: 40, height: 40, borderRadius: 10,
                  border: `1px solid ${theme.stroke.tertiary}`,
                  background: theme.fill.secondary,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
                title={gearId ? gearLabel(gearId) : "なし"}
              >
                {gearId ? <MiningItemIcon gear={gearId} size={28} alt="" /> : (
                  <span style={{ fontSize: 11, color: theme.text.tertiary }}>·</span>
                )}
              </div>
            ))}
          </div>
        </button>
      </div>

      {!overlay && (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              ...btnGhost,
              padding: "10px 8px",
              fontSize: 13,
              minWidth: 0,
              backgroundColor: tab === t.id ? `${theme.accent.primary}18` : theme.fill.secondary,
              borderColor: tab === t.id ? theme.accent.primary : theme.stroke.secondary,
              color: tab === t.id ? theme.accent.primary : theme.text.primary,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      )}

      {overlay && (
        <button
          type="button"
          onClick={() => setOverlay(null)}
          style={{ ...btnGhost, alignSelf: "flex-start", padding: "8px 12px" }}
        >
          ← もどる
        </button>
      )}

      {!overlay && tab === "mine" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={card}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>どこをほる？</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(Object.keys(GACHA_META) as GachaId[]).map((gid) => {
                const meta = GACHA_META[gid];
                const unlocked = mining.unlockedGachas.includes(gid);
                const isLucky = lucky === gid;
                const lockHint =
                  gid === "stone" ? "木の剣・斧・ツルハシで解放"
                    : gid === "iron" || gid === "gold" ? "石の剣・斧・ツルハシで解放"
                      : gid === "diamond" ? "鉄フル（どうぐ3＋防具4）で解放"
                        : gid === "nether" ? "ダイヤの剣・斧・ツルハシで解放"
                          : "ロック";
                return (
                  <button
                    key={gid}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => {
                      setSelectedGacha(gid);
                      selectToolKind(recommendToolKind(gid));
                    }}
                    style={{
                      ...btnGhost,
                      textAlign: "left",
                      opacity: unlocked ? 1 : 0.4,
                      borderColor: selectedGacha === gid ? theme.accent.primary : theme.stroke.secondary,
                      backgroundColor: selectedGacha === gid ? `${theme.accent.primary}14` : theme.fill.secondary,
                    }}
                  >
                    <span style={{ fontWeight: 900 }}>{meta.emoji} {meta.label}</span>
                    {!unlocked && <span style={{ marginLeft: 8, fontSize: 12 }}>{lockHint}</span>}
                    {isLucky && unlocked && (
                      <span style={{ marginLeft: 8, color: theme.category.orange, fontWeight: 800 }}>★あたり日</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={card}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>つかうどうぐの種類</div>
            <div style={{ fontSize: 12, color: theme.text.secondary, marginBottom: 8, lineHeight: 1.5 }}>
              剣・斧・ツルハシから選ぶよ。いちばん強いものを自動で使うよ。
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(["axe", "sword", "pickaxe"] as ToolKind[]).map((kind) => {
                const best = bestOwnedTool(mining, kind);
                const recommended = recommendToolKind(selectedGacha) === kind;
                const selected = toolKind === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    disabled={!best}
                    onClick={() => selectToolKind(kind)}
                    style={{
                      ...btnGhost,
                      opacity: best ? 1 : 0.4,
                      borderColor: selected ? theme.category.green : theme.stroke.secondary,
                      backgroundColor: selected ? `${theme.category.green}18` : theme.fill.secondary,
                      textAlign: "left",
                      padding: "10px 12px",
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                      {best && <MiningItemIcon gear={best} size={26} alt="" />}
                      <strong>{TOOL_KIND_LABEL[kind]}</strong>
                      {recommended && best && (
                        <span style={{ color: theme.category.orange, fontWeight: 800 }}>おすすめ</span>
                      )}
                      {selected && best && (
                        <span style={{ color: theme.category.green, fontWeight: 800 }}>つかう</span>
                      )}
                    </div>
                    {best && (
                      <div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, color: theme.text.primary }}>
                        いま使う: {gearLabel(best)}
                      </div>
                    )}
                    <div style={{
                      marginTop: 4,
                      fontSize: 12,
                      fontWeight: 800,
                      color: recommended ? theme.category.orange : theme.text.secondary,
                      lineHeight: 1.4,
                    }}>
                      {toolEffectForGacha(kind, selectedGacha)}
                    </div>
                    {selected && (
                      <div style={{ marginTop: 4, fontSize: 11, color: theme.text.tertiary, lineHeight: 1.4 }}>
                        {TOOL_EFFECT_BLURB[kind]}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={card}>
            <button
              type="button"
              onClick={() => setBoostDetailOpen((v) => !v)}
              style={{
                width: "100%",
                border: "none",
                background: "transparent",
                padding: 0,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <div style={{ fontWeight: 800 }}>いまのつよさ</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: strength.color }}>
                  {strength.label} {boostDetailOpen ? "▲" : "▼"}
                </div>
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: theme.text.secondary }}>
                くわしく見る（パーセント）
              </div>
            </button>
            {boostDetailOpen && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {boost.lines.map((line) => (
                  <div
                    key={line.label}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      background: line.active ? `${theme.category.green}14` : theme.fill.secondary,
                      border: `1px solid ${line.active ? `${theme.category.green}55` : theme.stroke.tertiary}`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <strong style={{ fontSize: 13 }}>{line.label}</strong>
                      <span style={{ fontSize: 13, fontWeight: 800, color: line.active ? theme.category.green : theme.text.secondary }}>
                        {line.value}
                      </span>
                    </div>
                    {line.hint && (
                      <div style={{ fontSize: 11, color: theme.text.tertiary, marginTop: 2 }}>{line.hint}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {lastDig && digFx === "idle" && (
            <div style={{ ...card, borderColor: `${theme.category.orange}66`, backgroundColor: `${theme.category.orange}10` }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>さいごにほった結果</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                {lastDig.drops.map((d) => (
                  <span key={d.material} style={{ fontWeight: 800 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><MiningItemIcon material={d.material} size={20} alt="" />{MATERIAL_META[d.material].label} ×{d.amount}</span>
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 12, color: theme.text.secondary }}>
                {lastDig.breakdown.join(" · ")}
                {lastDig.usedTool ? ` · ${gearLabel(lastDig.usedTool)}` : ""}
              </div>
            </div>
          )}
        </div>
      )}

      {overlay === "equip" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ ...card, backgroundColor: `${theme.accent.primary}10` }}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>そうびをえらぶ</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: theme.text.secondary }}>
              ほるタブでは種類だけ選ぶよ。ここで強いどうぐ・よろいをそうびするよ。
            </div>
          </div>

          <div style={card}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>ほるどうぐ（いちばん強いものをそうび）</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(["axe", "sword", "pickaxe"] as ToolKind[]).map((kind) => {
                const best = bestOwnedTool(mining, kind);
                const equipped = parseToolId(mining.equipped.tool)?.kind === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    disabled={!best}
                    onClick={() => {
                      if (!best) return;
                      setToolKind(kind);
                      onChange(equipTool(mining, best));
                      showToast(`${gearLabel(best)} を装備した！`);
                    }}
                    style={{
                      ...btnGhost,
                      opacity: best ? 1 : 0.4,
                      textAlign: "left",
                      padding: "12px 12px",
                      borderColor: equipped ? theme.category.green : theme.stroke.secondary,
                      backgroundColor: equipped ? `${theme.category.green}18` : theme.fill.secondary,
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                      {best && <MiningItemIcon gear={best} size={28} alt="" />}
                      <span>
                        {TOOL_KIND_LABEL[kind]} · {best ? gearLabel(best) : "未所持"}
                        {equipped && <span style={{ marginLeft: 8, color: theme.category.green }}>装備中</span>}
                      </span>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: theme.text.secondary, lineHeight: 1.45 }}>
                      効果: {TOOL_EFFECT_BLURB[kind]}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={card}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>よろい（鉄から）</div>
            {armorSlots.map((slot) => {
              const owned = ownedArmorForSlot(mining, slot);
              const current = mining.equipped[slot];
              return (
                <div key={slot} style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>{ARMOR_KIND_LABEL[slot]}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: theme.text.secondary, marginBottom: 6, lineHeight: 1.45 }}>
                    効果: {ARMOR_EFFECT_BLURB[slot]}
                  </div>
                  {owned.length === 0 ? (
                    <div style={{ fontSize: 12, color: theme.text.tertiary }}>まだないよ（鉄クラフト後）</div>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {owned.map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            onChange(equipArmor(mining, slot, id));
                            showToast(`${gearLabel(id)} を装備した！`);
                          }}
                          style={{
                            ...btnGhost,
                            borderColor: current === id ? theme.category.green : theme.stroke.secondary,
                            backgroundColor: current === id ? `${theme.category.green}18` : theme.fill.secondary,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <MiningItemIcon gear={id} size={22} alt="" />
                          {gearLabel(id)}
                        </button>
                      ))}
                      {current && (
                        <button
                          type="button"
                          style={btnGhost}
                          onClick={() => {
                            onChange(equipArmor(mining, slot, null));
                            showToast("はずしたよ");
                          }}
                        >
                          はずす
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: 12, color: theme.text.secondary, lineHeight: 1.5, padding: "0 4px" }}>
            つよさのくわしい数字は「ほる」タブで見れるよ（いまの場所: {GACHA_META[selectedGacha].label}）
          </div>
        </div>
      )}

      {!overlay && tab === "craft" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {!hasWorkbench(mining) && (
            <div style={{ ...card, backgroundColor: `${theme.category.yellow}18` }}>
              まずは板材と棒を作って、作業台を作ろう！
            </div>
          )}
          {unlockCard && (
            <div style={{ ...card, borderColor: `${theme.category.orange}66`, backgroundColor: `${theme.category.orange}12` }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>{unlockCard.title}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {unlockCard.requirements.map((req) => (
                  <div
                    key={req.label}
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: req.done ? theme.category.green : theme.text.secondary,
                    }}
                  >
                    {req.done ? "✓" : "・"} {req.label}
                    {!req.done && <span style={{ marginLeft: 6, color: theme.category.orange }}>まだ</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {(() => {
            const annotated = recipes.map((recipe) => {
              const upgradeFrom = recipe.craftFlag ? NETHERITE_UPGRADE_REQUIRES[recipe.craftFlag] : undefined;
              const hasUpgradeBase = !upgradeFrom || !!mining.crafted[upgradeFrom];
              const bedFull = !!(recipe.grantsBed && slots >= MAX_BEDS);
              const owned = !!(recipe.craftFlag && mining.crafted[recipe.craftFlag]) || bedFull;
              const ok =
                canAffordRecipe(recipe.costs, have)
                && hasUpgradeBase
                && !owned
                && (!recipe.needsWorkbench || hasWorkbench(mining))
                && (!recipe.needsFurnace || hasFurnace(mining));
              return { recipe, upgradeFrom, hasUpgradeBase, bedFull, owned, ok };
            });
            const ready = annotated.filter((a) => a.ok);
            const recommended = annotated.filter((a) => a.recipe.grantsBed && !a.owned && slots < MAX_BEDS);
            const readyIds = new Set(ready.map((a) => a.recipe.id));
            const recommendedIds = new Set(recommended.map((a) => a.recipe.id));
            const rest = annotated.filter((a) => !readyIds.has(a.recipe.id) && !recommendedIds.has(a.recipe.id));
            const shownRest = craftShowAll ? rest : rest.slice(0, 4);

            const renderRecipe = (a: typeof annotated[number]) => {
              const { recipe, upgradeFrom, hasUpgradeBase, owned, ok } = a;
              const progress = recipeProgress(recipe.costs, have);
              return (
                <div key={recipe.id} style={card}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 15 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          {recipe.grantsBed ? (
                            <MiningItemIcon bed emoji={recipe.emoji} size={28} alt="" />
                          ) : recipe.craftFlag ? (
                            <MiningItemIcon gear={recipe.craftFlag} emoji={recipe.emoji} size={28} alt="" />
                          ) : recipe.outputs?.[0] ? (
                            <MiningItemIcon material={recipe.outputs[0].material} emoji={recipe.emoji} size={28} alt="" />
                          ) : (
                            <span>{recipe.emoji}</span>
                          )}
                          <span>{recipe.label}{recipe.grantsBed ? `（${slots}/${MAX_BEDS}）` : ""}</span>
                        </span>
                        {owned && <span style={{ marginLeft: 8, color: theme.category.green, fontSize: 12 }}>{recipe.grantsBed ? "満員" : "所持"}</span>}
                      </div>
                      {upgradeFrom && (
                        <div style={{
                          marginTop: 6,
                          fontSize: 12,
                          fontWeight: 700,
                          color: hasUpgradeBase ? theme.category.green : theme.category.orange,
                        }}>
                          強化もと:{" "}
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, verticalAlign: "middle" }}>
                            <MiningItemIcon gear={upgradeFrom} size={16} alt="" />
                            {gearLabel(upgradeFrom)}
                          </span>{" "}
                          {hasUpgradeBase ? "OK" : "が必要"}
                        </div>
                      )}
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                        {progress.map((p) => (
                          <div
                            key={p.cost.material}
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: p.ok ? theme.category.green : theme.text.secondary,
                            }}
                          >
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                              <MiningItemIcon material={p.cost.material} size={18} alt="" />
                              {MATERIAL_META[p.cost.material].label}
                            </span>
                            {" "}{p.have}/{p.cost.amount}
                            {!p.ok && <span style={{ marginLeft: 6, color: theme.category.orange }}>あと{p.need}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!ok || owned}
                      onClick={() => onCraft(recipe)}
                      style={{
                        ...btnPrimary,
                        opacity: ok && !owned ? 1 : 0.4,
                        whiteSpace: "nowrap",
                      }}
                    >
                      つくる
                    </button>
                  </div>
                </div>
              );
            };

            return (
              <>
                {recommended.length > 0 && (
                  <div style={{ fontWeight: 800, fontSize: 13, color: theme.category.orange }}>おすすめ</div>
                )}
                {recommended.map(renderRecipe)}
                {ready.length > 0 && (
                  <div style={{ fontWeight: 800, fontSize: 13, color: theme.category.green, marginTop: recommended.length ? 4 : 0 }}>
                    いまつくれる
                  </div>
                )}
                {ready.filter((a) => !recommendedIds.has(a.recipe.id)).map(renderRecipe)}
                {(shownRest.length > 0 || rest.length > 4) && (
                  <div style={{ fontWeight: 800, fontSize: 13, color: theme.text.secondary, marginTop: 4 }}>ほかのレシピ</div>
                )}
                {shownRest.map(renderRecipe)}
                {rest.length > 4 && (
                  <button type="button" style={{ ...btnGhost, width: "100%" }} onClick={() => setCraftShowAll((v) => !v)}>
                    {craftShowAll ? "とじる" : `もっとみる（あと${rest.length - 4}）`}
                  </button>
                )}
              </>
            );
          })()}

        </div>
      )}

      {overlay === "party" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={card}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>スロットを選んでシールを入れてね</div>
            <div style={{ fontSize: 12, color: theme.text.secondary, lineHeight: 1.6 }}>
              いまほる場所「{GACHA_META[selectedGacha].label}」向きのとくいだと効きやすいよ。
              ベッド {slots}/{MAX_BEDS}（クラフトで増える）
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {Array.from({ length: slots }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPartySlotEdit(i)}
                  style={{
                    ...btnGhost,
                    flex: 1,
                    borderColor: partySlotEdit === i ? theme.accent.primary : theme.stroke.secondary,
                  }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {Array.from({ length: slots }, (_, i) => {
                const id = mining.partyIds[i];
                const item = id ? REWARD_LOOKUP[id] : null;
                const lv = id ? getBuddyEntry(buddyProgress, id).level : 0;
                return (
                  <div key={i} style={{ fontSize: 12, fontWeight: 700, color: theme.text.secondary, lineHeight: 1.45 }}>
                    スロット{i + 1}:{" "}
                    {item
                      ? `${item.label} Lv${lv} · とくい ${specialtyBlurb(item.category)}`
                      : "空"}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={card}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>カテゴリ → 出やすい素材</div>
            <div style={{ fontSize: 12, color: theme.text.secondary, marginBottom: 8, lineHeight: 1.5 }}>
              カテゴリをタップすると、候補がそのカテゴリだけになるよ。
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setPartyCategoryFilter(null)}
                style={{
                  ...btnGhost,
                  padding: "8px 10px",
                  borderColor: partyCategoryFilter === null ? theme.accent.primary : theme.stroke.secondary,
                  backgroundColor: partyCategoryFilter === null ? `${theme.accent.primary}18` : theme.fill.secondary,
                  color: partyCategoryFilter === null ? theme.accent.primary : theme.text.primary,
                }}
              >
                すべて
              </button>
              {partyCategoryFilter && (
                <span style={{ fontSize: 12, fontWeight: 800, color: theme.accent.primary, alignSelf: "center" }}>
                  絞り込み中
                </span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {STICKER_CATEGORIES.map((cat) => {
                const spec = specialtyOfCategory(cat.id);
                const meta = SPECIALTY_META[spec];
                const selected = partyCategoryFilter === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setPartyCategoryFilter((prev) => (prev === cat.id ? null : cat.id));
                      setPartySlotEdit((prev) => (prev === null ? 0 : prev));
                    }}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 8,
                      alignItems: "center",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1.5px solid ${selected ? theme.accent.primary : theme.stroke.secondary}`,
                      background: selected ? `${theme.accent.primary}18` : theme.fill.secondary,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      textAlign: "left",
                      color: theme.text.primary,
                    }}
                  >
                    <span>{cat.label}</span>
                    <span style={{ color: theme.accent.primary }}>
                      {meta.emoji} {meta.label}
                      <span style={{ marginLeft: 6, color: theme.text.tertiary, fontWeight: 700 }}>
                        {meta.gachaHint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {partySlotEdit !== null && (
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <strong>スロット{partySlotEdit + 1}</strong>
                <button
                  type="button"
                  style={{ ...btnGhost, padding: "6px 10px" }}
                  onClick={() => {
                    onChange(setPartySlot(mining, partySlotEdit, null));
                    showToast("はずしたよ");
                  }}
                >
                  はずす
                </button>
              </div>
              {partyCandidates.length === 0 ? (
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.text.tertiary, padding: "12px 4px" }}>
                  このカテゴリのシールはまだないよ
                </div>
              ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, maxHeight: 360, overflowY: "auto" }}>
                {partyCandidates.map((item) => {
                  const lv = getBuddyEntry(buddyProgress, item.id).level;
                  const blurb = specialtyBlurb(item.category);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onEnsureStickers?.([item.id]);
                        onChange(setPartySlot(mining, partySlotEdit, item.id));
                        showToast(`${item.label} を入れた！（とくい ${blurb}）`);
                        setPartySlotEdit(null);
                      }}
                      style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, textAlign: "left" }}
                    >
                      <StickerThumb item={item} level={lv} />
                      <div style={{ fontSize: 10, fontWeight: 700, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: theme.accent.primary, lineHeight: 1.3, marginTop: 2 }}>
                        {blurb}
                      </div>
                      {!stickerAlbum.includes(item.id) && (
                        <div style={{ fontSize: 10, fontWeight: 800, color: theme.category.orange, marginTop: 2 }}>
                          未所持→入れると追加
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              )}
            </div>
          )}
        </div>
      )}

      {!overlay && tab === "bag" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={card}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>こうかん所</div>
            <div style={{ fontSize: 12, color: theme.text.secondary, marginBottom: 8, lineHeight: 1.5 }}>
              採掘ポイント（⚡）を素材にかえたり、ネザークォーツを⚡にかえたりできるよ。
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                style={btnGhost}
                onClick={() => {
                  const r = exchangeQuartzForPoints(mining);
                  if (r.error) showToast(r.error);
                  else { onChange(r.state); showToast(`ネザークォーツを⚡${QUARTZ_TO_POINTS}にかえした！`); }
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <MiningItemIcon material="nether_quartz" size={18} alt="" />
                  クォーツ1 → ⚡{QUARTZ_TO_POINTS}
                </span>
              </button>
              <button
                type="button"
                style={btnGhost}
                onClick={() => {
                  const r = exchangePointsForLog(mining);
                  if (r.error) showToast(r.error);
                  else { onChange(r.state); showToast("原木を1つこうかんした！"); }
                }}
              >
                原木1（⚡{exchangeCost(EXCHANGE_LOG_COST, mining)}）
              </button>
              <button
                type="button"
                style={btnGhost}
                onClick={() => {
                  const r = exchangePointsForCobble(mining);
                  if (r.error) showToast(r.error);
                  else { onChange(r.state); showToast("丸石を1つこうかんした！"); }
                }}
              >
                丸石1（⚡{exchangeCost(8, mining)}）
              </button>
              <button
                type="button"
                style={btnGhost}
                onClick={() => {
                  const r = exchangePointsForWool(mining);
                  if (r.error) showToast(r.error);
                  else { onChange(r.state); showToast("羊毛を1つこうかんした！"); }
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <MiningItemIcon material="wool" size={18} alt="" />
                  羊毛1（⚡{exchangeCost(EXCHANGE_WOOL_COST, mining)}）
                </span>
              </button>
              <button
                type="button"
                style={btnGhost}
                onClick={() => {
                  const r = exchangePointsForDebris(mining);
                  if (r.error) showToast(r.error);
                  else { onChange(r.state); showToast("古代の残骸を1つこうかんした！"); }
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <MiningItemIcon material="ancient_debris" size={18} alt="" />
                  残骸1（⚡{exchangeCost(EXCHANGE_DEBRIS_COST, mining)}）
                </span>
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: theme.text.tertiary, lineHeight: 1.45 }}>
              ネザーの主ドロップはクォーツ。金の原石はたまに出るよ。羊毛・残骸のこうかんは高めの救済だよ。
              {netheriteFullComplete(mining) && (
                <span style={{ display: "block", marginTop: 4, color: theme.category.green, fontWeight: 800 }}>
                  ネザライトそろい特典: ネザーで残骸が出やすい＋たまに+1
                </span>
              )}
            </div>
          </div>

          <div style={card}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>素材</div>
            <div style={{ fontSize: 12, color: theme.text.secondary, marginBottom: 8 }}>タップするとクラフトへ行くよ</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {(Object.keys(MATERIAL_META) as MaterialId[]).map((id) => {
                const n = have(id);
                if (n <= 0 && id !== "log" && id !== "plank" && id !== "stick" && id !== "wool" && id !== "cobble") return null;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { setOverlay(null); setTab("craft"); }}
                    style={{
                      minWidth: 72,
                      padding: 8,
                      borderRadius: 10,
                      background: theme.fill.secondary,
                      border: `1px solid ${theme.stroke.tertiary}`,
                      cursor: "pointer",
                      textAlign: "left",
                      color: theme.text.primary,
                    }}
                  >
                    <MiningItemIcon material={id} size={32} alt={MATERIAL_META[id].label} />
                    <div style={{ fontSize: 12, fontWeight: 800 }}>{MATERIAL_META[id].label}</div>
                    <div style={{ fontWeight: 900 }}>{n}</div>
                  </button>
                );
              })}
            </div>
          </div>
          <div style={card}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>つくったもの</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <span style={{ ...btnGhost, padding: "8px 10px", cursor: "default", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <MiningItemIcon bed size={22} alt="ベッド" />
                ベッド ×{slots}
              </span>
              {Object.keys(mining.crafted).filter((k) => mining.crafted[k as CraftedGearId]).map((id) => (
                <span key={id} style={{ ...btnGhost, padding: "8px 10px", cursor: "default", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <MiningItemIcon gear={id as CraftedGearId} size={22} alt="" />
                  {gearLabel(id as CraftedGearId)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {!overlay && tab === "mine" && (
        <div
          style={{
            position: "fixed",
            left: 16,
            right: 72,
            bottom: "max(env(safe-area-inset-bottom, 16px), 16px)",
            zIndex: 35,
          }}
        >
          <button
            type="button"
            onClick={onDig}
            disabled={digDisabled}
            style={{
              ...btnPrimary,
              width: "100%",
              fontSize: 16,
              padding: "14px 16px",
              opacity: digDisabled ? 0.45 : 1,
            }}
          >
            🎫{mining.tickets}枚 · 1枚でほる
          </button>
        </div>
      )}

      <DigFxOverlay
        phase={digFx}
        gacha={selectedGacha}
        result={lastDig}
        onClose={closeDigFx}
      />

      {toast && (
        <div style={{
          position: "fixed", left: 16, right: 16,
          bottom: tab === "mine"
            ? "calc(max(env(safe-area-inset-bottom, 16px), 16px) + 64px)"
            : 24,
          zIndex: 200,
          padding: "12px 16px", borderRadius: 14, background: "rgba(0,0,0,0.82)",
          color: "#fff", fontWeight: 800, textAlign: "center",
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
