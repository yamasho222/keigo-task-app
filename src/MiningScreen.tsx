import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { theme } from "./theme";
import { ScrollSafeBackButton } from "./ScrollSafeBackButton";
import { StickerFrameWithBadge, StickerImg } from "./Rewards";
import { BuddyFrame } from "./BuddyFrame";
import { getBuddyEntry, type BuddyProgressMap } from "./buddyProgress";
import { REWARD_LOOKUP, STICKER_CATEGORIES, type RewardCategory, type RewardLookupEntry } from "./stickerRewards";
import { playGachaAmbient, playMiningSfx, unlockAudio } from "./alarm";
import {
  EXCHANGE_BUY_OFFERS,
  QUARTZ_TO_POINTS,
  NETHERRACK_TO_POINTS,
  bestOwnedTool,
  canAffordRecipe,
  equipArmor,
  equipHeld,
  equipTool,
  exchangeCost,
  exchangePointsForMaterial,
  exchangeQuartzForPoints,
  exchangeNetherrackForPoints,
  gachaLockBadge,
  gachaLockHint,
  hasBucket,
  hasEnchantingTable,
  hasFurnace,
  hasSmithingTable,
  hasWorkbench,
  luckyGachaForDate,
  netheriteFullComplete,
  ownedArmorForSlot,
  previewDigBoost,
  recommendToolKind,
  strippedMiningStateForOdds,
  compareDigCountOdds,
  recipesForState,
  refreshUnlocks,
  resolveBucketFill,
  resolveDig,
  resolveHelmetRockHint,
  digHitTier,
  isDigHighlightDrop,
  setPartySlot,
  tryCraft,
  type DigBoostPreview,
  type DigHitTier,
  type DigResult,
  type HelmetRockHint,
  type MiningRecipe,
  type OddsSegment,
} from "./miningProgress";
import {
  WARPED_WART_TO_POINTS,
  exchangeWarpedWartForPoints,
  isCombatGacha,
  isEndChapterDevEnabled,
  resolveCombat,
  applyCombatSpecialFinish,
  resolveCombatHelmetHint,
  livingMobs,
  settleCombatEncounter,
  shuffleCombatTiers,
  type CombatGachaId,
  type CombatResult,
  type CombatTier,
} from "./miningCombat";
import { MiningCombatPanel } from "./MiningCombatPanel";
import { beginSpecialAttack, canPlayerFight, revivePlayer, specialGaugeReady, syncPlayerHpForDate } from "./playerCombat";
import { EndPortalPanel } from "./EndPortalPanel";
import { EndDragonPanel, type DragonFx } from "./EndDragonPanel";
import { EndCinematicOverlay, type EndCinematicKind, type IncomingKind, type SlashEmphasis } from "./endFx";
import { SpecialFinale, SpecialTapRush, YouDiedOverlay } from "./CombatOverlays";
import {
  applyEndQuestOnVisit,
  describeEndQuestChange,
  ensureDragonFight,
  insertPortalEye,
  isEndPortalGacha,
  isTheEndGacha,
  listsMiningDestination,
  nextLivingCrystal,
  showsEndHuntHint,
  showsEnderEyeHoldHint,
  resolveDragonAttack,
  applyDragonSpecialFinish,
  unlockTheEnd,
  type DragonTarget,
} from "./endChapter";
import {
  patchFromResult,
  rebaseMiningWrite,
  type MiningPatch,
} from "./miningCommit";
import {
  CRAFT_RECIPE_TABS,
  NETHERITE_UPGRADE_REQUIRES,
  craftGridForRecipe,
  craftTabForRecipeId,
  maxCraftTimes,
  recipeMatchesCraftTab,
  recipeProgress,
  smeltQtyStep,
  alignCraftTimes,
  coalSmeltRemainderWarning,
  type CraftRecipeTab,
  type RecipeId,
} from "./miningRecipes";
import { MiningItemIcon } from "./MiningItemIcon";
import { MiningEnchantPanel } from "./MiningEnchantPanel";
import {
  bargainStars,
  demoDigLines,
  listActiveEnchants,
  sumEnchantBonus,
} from "./miningEnchant";
import {
  boostStrengthLabel,
  buildNextHero,
  craftTutorialBanner,
  detectChapterMoments,
  detectProgressNudge,
  digRevealTitle,
  gachaForMaterial,
  nextGachaUnlock,
  recipeEffectLine,
  recommendedCraftRecipeIds,
  showIronRouteGuide,
  type ChapterMoment,
  type ProgressNudge,
} from "./miningUiHelpers";
import {
  ARMOR_KIND_LABEL,
  ARMOR_EFFECT_SHORT,
  ARMOR_EFFECT_BLURB,
  armorTierEffectCopy,
  armorTierFromGearId,
  DIG_BLOCK_IMAGE,
  ENCHANT_META,
  ENCHANT_TARGET_LABEL,
  ENCHANTING_TABLE_IMAGE,
  CHEST_IMAGE,
  EMERALD_IMAGE,
  STEVE_IMAGE,
  GACHA_META,
  GACHA_ORDER,
  MATERIAL_META,
  MAX_BEDS,
  TOOL_EFFECT_BLURB,
  SPECIALTY_META,
  specialtyBlurb,
  specialtyOfCategory,
  gearLabel,
  getMaterialCount,
  isBucketGacha,
  isChestGacha,
  parseToolId,
  partySlotCount,
  type CraftedGearId,
  type EnchantId,
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
  onChange: (patch: MiningPatch) => void;
  onBack: () => void;
  /** 開発メニューから特定画面へ飛ばす */
  devJump?: MiningDevJump | null;
  onDevJumpConsumed?: () => void;
}

export type MiningDevJump = {
  nonce: number;
  tab: "mine" | "craft" | "bag";
  destStep?: "place" | "rock";
  craftTab?: CraftRecipeTab;
  highlightRecipeId?: string;
};

type TabId = "mine" | "craft" | "bag";
type OverlayId = "party" | "equip" | "enchant" | "digDestination" | null;
type DigFxPhase = "idle" | "crack" | "break" | "reveal";
type DigDestStep = "place" | "rock";
type ArmorSlot = "helmet" | "chest" | "leggings" | "boots";
type ToastKind = "normal" | "progress";

const HOLDABLE_MATERIALS: MaterialId[] = ["water", "lava", "ender_eye", "spare_bed"];
const ENDER_EYE_IMAGE = MATERIAL_META.ender_eye.image ?? "/mining/Eye_of_Ender.png";

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

function ExchangeShopChip({
  material,
  src,
  label,
  amount,
}: {
  material?: MaterialId;
  src?: string;
  label: string;
  amount: number;
}) {
  return (
    <span className="mining-exchange-side">
      <MiningItemIcon material={material} src={src} size={20} alt="" emoji={src ? "💚" : undefined} />
      {label}×{amount}
    </span>
  );
}

function ExchangeShopRow({
  give,
  get,
  owned,
  disabled,
  onClick,
}: {
  give: { material?: MaterialId; src?: string; label: string; amount: number };
  get: { material?: MaterialId; src?: string; label: string; amount: number };
  owned: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="mining-exchange-row"
      disabled={disabled}
      onClick={onClick}
    >
      <div className="mining-exchange-row-main">
        <ExchangeShopChip {...give} />
        <span className="mining-exchange-arrow">→</span>
        <ExchangeShopChip {...get} />
      </div>
      <div className="mining-exchange-owned">{owned}</div>
    </button>
  );
}

function MiningSlot({
  material,
  amount,
  size = 48,
  highlight = false,
}: {
  material: MaterialId;
  amount: number;
  size?: number;
  highlight?: boolean;
}) {
  const icon = Math.round(size * 0.62);
  return (
    <div
      className={`mining-slot${highlight ? " is-highlight" : ""}`}
      style={{ width: size, height: size }}
      title={`${MATERIAL_META[material].label} ×${amount}`}
    >
      <MiningItemIcon material={material} size={icon} alt={MATERIAL_META[material].label} />
      {amount > 0 && <span className="mining-slot-count">{amount}</span>}
    </div>
  );
}

const DIG_REVEAL_ICON_CAP = 5;

const ODDS_BAR_COLORS: Record<string, string> = {
  "1": "#78909C",
  "+1": "#43A047",
  "+3": "#FB8C00",
  "2": "#43A047",
  "3": "#FB8C00",
  "4+": "#F9A825",
};

function oddsPct(rate: number): string {
  const n = Math.round(rate * 100);
  if (n <= 0 && rate > 0) return "1%";
  return `${n}%`;
}

function MiningOddsBar({ title, segments }: { title: string; segments: OddsSegment[] }) {
  const visible = segments.filter((s) => s.rate > 0.002);
  if (!visible.length) return null;
  const aria = `${title} ${visible.map((s) => `${s.label} ${oddsPct(s.rate)}`).join(" ")}`;
  return (
    <div className="mining-odds">
      <div className="mining-odds-title">{title}</div>
      <div className="mining-odds-bar" role="img" aria-label={aria}>
        {visible.map((s) => (
          <div
            key={s.key}
            className="mining-odds-seg"
            style={{
              flexGrow: Math.max(s.rate, 0.03),
              flexBasis: 0,
              flexShrink: 1,
              background: ODDS_BAR_COLORS[s.key] ?? "#90A4AE",
              color: s.key === "4+" ? "#3E2723" : "#fff",
            }}
          >
            {s.rate >= 0.16 ? s.label : ""}
          </div>
        ))}
      </div>
      <div className="mining-odds-legend">
        {visible.map((s) => (
          <span key={s.key} className="mining-odds-legend-item">
            <span
              className="mining-odds-dot"
              style={{ background: ODDS_BAR_COLORS[s.key] ?? "#90A4AE" }}
            />
            {s.label} {oddsPct(s.rate)}
          </span>
        ))}
      </div>
    </div>
  );
}

function expectedCountLabel(n: number): string {
  return n.toFixed(1);
}

function MiningCountOddsCompare({
  bare,
  current,
}: {
  bare: OddsSegment[];
  current: OddsSegment[];
}) {
  const rows = compareDigCountOdds(bare, current);
  const changed = rows.some((row) => Math.abs(row.after - row.before) >= 0.005);
  if (!changed) {
    return <div className="mining-odds-note">そうびやなかまがまだないよ</div>;
  }
  return (
    <div className="mining-odds-compare">
      <div className="mining-odds-title">かわりかた</div>
      {rows.map((row) => {
        const delta = row.after - row.before;
        const deltaText = Math.abs(delta) < 0.005
          ? "おなじ"
          : `${delta > 0 ? "+" : ""}${oddsPct(delta)}`;
        return (
          <div key={row.key} className="mining-odds-compare-row">
            <span className="mining-odds-compare-label">{row.label}</span>
            <span className="mining-odds-compare-nums">
              {oddsPct(row.before)} → {oddsPct(row.after)}
            </span>
            <span
              className={`mining-odds-compare-delta${delta > 0.005 ? " is-up" : delta < -0.005 ? " is-down" : ""}`}
            >
              {deltaText}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MiningStrengthDetails({
  boost,
  bareBoost,
  strength,
  selectedGacha,
  mining,
}: {
  boost: DigBoostPreview;
  bareBoost: DigBoostPreview;
  strength: ReturnType<typeof boostStrengthLabel>;
  selectedGacha: GachaId;
  mining: MiningState;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 800, fontSize: 13 }}>いまのつよさ</div>
        <div style={{ fontSize: 14, fontWeight: 900, color: strength.color }}>{strength.label}</div>
      </div>
      <div className="mining-odds-place">
        {GACHA_META[selectedGacha].label}
        {boost.usedTool ? ` ・ ${gearLabel(boost.usedTool)}` : " ・ どうぐなし"}
      </div>
      {boost.bucketMode ? (
        <div className="mining-odds-note">あたりを選ぶと +1こ</div>
      ) : (
        <>
          <MiningOddsBar
            title={`そうびなし（だいたい${expectedCountLabel(bareBoost.expectedCount)}こ）`}
            segments={bareBoost.finalOdds}
          />
          <MiningOddsBar
            title={`いま（だいたい${expectedCountLabel(boost.expectedCount)}こ）`}
            segments={boost.finalOdds}
          />
          <MiningCountOddsCompare bare={bareBoost.finalOdds} current={boost.finalOdds} />
          <div className="mining-odds-armor">
            <div className="mining-odds-title">なかま</div>
            <div className="mining-odds-armor-row">
              <span className="mining-odds-armor-slot">+1こ</span>
              <span className="mining-odds-armor-text">
                {boost.partyPlus1Rate > 0
                  ? `${oddsPct(boost.partyPlus1Rate)}${boost.partyDetail.length ? ` ・ ${boost.partyDetail.join(" / ")}` : ""}`
                  : mining.partyIds.some(Boolean)
                    ? "いまの場所では効かない"
                    : "なかまがいないよ"}
              </span>
            </div>
          </div>
        </>
      )}
      {boost.armorNotes.length > 0 && (
        <div className="mining-odds-armor">
          <div className="mining-odds-title">ほかのぼうぐ</div>
          {boost.armorNotes.map((note) => (
            <div key={note.slot} className="mining-odds-armor-row">
              <span className="mining-odds-armor-slot">
                <MiningItemIcon gear={note.gear} size={14} alt="" />
                {ARMOR_KIND_LABEL[note.slot]}
              </span>
              <span className="mining-odds-armor-text">{note.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiningDigRevealDrops({
  drops,
  tier,
  ownedCount,
}: {
  drops: { material: MaterialId; amount: number }[];
  tier: DigHitTier;
  ownedCount: (id: MaterialId) => number;
}) {
  let iconIndex = 0;
  return (
    <div className="mining-dig-reveal-stack">
      {drops.map((d, di) => {
        const highlight = isDigHighlightDrop(d.material, d.amount, tier);
        const shown = Math.max(0, Math.min(d.amount, DIG_REVEAL_ICON_CAP));
        const overflow = d.amount > DIG_REVEAL_ICON_CAP;
        const label = MATERIAL_META[d.material].label;
        const startIndex = iconIndex;
        iconIndex += shown;
        const owned = ownedCount(d.material);
        return (
          <div key={`${d.material}-${di}`} className="mining-dig-reveal-row">
            <div className="mining-dig-reveal-icons">
              {Array.from({ length: shown }, (_, i) => (
                <span
                  key={i}
                  className={`mining-dig-reveal-icon${highlight ? " is-highlight" : ""}${tier === "great" && highlight ? " is-great" : ""}`}
                  style={{ animationDelay: `${(startIndex + i) * 0.08}s` }}
                >
                  <MiningItemIcon
                    material={d.material}
                    size={64}
                    alt={i === 0 ? label : ""}
                  />
                </span>
              ))}
              {overflow && <span className="mining-dig-reveal-more">ほか</span>}
            </div>
            <span className="mining-dig-slot-label">{label}</span>
            <div className="mining-fp-result-got">+{d.amount}こゲット</div>
            <div className="mining-fp-result-total">いま {owned}こ</div>
          </div>
        );
      })}
    </div>
  );
}

function CraftGridPreview({ cells }: { cells: (MaterialId | null)[] }) {
  return (
    <div className="mining-craft-grid" aria-hidden>
      {cells.map((cell, i) => (
        <div key={i} className="mining-craft-grid-cell">
          {cell ? <MiningItemIcon material={cell} size={18} alt="" /> : null}
        </div>
      ))}
    </div>
  );
}

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
          }}
        >
          <StickerImg
            src={item.image}
            alt={item.label}
            padding={4}
            objectFit={item.imageFit ?? "contain"}
          />
        </StickerFrameWithBadge>
      </BuddyFrame>
    </div>
  );
}

function PartySilhouette({
  item,
  size = 36,
}: {
  item: RewardLookupEntry;
  size?: number;
}) {
  return (
    <div className="mining-dig-party-sil" style={{ width: size, height: size }}>
      <StickerImg src={item.image} alt="" padding={2} objectFit={item.imageFit ?? "contain"} />
    </div>
  );
}

function DigCrackOverlay({
  stage,
  maxStage,
  gacha,
  result,
  partyItems,
  shaking,
  hitting,
  breaking,
  digHitPulse,
  onHit,
}: {
  stage: number;
  maxStage: number;
  gacha: GachaId;
  result: DigResult | null;
  partyItems: { id: string; item: RewardLookupEntry }[];
  shaking: boolean;
  hitting: boolean;
  breaking: boolean;
  digHitPulse: number;
  onHit: () => void;
}) {
  const meta = GACHA_META[gacha];
  const blockTone = BLOCK_TONE[gacha];
  const progress = Math.min(1, stage / maxStage);
  const [blockImgOk, setBlockImgOk] = useState(true);
  const foreshadow = result ? digHitTier(result) : "normal";

  useEffect(() => {
    setBlockImgOk(true);
  }, [gacha]);

  return (
    <div
      className={[
        "mining-fp-scene",
        `biome-${gacha}`,
        shaking ? "is-shake" : "",
        hitting ? "is-hit" : "",
        breaking ? "is-breaking" : "",
        foreshadow === "great" && stage >= Math.ceil(maxStage * 0.45) ? "is-rare-glow" : "",
        foreshadow === "good" && stage >= Math.ceil(maxStage * 0.6) ? "is-rare-glow" : "",
      ].filter(Boolean).join(" ")}
      onPointerDown={(e) => {
        e.preventDefault();
        if (!breaking) onHit();
      }}
      role="button"
      tabIndex={0}
      aria-label="ブロックをほる"
    >
      <div className="mining-fp-vignette" />
      <div className="mining-fp-depth" />

      {partyItems.length > 0 && (
        <div className="mining-fp-party">
          {partyItems.slice(0, 3).map(({ id, item }) => (
            <PartySilhouette key={id} item={item} size={40} />
          ))}
        </div>
      )}

      <div className="mining-fp-stage">
        <div
          className={`mining-fp-block${breaking ? " is-shatter" : ""}`}
          style={{
            ["--block-front" as string]: blockTone.front,
            ["--block-edge" as string]: blockTone.edge,
          }}
        >
          <div className="mining-fp-block-face">
            {blockImgOk ? (
              <img
                className="mining-fp-block-tex"
                src={DIG_BLOCK_IMAGE[gacha]}
                alt=""
                draggable={false}
                onError={() => setBlockImgOk(false)}
              />
            ) : (
              <div className="mining-fp-block-fallback" aria-hidden />
            )}
            {!breaking && stage > 0 && <DestroyStageOverlay stage={stage} maxStage={maxStage} />}
            {hitting && !breaking && <span className="mining-fp-impact" />}
          </div>
          {breaking && (
            <div className="mining-fp-shards" aria-hidden>
              {Array.from({ length: 28 }, (_, i) => (
                <span
                  key={i}
                  className={`mining-fp-shard s${i % 18}`}
                  style={{
                    background: i % 2 === 0 ? blockTone.front : blockTone.side,
                    width: 6 + (i % 4) * 2,
                    height: 6 + ((i + 1) % 3) * 2,
                    animationDelay: `${(i % 8) * 14}ms`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        key={breaking ? "break" : hitting ? `swing-${digHitPulse}` : "idle"}
        className={`mining-fp-arm${breaking ? " is-break-pose" : hitting ? " is-swing" : " is-idle"}`}
      >
        <div className="mining-fp-viewmodel">
          <div className="mining-fp-sleeve" aria-hidden />
          <div className="mining-fp-tool">
            {result?.usedTool ? (
              <MiningItemIcon gear={result.usedTool} size={148} alt="" />
            ) : (
              <span className="mining-fp-hand-emoji">⛏️</span>
            )}
          </div>
        </div>
      </div>

      {hitting && !breaking && <div className="mining-fp-strike-flash" aria-hidden />}

      <div className="mining-fp-hud">
        <div className="mining-fp-place">{meta.label}</div>
        <div className="mining-fp-bar">
          <div className="mining-fp-bar-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="mining-fp-hint">{breaking ? "こわれた！" : "どうぐでほる"}</div>
      </div>
    </div>
  );
}

const BLOCK_TONE: Record<GachaId, { top: string; front: string; side: string; edge: string }> = {
  wood: { top: "#6d9b45", front: "#8f6a3e", side: "#6e4f2c", edge: "#3d2a16" },
  farm: { top: "#c8e6a0", front: "#8fbc5a", side: "#6a9a3a", edge: "#3d5a1a" },
  ranch: { top: "#e8d090", front: "#c4a05a", side: "#9a7a3a", edge: "#5a4018" },
  stone: { top: "#9aa0a6", front: "#7d838a", side: "#5f646a", edge: "#2f3338" },
  river: { top: "#7ec8e8", front: "#4a9fc4", side: "#2a7a90", edge: "#0a3a48" },
  iron: { top: "#c4cdd6", front: "#8a959f", side: "#6a737c", edge: "#3a424a" },
  coal: { top: "#5a5a5a", front: "#3d3d3d", side: "#2a2a2a", edge: "#111" },
  gold: { top: "#f0d060", front: "#c9a227", side: "#9a7a14", edge: "#5a4408" },
  lava_cave: { top: "#e07030", front: "#c04018", side: "#8a2010", edge: "#3a0a08" },
  diamond: { top: "#6ad4e8", front: "#2aa8c4", side: "#1a7a90", edge: "#0a3a48" },
  lapis_cave: { top: "#4a6ad4", front: "#2a48a8", side: "#1a3070", edge: "#0a1840" },
  nether: { top: "#8b3a32", front: "#6b241e", side: "#4a1512", edge: "#220a08" },
  bastion: { top: "#6a5344", front: "#4a372c", side: "#2e221c", edge: "#140e0c" },
  warped_forest: { top: "#2a6a6a", front: "#1a4a4a", side: "#0e3333", edge: "#061818" },
  fortress: { top: "#6b241e", front: "#4a1512", side: "#2a0c0a", edge: "#140606" },
  end_portal: { top: "#3a2a5a", front: "#2a1a40", side: "#1a1028", edge: "#0c0814" },
  the_end: { top: "#2a1a40", front: "#1a1028", side: "#120818", edge: "#080410" },
};

/**
 * 本家 destroy_stage 風: 16×16の暗いドットが中央付近から徐々に増える。
 * 線のひび割れではなく、半透明の黒／灰色ピクセルのオーバーレイ。
 */
const DESTROY_N = 16;

function hash2(x: number, y: number) {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** 中央から伸びるクラック骨格（ピクセル座標） */
function crackDistance(x: number, y: number): number {
  const cx = 7.5;
  const cy = 7.5;
  // 複数の折れ線への最短距離
  const branches: [number, number][][] = [
    [[cx, cy], [8, 5], [7, 2], [6, 0]],
    [[cx, cy], [10, 6], [12, 3], [14, 1]],
    [[cx, cy], [5, 7], [2, 6], [0, 5]],
    [[cx, cy], [9, 10], [11, 12], [13, 14]],
    [[cx, cy], [6, 10], [4, 12], [2, 15]],
    [[cx, cy], [10, 8], [13, 9], [15, 10]],
    [[cx, cy], [7, 9], [8, 12], [9, 15]],
    [[cx, cy], [5, 5], [3, 3], [1, 1]],
  ];
  let best = 99;
  for (const branch of branches) {
    for (let i = 0; i < branch.length - 1; i++) {
      const [x0, y0] = branch[i];
      const [x1, y1] = branch[i + 1];
      const d = distToSegment(x, y, x0, y0, x1, y1);
      if (d < best) best = d;
    }
  }
  return best;
}

function distToSegment(px: number, py: number, x0: number, y0: number, x1: number, y1: number) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - x0) * dx + (py - y0) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const qx = x0 + t * dx;
  const qy = y0 + t * dy;
  return Math.hypot(px - qx, py - qy);
}

/** stage 1..max → 0=透明, 1=灰色, 2=黒 */
function computeDestroyPixels(stage: number, maxStage: number): Uint8Array {
  const out = new Uint8Array(DESTROY_N * DESTROY_N);
  if (stage <= 0) return out;
  // 本家は destroy_stage_0..9 の10段階
  const s = Math.max(0, Math.min(9, Math.round(((stage - 1) / Math.max(1, maxStage - 1)) * 9)));
  const cx = 7.5;
  const cy = 7.5;
  // 見える半径が段階で広がる（中央→全面）
  const radius = 1.6 + s * 1.25;

  for (let y = 0; y < DESTROY_N; y++) {
    for (let x = 0; x < DESTROY_N; x++) {
      const dist = Math.hypot(x - cx, y - cy);
      if (dist > radius + 0.8) continue;

      const cd = crackDistance(x + 0.5, y + 0.5);
      const n = hash2(x + s * 3, y + s * 5);
      const n2 = hash2(x * 9 + 1, y * 7 + s);

      // 骨格に近いほど早く出る。段階が進むと骨格周辺の「にじみ」も増える
      const alongCrack = cd < 0.65 + s * 0.04;
      const nearCrack = cd < 1.15 + s * 0.06;
      const mottled = s >= 4 && n > 0.82 - s * 0.02 && dist < radius * 0.92;
      const lateFill = s >= 7 && n2 > 0.7 && dist < radius;

      // 外周は少なめ（本家も端まで真っ黒にはならない）
      const edgeFade = dist > radius - 0.9 ? n2 > 0.55 : true;

      if (!edgeFade) continue;

      let shade = 0;
      if (alongCrack && dist <= radius) {
        shade = n > 0.4 ? 1 : 2;
      } else if (nearCrack && s >= 1 && n > 0.55 - s * 0.03) {
        shade = 1;
      } else if (mottled) {
        shade = n2 > 0.5 ? 1 : 2;
      } else if (lateFill) {
        shade = 1;
      }

      // ごく初期は中央付近の点だけ
      if (s <= 1 && dist > 3.2) shade = 0;
      if (s === 0 && (dist > 2.4 || cd > 0.7)) shade = 0;

      out[y * DESTROY_N + x] = shade;
    }
  }
  return out;
}

function DestroyStageOverlay({ stage, maxStage }: { stage: number; maxStage: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, DESTROY_N, DESTROY_N);
    const pixels = computeDestroyPixels(stage, maxStage);
    const img = ctx.createImageData(DESTROY_N, DESTROY_N);
    for (let i = 0; i < pixels.length; i++) {
      const v = pixels[i];
      if (!v) continue;
      const o = i * 4;
      if (v === 1) {
        // 暗い灰色（本家オーバーレイの薄いクラック）
        img.data[o] = 48;
        img.data[o + 1] = 48;
        img.data[o + 2] = 48;
        img.data[o + 3] = 150;
      } else {
        // ほぼ黒
        img.data[o] = 12;
        img.data[o + 1] = 12;
        img.data[o + 2] = 12;
        img.data[o + 3] = 200;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [stage, maxStage]);

  return (
    <canvas
      ref={ref}
      className="mining-fp-destroy"
      width={DESTROY_N}
      height={DESTROY_N}
      aria-hidden
    />
  );
}

function DigFxOverlay({
  phase,
  crackStage,
  maxCrackStage,
  gacha,
  result,
  partyItems,
  digHitPulse,
  canDigAgain,
  ownedCount,
  onCrackTap,
  onDigAgain,
  onClose,
}: {
  phase: DigFxPhase;
  crackStage: number;
  maxCrackStage: number;
  gacha: GachaId;
  result: DigResult | null;
  partyItems: { id: string; item: RewardLookupEntry }[];
  digHitPulse: number;
  canDigAgain: boolean;
  ownedCount: (id: MaterialId) => number;
  onCrackTap: () => void;
  onDigAgain: () => void;
  onClose: () => void;
}) {
  const [reasonsOpen, setReasonsOpen] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [hitting, setHitting] = useState(false);

  useEffect(() => {
    setReasonsOpen(false);
  }, [phase, result]);

  useEffect(() => {
    if (digHitPulse <= 0 || phase !== "crack") return;
    setShaking(true);
    setHitting(true);
    const a = window.setTimeout(() => setHitting(false), 340);
    const b = window.setTimeout(() => setShaking(false), 220);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [digHitPulse, phase]);

  if (phase === "idle") return null;
  const meta = GACHA_META[gacha];
  const tier = result && phase === "reveal" ? digHitTier(result) : "normal";
  const revealCopy = digRevealTitle(
    tier,
    result ? result.drops.map((d) => d.material) : [],
  );

  if (phase === "crack" || phase === "break") {
    return (
      <div className="mining-dig-overlay mining-dig-overlay-fp" role="dialog" aria-modal="true">
        <DigCrackOverlay
          stage={crackStage}
          maxStage={maxCrackStage}
          gacha={gacha}
          result={result}
          partyItems={partyItems}
          shaking={shaking}
          hitting={hitting}
          breaking={phase === "break"}
          digHitPulse={digHitPulse}
          onHit={onCrackTap}
        />
      </div>
    );
  }

  return (
    <div className="mining-dig-overlay mining-dig-overlay-fp" role="dialog" aria-modal="true">
      <div
        className={[
          "mining-fp-scene",
          `biome-${gacha}`,
          "is-reveal-result",
          tier === "great" ? "is-rare-glow" : "",
        ].filter(Boolean).join(" ")}
      >
        <div className="mining-fp-vignette" />
        <div className="mining-fp-depth" />
        {partyItems.length > 0 && (
          <div className="mining-fp-party">
            {partyItems.slice(0, 3).map(({ id, item }) => (
              <PartySilhouette key={id} item={item} size={40} />
            ))}
          </div>
        )}
        <div className="mining-fp-result">
          <div className="mining-fp-result-main">
            {(tier === "good" || tier === "great") && (
              <div className="mining-dig-burst" aria-hidden style={{ position: "relative", marginBottom: 4 }}>
                {tier === "great" ? "✦" : "✧"}
              </div>
            )}
            <div className={`mining-fp-result-title${tier !== "normal" ? ` is-${tier}` : ""}`}>
              {revealCopy.title}
            </div>
            {result && <MiningDigRevealDrops drops={result.drops} tier={tier} ownedCount={ownedCount} />}
            {result && tier !== "normal" && result.hitReasons.length > 0 && (
              <div className="mining-dig-hit-reasons">
                <button
                  type="button"
                  className="mining-dig-hit-reasons-toggle"
                  onClick={() => setReasonsOpen((v) => !v)}
                >
                  {reasonsOpen ? "▲" : "▼"} {tier === "great" ? "なぜレア？" : "なぜいいの？"}
                </button>
                {reasonsOpen && result.hitReasons.map((reason) => (
                  <div key={reason} className="mining-dig-hit-reason">・{reason}</div>
                ))}
              </div>
            )}
            {result?.ticketRefunded && (
              <div className="mining-dig-bonus">🎫 チケットがもどった！</div>
            )}
            <div className="mining-dig-actions">
              {canDigAgain && (
                <button type="button" className="mining-dig-again" onClick={onDigAgain}>
                  もういちどほる
                </button>
              )}
              <button type="button" className="mining-dig-close" onClick={onClose}>
                {canDigAgain ? "とじる" : "つぎへ"}
              </button>
            </div>
            <div className="mining-dig-sub" style={{ marginTop: 8 }}>{meta.label}</div>
          </div>
          {result && (
            <div className="mining-dig-breakdown">
              {result.breakdown.join(" · ")}
              {result.usedTool ? ` · ${gearLabel(result.usedTool)}` : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NetherPortalOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    void playMiningSfx("portal");
    const t = window.setTimeout(onClose, 3200);
    return () => window.clearTimeout(t);
  }, [onClose]);

  return (
    <div className="mining-portal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="mining-portal-frame">
        <div className="mining-portal-swirl" />
        <div className="mining-portal-title">ネザー ひらいた！</div>
        <div className="mining-portal-sub">あたらしいばしょだよ</div>
        <button type="button" className="mining-dig-close" onClick={onClose}>つぎへ</button>
      </div>
    </div>
  );
}

function ChapterCelebrateOverlay({
  moment,
  onClose,
}: {
  moment: ChapterMoment;
  onClose: () => void;
}) {
  useEffect(() => {
    void playMiningSfx("chapter");
    navigator.vibrate?.([20, 30, 20, 30, 50]);
    const t = window.setTimeout(onClose, 2800);
    return () => window.clearTimeout(t);
  }, [moment.id, onClose]);

  return (
    <div className="mining-chapter-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="mining-chapter-frame">
        <div className="mining-chapter-burst" aria-hidden>✦</div>
        <div className="mining-chapter-title">{moment.title}</div>
        <div className="mining-chapter-sub">{moment.sub}</div>
        <button type="button" className="mining-dig-close" onClick={onClose}>つぎへ</button>
      </div>
    </div>
  );
}

function CraftSuccessPop({
  label,
  icon,
}: {
  label: string;
  icon: ReactNode;
}) {
  return (
    <div className="mining-craft-pop" aria-hidden>
      <div className="mining-craft-pop-inner">
        <div className="mining-craft-pop-icon">{icon}</div>
        <div className="mining-craft-pop-label">{label}</div>
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
  onBack,
  devJump = null,
  onDevJumpConsumed,
}: Props) {
  const [tab, setTab] = useState<TabId>("mine");
  const [overlay, setOverlay] = useState<OverlayId>(null);
  const [selectedGacha, setSelectedGacha] = useState<GachaId>(() => {
    const last = mining.lastSelectedGacha;
    if (last && mining.unlockedGachas.includes(last)) return last;
    return "wood";
  });
  const [toolKind, setToolKind] = useState<ToolKind>(() => {
    const last = mining.lastSelectedGacha;
    const gacha = last && mining.unlockedGachas.includes(last) ? last : "wood";
    return recommendToolKind(gacha);
  });
  const [lastDig, setLastDig] = useState<DigResult | null>(null);
  const [digFx, setDigFx] = useState<DigFxPhase>("idle");
  const [crackStage, setCrackStage] = useState(0);
  const [digHitPulse, setDigHitPulse] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [toastKind, setToastKind] = useState<ToastKind>("normal");
  const [portalFx, setPortalFx] = useState(false);
  const [partySlotEdit, setPartySlotEdit] = useState<number | null>(null);
  const [partyCategoryFilter, setPartyCategoryFilter] = useState<RewardCategory | null>(null);
  const [partyStep, setPartyStep] = useState<"slots" | "category" | "pick">("slots");
  const [digBusy, setDigBusy] = useState(false);
  const [craftShowAll, setCraftShowAll] = useState(false);
  const [craftTab, setCraftTab] = useState<CraftRecipeTab>("all");
  const [progressNudge, setProgressNudge] = useState<ProgressNudge | null>(null);
  const [fuelChoice, setFuelChoice] = useState<Partial<Record<string, MaterialId>>>({});
  const [craftQty, setCraftQty] = useState<Partial<Record<RecipeId, number>>>({});
  const [chapterQueue, setChapterQueue] = useState<ChapterMoment[]>([]);
  const [craftPop, setCraftPop] = useState<{ label: string; icon: ReactNode } | null>(null);
  const [armorDetailOpen, setArmorDetailOpen] = useState<Partial<Record<ArmorSlot, boolean>>>({});
  const [versionNoticeOpen, setVersionNoticeOpen] = useState(
    () => !mining.miningVersionNoticeSeen,
  );
  const [routeBranchOpen, setRouteBranchOpen] = useState(false);
  const [demoDig, setDemoDig] = useState<EnchantId | null>(null);
  const [heroRepeat, setHeroRepeat] = useState(0);
  const [heroTrustKey, setHeroTrustKey] = useState<string | null>(null);
  const [highlightRecipeId, setHighlightRecipeId] = useState<string | null>(null);
  const [highlightGacha, setHighlightGacha] = useState<GachaId | null>(null);
  const [highlightRocks, setHighlightRocks] = useState(false);
  const [rockLuckyIndex, setRockLuckyIndex] = useState(() => Math.floor(Math.random() * 3));
  const [combatLayout, setCombatLayout] = useState<CombatTier[]>(() => shuffleCombatTiers());
  const [combatBusy, setCombatBusy] = useState(false);
  const [combatFallen, setCombatFallen] = useState<number[]>([]);
  const [combatFlash, setCombatFlash] = useState<number[]>([]);
  const [combatGone, setCombatGone] = useState<number[]>([]);
  const [portalShake, setPortalShake] = useState(false);
  const [insertPulse, setInsertPulse] = useState(0);
  const [heldPickerOpen, setHeldPickerOpen] = useState(false);
  const [dragonTarget, setDragonTarget] = useState<DragonTarget>("dragon");
  const [dragonFx, setDragonFx] = useState<DragonFx | null>(null);
  const [combatSwings, setCombatSwings] = useState(1);
  const [combatHitDamage, setCombatHitDamage] = useState(0);
  const [combatEmphasis, setCombatEmphasis] = useState<SlashEmphasis>("normal");
  const [combatSlashSeed, setCombatSlashSeed] = useState(1);
  const [endCinematic, setEndCinematic] = useState<EndCinematicKind | null>(null);
  const [playerHitHearts, setPlayerHitHearts] = useState<number | null>(null);
  const [playerDiedFx, setPlayerDiedFx] = useState(false);
  const [dragonHeavyHit, setDragonHeavyHit] = useState(false);
  const [incomingFx, setIncomingFx] = useState<{ kind: IncomingKind; hearts: number } | null>(null);
  const [striking, setStriking] = useState<number[]>([]);
  const [tapRush, setTapRush] = useState(false);
  const [specialFinale, setSpecialFinale] = useState<{ taps: number; damage: number } | null>(null);
  const pendingDiscoverRef = useRef(false);
  const [pendingDiscover, setPendingDiscover] = useState(false);
  const combatFxSeq = useRef(0);
  const [digDestStep, setDigDestStep] = useState<DigDestStep>("place");
  const [mineMoreOpen, setMineMoreOpen] = useState(false);
  const [bagNoticeOpen, setBagNoticeOpen] = useState(false);
  const [smeltingId, setSmeltingId] = useState<string | null>(null);
  const [smeltProgress, setSmeltProgress] = useState(0);
  const [pinRect, setPinRect] = useState({ top: 0, left: 0, width: 0, padL: 16, padR: 16, padT: 16 });
  const [chromeHeight, setChromeHeight] = useState(120);
  const [bottomChromeHeight, setBottomChromeHeight] = useState(200);
  const [chromeEl, setChromeEl] = useState<HTMLDivElement | null>(null);
  const [bottomChromeEl, setBottomChromeEl] = useState<HTMLDivElement | null>(null);
  const [rockHint, setRockHint] = useState<HelmetRockHint>({ kind: "none" });
  const crackStageRef = useRef(0);
  const smeltTimerRef = useRef(0);
  const craftLockRef = useRef(false);
  const pendingDigChaptersRef = useRef<ChapterMoment[]>([]);
  const miningRef = useRef(mining);
  miningRef.current = mining;

  useEffect(() => {
    onChange((prev) => syncPlayerHpForDate(prev, dateKey));
  }, [dateKey, onChange]);

  useEffect(() => {
    craftLockRef.current = false;
  }, [mining]);

  useLayoutEffect(() => {
    const scroll = document.querySelector("[data-app-scroll]");
    if (!(scroll instanceof HTMLElement)) return;

    const sync = () => {
      const r = scroll.getBoundingClientRect();
      const cs = getComputedStyle(scroll);
      const padT = parseFloat(cs.paddingTop) || 0;
      const padL = parseFloat(cs.paddingLeft) || 16;
      const padR = parseFloat(cs.paddingRight) || 16;
      setPinRect({
        top: r.top,
        left: r.left,
        width: r.width,
        padL,
        padR,
        padT,
      });
      if (chromeEl) setChromeHeight(chromeEl.offsetHeight);
      if (bottomChromeEl) setBottomChromeHeight(bottomChromeEl.offsetHeight);
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(scroll);
    if (chromeEl) ro.observe(chromeEl);
    if (bottomChromeEl) ro.observe(bottomChromeEl);
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [overlay, tab, chromeEl, bottomChromeEl]);

  /** AppScroll の padding-top 分は既に空いているので、スペーサーはヘッダーのうち中身側＋バッファ */
  const chromeSpacerHeight = Math.max(0, chromeHeight - pinRect.padT + 8);

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
  const bareBoost = useMemo(
    () => previewDigBoost({
      state: strippedMiningStateForOdds(mining),
      gacha: selectedGacha,
      toolKind,
      buddyProgress,
      dateKey,
    }),
    [mining, selectedGacha, toolKind, buddyProgress, dateKey],
  );
  const activeEnchantChips = useMemo(
    () => listActiveEnchants(mining, toolKind).slice(0, 2),
    [mining, toolKind],
  );
  const bargainOff = Math.min(5, sumEnchantBonus(mining, "bargain", bargainStars));

  const partyDigItems = useMemo(() => {
    return mining.partyIds
      .filter((id): id is string => !!id)
      .map((id) => {
        const item = REWARD_LOOKUP[id];
        return item ? { id, item } : null;
      })
      .filter((x): x is { id: string; item: RewardLookupEntry } => !!x)
      .slice(0, 3);
  }, [mining.partyIds]);

  const crackDoneRef = useRef(false);
  const MAX_CRACK_STAGE = 9;

  const finishCrackToBreak = () => {
    if (crackDoneRef.current) return;
    crackDoneRef.current = true;
    setCrackStage(MAX_CRACK_STAGE);
    setDigFx("break");
    void playMiningSfx("break");
    navigator.vibrate?.([30, 40, 50, 40, 70]);
  };

  useEffect(() => {
    if (digFx !== "crack") return;
    crackDoneRef.current = false;
    crackStageRef.current = 0;
    setCrackStage(0);
    let holding = false;
    let timer = 0;

    const bump = () => {
      if (crackDoneRef.current) return;
      const next = Math.min(MAX_CRACK_STAGE, crackStageRef.current + 1);
      crackStageRef.current = next;
      setCrackStage(next);
      setDigHitPulse((n) => n + 1);
      void playMiningSfx("crack");
      navigator.vibrate?.(holding ? 18 : 10);
      if (next >= MAX_CRACK_STAGE) {
        finishCrackToBreak();
        return;
      }
      timer = window.setTimeout(bump, holding ? 280 : 480);
    };

    timer = window.setTimeout(bump, 320);
    const hard = window.setTimeout(() => {
      if (!crackDoneRef.current) finishCrackToBreak();
    }, 4200);

    const onDown = () => { holding = true; };
    const onUp = () => { holding = false; };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(hard);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digFx]);

  useEffect(() => {
    if (digFx !== "break") return;
    const t = window.setTimeout(() => {
      setDigFx("reveal");
      void playMiningSfx("drop");
      if (lastDig) {
        const tier = digHitTier(lastDig);
        if (tier === "great") void playMiningSfx("rare");
      }
    }, 520);
    return () => window.clearTimeout(t);
  }, [digFx, lastDig]);

  useEffect(() => {
    if (digFx !== "reveal" || !lastDig) return;
    const tier = digHitTier(lastDig);
    if (tier === "great") navigator.vibrate?.([28, 35, 28, 35, 70]);
    else if (tier === "good") navigator.vibrate?.([18, 28, 36]);
  }, [digFx, lastDig]);

  const showToast = (msg: string, kind: ToastKind = "normal", durationMs?: number) => {
    setToast(msg);
    setToastKind(kind);
    if (kind === "progress") void playMiningSfx("progress");
    window.setTimeout(
      () => setToast(null),
      durationMs ?? (kind === "progress" ? 2600 : 2200),
    );
  };

  const noteHuntChange = (before: MiningState, after: MiningState) => {
    if (!before.endQuest?.foundPortal && after.endQuest?.foundPortal) {
      pendingDiscoverRef.current = true;
      setPendingDiscover(true);
      return;
    }
    const hunt = describeEndQuestChange(before, after);
    if (hunt) showToast(hunt);
  };

  const flushDiscoverCinematic = () => {
    if (!pendingDiscoverRef.current) return;
    pendingDiscoverRef.current = false;
    setPendingDiscover(false);
    setEndCinematic("discover");
  };

  useEffect(() => {
    if (digFx !== "reveal" || !pendingDiscover) return;
    const t = window.setTimeout(() => {
      flushDiscoverCinematic();
    }, 1200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digFx, pendingDiscover]);

  const have = useCallback((id: MaterialId) => getMaterialCount(mining, id), [mining]);

  const selectToolKind = (kind: ToolKind) => {
    setToolKind(kind);
    onChange((prev) => {
      const best = bestOwnedTool(prev, kind);
      return best ? equipTool(prev, best) : prev;
    });
  };

  /** 行き先を選び、おすすめどうぐを装備し、前回行き先を保存する */
  const chooseGacha = (gid: GachaId) => {
    setSelectedGacha(gid);
    const kind = recommendToolKind(gid);
    setToolKind(kind);
    void unlockAudio();
    playGachaAmbient(gid);
    onChange((prev) => {
      let state: MiningState = { ...prev, lastSelectedGacha: gid };
      const owned = bestOwnedTool(state, kind);
      if (owned) state = equipTool(state, owned);
      return state;
    });
  };

  const beginDigFx = (before: MiningState, result: DigResult) => {
    const beforeUnlocks = new Set(before.unlockedGachas);
    setDigBusy(true);
    setLastDig(result);
    crackDoneRef.current = false;
    crackStageRef.current = 0;
    setCrackStage(0);
    setDigFx("crack");
    void unlockAudio();
    navigator.vibrate?.([18, 30, 18]);
    announceUnlocks(beforeUnlocks, result.state);
    const moments = detectChapterMoments(before, result.state)
      .filter((m) => m.id === "first_debris");
    if (moments.length) {
      const ids = new Set(pendingDigChaptersRef.current.map((m) => m.id));
      for (const m of moments) {
        if (!ids.has(m.id)) pendingDigChaptersRef.current.push(m);
      }
    }
  };

  const onCrackTap = () => {
    if (digFx !== "crack" || crackDoneRef.current) return;
    const next = Math.min(MAX_CRACK_STAGE, crackStageRef.current + 1);
    crackStageRef.current = next;
    setCrackStage(next);
    setDigHitPulse((n) => n + 1);
    void playMiningSfx("crack");
    navigator.vibrate?.(16);
    if (next >= MAX_CRACK_STAGE) finishCrackToBreak();
  };

  /** 掘り実行（岩3択のあと、またはバケツくみ3択のあと） */
  const performDig = (gacha: GachaId, kind: ToolKind, luckyRock: boolean) => {
    if (digBusy) return;
    void unlockAudio();
    playGachaAmbient(gacha);
    const base = mining;
    let stateForDig: MiningState = { ...base, lastSelectedGacha: gacha };
    const best = bestOwnedTool(stateForDig, kind);
    if (best) stateForDig = equipTool(stateForDig, best);

    if (isCombatGacha(gacha) || isEndPortalGacha(gacha) || isTheEndGacha(gacha)) return;

    if (isBucketGacha(gacha)) {
      if (!hasBucket(stateForDig)) {
        onChange((prev) => rebaseMiningWrite(prev, base, stateForDig));
        showToast("バケツをそうびしてから入るよ");
        return;
      }
      const result = resolveBucketFill({ state: stateForDig, gacha, luckyRock });
      if ("error" in result) {
        onChange((prev) => rebaseMiningWrite(prev, base, stateForDig));
        showToast(result.error);
        return;
      }
      onChange((prev) => rebaseMiningWrite(prev, base, result.state));
      noteHuntChange(base, result.state);
      beginDigFx(base, result);
      return;
    }

    const result = resolveDig({
      state: stateForDig,
      gacha,
      toolKind: kind,
      buddyProgress,
      dateKey,
      luckyRock,
    });
    if ("error" in result) {
      onChange((prev) => rebaseMiningWrite(prev, base, stateForDig));
      showToast(result.error);
      return;
    }
    onChange((prev) => rebaseMiningWrite(prev, base, result.state));
    noteHuntChange(base, result.state);
    beginDigFx(base, result);
  };

  const rollLuckySpots = (gacha: GachaId = selectedGacha) => {
    if (isEndPortalGacha(gacha)) return;
    if (isCombatGacha(gacha) || isTheEndGacha(gacha)) {
      const layout = shuffleCombatTiers();
      setCombatLayout(layout);
      setRockHint(isTheEndGacha(gacha) ? { kind: "none" } : resolveCombatHelmetHint(mining, layout));
      setCombatFallen([]);
      setCombatFlash([]);
      setCombatGone([]);
      return;
    }
    const luckyIdx = Math.floor(Math.random() * 3);
    setRockLuckyIndex(luckyIdx);
    setRockHint(resolveHelmetRockHint(mining, luckyIdx));
  };

  /** 行き先を確定 → シート内で岩ステップへ（ようがんはくみ3択） */
  const selectDigPlace = (gacha: GachaId) => {
    if (digBusy) return;
    if (!mining.unlockedGachas.includes(gacha)) {
      showToast(gachaLockHint(gacha, mining), "normal", 4000);
      return;
    }
    const kind = recommendToolKind(gacha);
    setSelectedGacha(gacha);
    setToolKind(kind);
    rollLuckySpots(gacha);
    setDigDestStep("rock");
    if (isTheEndGacha(gacha)) {
      onChange((prev) => {
        const ready = ensureDragonFight({ ...prev, lastSelectedGacha: gacha });
        const sword = bestOwnedTool(ready, "sword");
        return sword ? equipTool(ready, sword) : ready;
      });
      setDragonFx(null);
    }
    if (isCombatGacha(gacha)) {
      combatFxSeq.current += 1;
      const sword = bestOwnedTool(mining, "sword");
      onChange((prev) => {
        const settled = settleCombatEncounter(prev, gacha);
        return sword ? equipTool(settled, sword) : settled;
      });
      if (!sword) showToast("剣を作ってからたたこう");
    }
    if (isBucketGacha(gacha) && !hasBucket(mining)) {
      showToast("鉄のバケツを作ってからね");
    }
  };

  const openDigDestination = (step: DigDestStep = "place") => {
    if (digBusy) return;
    setDigDestStep(step);
    if (step === "rock") {
      rollLuckySpots();
    }
    setOverlay("digDestination");
  };

  useEffect(() => {
    if (!devJump) return;
    setVersionNoticeOpen(false);
    setRouteBranchOpen(false);
    setTab(devJump.tab);
    if (devJump.craftTab) setCraftTab(devJump.craftTab);
    if (devJump.highlightRecipeId) {
      setHighlightRecipeId(devJump.highlightRecipeId);
      setCraftShowAll(true);
    }
    const last = miningRef.current.lastSelectedGacha;
    const unlocked = last && miningRef.current.unlockedGachas.includes(last);
    if (devJump.tab === "mine" && last && unlocked) {
      if (devJump.destStep === "rock") {
        selectDigPlace(last);
        setOverlay("digDestination");
      } else {
        setSelectedGacha(last);
        setToolKind(recommendToolKind(last));
        setDigDestStep("place");
        setOverlay("digDestination");
      }
    }
    onDevJumpConsumed?.();
  }, [devJump?.nonce]);

  const closeDigFx = () => {
    setDigFx("idle");
    setDigBusy(false);
    setCrackStage(0);
    crackStageRef.current = 0;
    crackDoneRef.current = false;
    if (pendingDigChaptersRef.current.length) {
      enqueueChapters(pendingDigChaptersRef.current);
      pendingDigChaptersRef.current = [];
    }
    flushDiscoverCinematic();
    if (isCombatGacha(selectedGacha)) {
      scheduleReturnToPlace(
        combatFxSeq.current,
        !canPlayerFight(miningRef.current),
        miningRef.current.tickets,
      );
    }
  };

  const digAgainFromFx = () => {
    if (digFx !== "reveal") return;
    if (pendingDiscover) {
      closeDigFx();
      return;
    }
    if (mining.tickets < 1) {
      showToast("チケットが足りないよ");
      closeDigFx();
      return;
    }
    setDigFx("idle");
    setDigBusy(false);
    setCrackStage(0);
    crackStageRef.current = 0;
    crackDoneRef.current = false;
    if (isBucketGacha(selectedGacha)) {
      openDigDestination("rock");
      return;
    }
    openDigDestination("rock");
  };

  const announceUnlocks = (before: Set<GachaId>, next: MiningState) => {
    const unlockMessages: { id: GachaId; label: string }[] = [
      { id: "farm", label: "農場 ひらいた！" },
      { id: "ranch", label: "牧場 ひらいた！" },
      { id: "stone", label: "いしのどうくつ ひらいた！" },
      { id: "river", label: "うみ ひらいた！" },
      { id: "iron", label: "てつのこうざん ひらいた！" },
      { id: "coal", label: "せきたんのやま ひらいた！" },
      { id: "gold", label: "きんのこうざん ひらいた！" },
      { id: "lava_cave", label: "ようがんどうくつ ひらいた！" },
      { id: "diamond", label: "ダイヤのしんそう ひらいた！" },
      { id: "lapis_cave", label: "ラピスどうくつ ひらいた！" },
      { id: "nether", label: "ネザー ひらいた！" },
      { id: "bastion", label: "砦の遺跡 ひらいた！" },
      { id: "warped_forest", label: "歪んだ森 ひらいた！" },
      { id: "fortress", label: "ネザー要塞 ひらいた！" },
      { id: "end_portal", label: "エンドポータル ひらいた！" },
      { id: "the_end", label: "ジ・エンド ひらいた！" },
    ];
    let delay = 500;
    for (const msg of unlockMessages) {
      if (!before.has(msg.id) && next.unlockedGachas.includes(msg.id)) {
        if (msg.id === "nether") {
          window.setTimeout(() => setPortalFx(true), delay);
        } else if (msg.id === "end_portal" || msg.id === "the_end") {
          continue;
        } else {
          window.setTimeout(() => showToast(msg.label, "progress"), delay);
        }
        delay += 900;
      }
    }
  };

  useEffect(() => {
    const current = miningRef.current;
    const next = refreshUnlocks(current);
    const before = new Set(current.unlockedGachas);
    if (!next.unlockedGachas.some((id) => !before.has(id))) return;
    onChange((prev) => {
      const resolved = refreshUnlocks(prev);
      const prevSet = new Set(prev.unlockedGachas);
      if (!resolved.unlockedGachas.some((id) => !prevSet.has(id))) return prev;
      return resolved;
    });
    announceUnlocks(before, next);
  }, [mining.crafted, mining.unlockedGachas, mining.endQuest, onChange]);

  const enqueueChapters = (moments: ChapterMoment[]) => {
    if (!moments.length) return;
    setChapterQueue((q) => {
      const ids = new Set(q.map((m) => m.id));
      const next = moments.filter((m) => !ids.has(m.id));
      return next.length ? [...q, ...next] : q;
    });
  };

  const finishCraftSuccess = (
    before: MiningState,
    recipe: MiningRecipe,
    nextState: MiningState,
    times = 1,
  ) => {
    const beforeUnlocks = new Set(before.unlockedGachas);
    const beforeBeds = partySlotCount(before);

    const icon = recipe.grantsBed ? (
      <MiningItemIcon bed emoji={recipe.emoji} size={56} alt="" />
    ) : recipe.craftFlag ? (
      <MiningItemIcon gear={recipe.craftFlag} emoji={recipe.emoji} size={56} alt="" />
    ) : recipe.outputs?.[0] ? (
      <MiningItemIcon material={recipe.outputs[0].material} emoji={recipe.emoji} size={56} alt="" />
    ) : (
      <span style={{ fontSize: 40 }}>{recipe.emoji}</span>
    );

    void playMiningSfx("craft");
    setCraftPop({
      label: times > 1 ? `${recipe.label} ${times}こできた！` : `${recipe.label} できた！`,
      icon,
    });
    window.setTimeout(() => setCraftPop(null), 1100);

    const nudge = detectProgressNudge(before, nextState);
    if (nudge) {
      setProgressNudge(nudge);
      if (nudge.action === "party") {
        setOverlay("party");
        setPartyStep("slots");
        setPartySlotEdit(null);
        setPartyCategoryFilter(null);
      }
      if (nudge.action === "equip") {
        setOverlay("equip");
      }
      if (nudge.action === "craft") {
        setTab("craft");
      }
    } else if (recipe.grantsBed && partySlotCount(nextState) > beforeBeds) {
      showToast(`ベッドできた！なかま ${partySlotCount(nextState)}人まで`, "progress");
    } else if (
      recipe.grantsBed
      && getMaterialCount(nextState, "spare_bed") > getMaterialCount(before, "spare_bed")
    ) {
      showToast("ベッドできた！", "progress");
    }

    announceUnlocks(beforeUnlocks, nextState);
    enqueueChapters(detectChapterMoments(before, nextState));
  };

  const runNudgeAction = (nudge: ProgressNudge) => {
    if (nudge.action === "party") {
      setOverlay("party");
      setPartyStep("slots");
      setPartySlotEdit(null);
      setPartyCategoryFilter(null);
      setTab("mine");
    } else if (nudge.action === "equip") {
      setOverlay("equip");
      setTab("mine");
    } else if (nudge.action === "craft") {
      setOverlay(null);
      setTab("craft");
    } else if (nudge.action === "mine") {
      setOverlay(null);
      setTab("mine");
      if (nudge.id === "wood-tools-done" && mining.unlockedGachas.includes("stone")) {
        chooseGacha("stone");
      } else if (nudge.id === "stone-tools-done" && mining.unlockedGachas.includes("coal")) {
        chooseGacha("coal");
      } else if (nudge.id === "iron-tools-done" && mining.unlockedGachas.includes("diamond")) {
        chooseGacha("diamond");
      } else if (nudge.id === "diamond-tools-done" && mining.unlockedGachas.includes("nether")) {
        chooseGacha("nether");
      } else if (nudge.id === "after-furnace" && mining.unlockedGachas.includes("iron")) {
        chooseGacha("iron");
      }
    }
    setProgressNudge(null);
  };

  const onCraft = (recipe: MiningRecipe, times = 1) => {
    if (smeltingId || craftLockRef.current) return;
    const chosenId = fuelChoice[recipe.id];
    const fuel =
      recipe.fuelOptions && chosenId
        ? recipe.fuelOptions.find((f) => f.material === chosenId)
        : undefined;
    const craftOpts = { ...(fuel ? { fuel } : {}), times };
    const applyCraft = (from: MiningState) => {
      const result = tryCraft(from, recipe, craftOpts);
      if (result.error) {
        showToast(result.error);
        craftLockRef.current = false;
        return false;
      }
      onChange(patchFromResult((prev) => tryCraft(prev, recipe, craftOpts)));
      finishCraftSuccess(from, recipe, result.state, times);
      return true;
    };

    if (recipe.fuelOptions?.length) {
      const preview = tryCraft(miningRef.current, recipe, craftOpts);
      if (preview.error) {
        showToast(preview.error);
        return;
      }
      craftLockRef.current = true;
      setSmeltingId(recipe.id);
      setSmeltProgress(0);
      void playMiningSfx("smelt");
      void unlockAudio();
      const started = performance.now();
      const duration = 1700;
      const tick = () => {
        const p = Math.min(1, (performance.now() - started) / duration);
        setSmeltProgress(p);
        if (p >= 1) {
          setSmeltingId(null);
          setSmeltProgress(0);
          applyCraft(miningRef.current);
          return;
        }
        smeltTimerRef.current = window.setTimeout(tick, 40);
      };
      smeltTimerRef.current = window.setTimeout(tick, 40);
      return;
    }

    craftLockRef.current = true;
    applyCraft(miningRef.current);
  };

  useEffect(() => () => {
    if (smeltTimerRef.current) window.clearTimeout(smeltTimerRef.current);
  }, []);

  const ownedStickers = stickerAlbum
    .filter((id) => !!REWARD_LOOKUP[id])
    .map((id) => ({ id, ...REWARD_LOOKUP[id]! }));

  const partyCandidates = partyCategoryFilter
    ? ownedStickers.filter((reward) => reward.category === partyCategoryFilter)
    : ownedStickers;

  const slots = partySlotCount(mining);

  useEffect(() => {
    if (partySlotEdit !== null && partySlotEdit >= slots) {
      setPartySlotEdit(slots > 0 ? slots - 1 : null);
    }
  }, [slots, partySlotEdit]);

  useEffect(() => {
    setCraftQty((prev) => {
      let changed = false;
      const next: Partial<Record<RecipeId, number>> = { ...prev };
      for (const id of Object.keys(prev) as RecipeId[]) {
        const n = prev[id];
        if (n == null) continue;
        const recipe = recipes.find((r) => r.id === id);
        if (!recipe) continue;
        const chosen = fuelChoice[recipe.id];
        const fuel = recipe.fuelOptions?.length
          ? (chosen
            ? recipe.fuelOptions.find((f) => f.material === chosen && have(f.material) >= f.amount)
            : recipe.fuelOptions.find((f) => have(f.material) >= f.amount)) ?? null
          : null;
        const max = maxCraftTimes(recipe, have, {
          fuel,
          remainingBeds: recipe.grantsBed ? MAX_BEDS - slots : undefined,
        });
        const clamped = alignCraftTimes(n, max, smeltQtyStep(fuel));
        if (clamped !== n) {
          next[id] = clamped;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [fuelChoice, have, recipes, slots]);

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "mine", label: "ほる", icon: "/mining/Stone_Pickaxe.png" },
    { id: "craft", label: "クラフト", icon: "/mining/Crafting_Table.png" },
    { id: "bag", label: "もちもの", icon: CHEST_IMAGE },
  ];
  const unlockCard = nextGachaUnlock(mining);

  const armorSlots: ArmorSlot[] = ["helmet", "chest", "leggings", "boots"];

  const nextHero = buildNextHero(mining, { repeatCount: heroRepeat });
  const ironRoute = showIronRouteGuide(mining);
  const strength = boostStrengthLabel(boost.expectedExtra);
  const tableReady = hasEnchantingTable(mining);

  useEffect(() => {
    const key = nextHero.trustKey ?? nextHero.title;
    if (heroTrustKey === null) {
      setHeroTrustKey(key);
      return;
    }
    if (key !== heroTrustKey) {
      setHeroTrustKey(key);
      setHeroRepeat(0);
    }
  }, [nextHero.trustKey, nextHero.title, heroTrustKey]);

  useEffect(() => {
    const luckyIdx = Math.floor(Math.random() * 3);
    setRockLuckyIndex(luckyIdx);
    setRockHint(resolveHelmetRockHint(miningRef.current, luckyIdx));
    setHighlightRocks(false);
    if (isCombatGacha(selectedGacha)) {
      const layout = shuffleCombatTiers();
      setCombatLayout(layout);
      setRockHint(resolveCombatHelmetHint(miningRef.current, layout));
    }
  }, [selectedGacha]);

  useEffect(() => {
    if (
      tableReady
      && !mining.miningRouteBranchSeen
      && !versionNoticeOpen
      && !mining.unlockedGachas.includes("nether")
    ) {
      setRouteBranchOpen(true);
    }
  }, [mining, versionNoticeOpen, tableReady]);

  const jumpFromHero = () => {
    const key = nextHero.trustKey ?? nextHero.title;
    if (key === heroTrustKey) setHeroRepeat((n) => n + 1);
    else {
      setHeroTrustKey(key);
      setHeroRepeat(1);
    }

    setHighlightRecipeId(null);
    setHighlightGacha(null);
    setHighlightRocks(false);

    if (nextHero.highlightKind === "recipe" && nextHero.highlightRecipeId) {
      setHighlightRecipeId(nextHero.highlightRecipeId);
      setCraftTab(craftTabForRecipeId(nextHero.highlightRecipeId));
      window.setTimeout(() => setHighlightRecipeId(null), 4500);
    }
    if (nextHero.highlightKind === "gacha" && nextHero.preferredGacha) {
      setHighlightGacha(nextHero.preferredGacha);
      window.setTimeout(() => setHighlightGacha(null), 4500);
    }
    if (nextHero.preferredGacha && mining.unlockedGachas.includes(nextHero.preferredGacha)) {
      chooseGacha(nextHero.preferredGacha);
    }
    if (nextHero.highlightKind === "rocks") {
      setHighlightRocks(true);
      window.setTimeout(() => setHighlightRocks(false), 4500);
      setTab("mine");
      openDigDestination("rock");
      return;
    }
    if (nextHero.jumpTab === "mine") {
      setOverlay(null);
      setTab("mine");
      return;
    }
    setOverlay(null);
    setTab("craft");
  };

  const resetCombatFx = () => {
    combatFxSeq.current += 1;
    setCombatBusy(false);
    setCombatFlash([]);
    setCombatFallen([]);
    setCombatGone([]);
    setCombatHitDamage(0);
    setPlayerHitHearts(null);
    setPlayerDiedFx(false);
    setDragonHeavyHit(false);
    setIncomingFx(null);
    setStriking([]);
    setTapRush(false);
    setSpecialFinale(null);
  };

  const showCombatLoot = (result: DigResult) => {
    if (!result.drops.length) return;
    const notable = result.drops.some((d) => d.material === "ender_pearl" || d.material === "blaze_rod");
    if (!notable) return;
    setLastDig(result);
    setDigFx("reveal");
    void playMiningSfx("drop");
  };

  const scheduleReturnToPlace = (seq: number, died: boolean, ticketsLeft: number) => {
    if (died || ticketsLeft >= 1) return;
    window.setTimeout(() => {
      if (seq !== combatFxSeq.current) return;
      if (miningRef.current.tickets >= 1) return;
      if (!canPlayerFight(miningRef.current)) return;
      resetCombatFx();
      setDigDestStep("place");
    }, 3000);
  };

  const finishMobFightFx = (params: {
    seq: number;
    result: CombatResult;
    gacha: CombatGachaId;
  }) => {
    const { seq, result, gacha } = params;
    const wiped = livingMobs(result.state.combatEncounters?.[gacha]).length === 0;
    if (wiped && result.state.tickets >= 1) {
      onChange((prev) => settleCombatEncounter(prev, gacha));
      setCombatGone([]);
      setCombatFallen([]);
    }
    setLastDig(result);
    setCombatBusy(false);
    setCombatFlash([]);
    setStriking([]);
    setIncomingFx(null);
    setCombatLayout(shuffleCombatTiers());
    setPlayerHitHearts(result.countered ? result.takenHearts : null);
    setPlayerDiedFx(result.playerDied);
    if (result.playerDied) {
      showToast("倒された！", "progress");
      void playMiningSfx("break");
      flushDiscoverCinematic();
      return;
    }
    flushDiscoverCinematic();
    const names = result.drops.map((d) => `${MATERIAL_META[d.material].label}${d.amount > 1 ? `×${d.amount}` : ""}`);
    const showedLoot = result.drops.some((d) => d.material === "ender_pearl" || d.material === "blaze_rod");
    if (showedLoot) {
      showCombatLoot(result);
      return;
    }
    if (names.length) {
      showToast(names.join(" / "), result.killed.length ? "progress" : "normal");
      void playMiningSfx("drop");
    }
    scheduleReturnToPlace(seq, false, result.state.tickets);
  };

  const fleeFromFight = () => {
    resetCombatFx();
    setDigDestStep("place");
  };

  const pickRockInSheet = (rockIndex: number) => {
    if (digBusy) return;
    if (mining.tickets < 1) {
      showToast("チケットが足りないよ");
      return;
    }
    if (isCombatGacha(selectedGacha)) {
      pickCombatInSheet(rockIndex);
      return;
    }
    navigator.vibrate?.(12);
    const kind = recommendToolKind(selectedGacha);
    setToolKind(kind);
    setOverlay(null);
    performDig(selectedGacha, kind, rockIndex === rockLuckyIndex);
  };

  const pickCombatInSheet = (cardIndex: number) => {
    if (combatBusy || digBusy) return;
    if (!isCombatGacha(selectedGacha)) return;
    if (mining.tickets < 1) {
      showToast("チケットが足りないよ");
      return;
    }
    const tier = combatLayout[cardIndex] ?? "normal";
    const base = mining;
    const withSword = (() => {
      const sword = bestOwnedTool(base, "sword");
      return sword ? equipTool({ ...base, lastSelectedGacha: selectedGacha }, sword) : { ...base, lastSelectedGacha: selectedGacha };
    })();
    const result = resolveCombat({
      state: withSword,
      gacha: selectedGacha,
      tier,
      dateKey,
    });
    if ("error" in result) {
      showToast(result.error);
      return;
    }
    const quested = applyEndQuestOnVisit(result.state, selectedGacha);
    const nextState = refreshUnlocks(quested.state);
    navigator.vibrate?.(12);
    void unlockAudio();
    void playMiningSfx("slash");
    const seq = ++combatFxSeq.current;
    setCombatBusy(true);
    setCombatSwings(result.swings);
    setCombatHitDamage(result.swingDamage * result.swings);
    setCombatEmphasis(tier === "jackpot" ? "jackpot" : tier === "hit" ? "hit" : "normal");
    setCombatSlashSeed(seq);
    setCombatGone([]);
    setCombatFallen([]);
    setCombatFlash(result.targets);
    onChange((prev) => rebaseMiningWrite(prev, base, nextState));
    noteHuntChange(base, nextState);
    const fallAt = Math.max(480, result.swings * 200);
    const fadeAt = result.killed.length ? fallAt + 720 : fallAt;
    const counterAt = result.countered ? fallAt + 900 : -1;
    const doneAt = result.countered
      ? counterAt + 1000
      : result.killed.length ? fadeAt + 850 : 900;
    window.setTimeout(() => {
      if (seq !== combatFxSeq.current) return;
      setCombatFallen(result.killed);
      if (result.killed.length) void playMiningSfx("break");
    }, fallAt);
    if (result.countered) {
      window.setTimeout(() => {
        if (seq !== combatFxSeq.current) return;
        setCombatFlash([]);
        setStriking(result.counterFrom);
        setIncomingFx({
          kind: selectedGacha === "fortress" ? "blaze" : "enderman",
          hearts: result.takenHearts,
        });
        setPlayerHitHearts(result.takenHearts);
        navigator.vibrate?.(result.takenHearts > 0 ? 22 : 8);
        void playMiningSfx(selectedGacha === "fortress" ? "smelt" : "break");
      }, counterAt);
    }
    window.setTimeout(() => {
      if (seq !== combatFxSeq.current) return;
      finishMobFightFx({ seq, result, gacha: selectedGacha });
    }, doneAt);
  };

  const pickDragonInSheet = (cardIndex: number) => {
    if (combatBusy || digBusy) return;
    if (!isTheEndGacha(selectedGacha)) return;
    if (mining.tickets < 1) {
      showToast("チケットが足りないよ");
      return;
    }
    const tier = combatLayout[cardIndex] ?? "normal";
    const base = miningRef.current;
    const withSword = (() => {
      const sword = bestOwnedTool(base, "sword");
      const ready = ensureDragonFight({ ...base, lastSelectedGacha: selectedGacha });
      return sword ? equipTool(ready, sword) : ready;
    })();
    const result = resolveDragonAttack({
      state: withSword,
      target: dragonTarget,
      tier,
      buddyProgress,
      dateKey,
    });
    if ("error" in result) {
      showToast(result.error);
      return;
    }
    navigator.vibrate?.(12);
    void unlockAudio();
    void playMiningSfx(result.usedBed || result.crystalDestroyed ? "break" : "slash");
    const seq = ++combatFxSeq.current;
    setCombatBusy(true);
    setDragonFx({
      seq,
      target: dragonTarget,
      damage: result.damage,
      heal: result.heal,
      swings: result.swings || 1,
      usedBed: result.usedBed,
      crystalDestroyed: result.crystalDestroyed,
      emphasis: tier === "jackpot" ? "jackpot" : tier === "hit" ? "hit" : "normal",
      heavy: result.heavy,
    });
    onChange((prev) => rebaseMiningWrite(prev, base, result.state));
    if (result.countered) {
      navigator.vibrate?.(result.heavy ? 28 : 18);
      window.setTimeout(() => {
        if (seq !== combatFxSeq.current) return;
        void playMiningSfx(result.heavy ? "dragon_breath" : "slash");
        setIncomingFx({
          kind: result.heavy ? "breath" : "dragon",
          hearts: result.takenHearts,
        });
        setPlayerHitHearts(result.takenHearts);
        setDragonHeavyHit(result.heavy);
      }, result.heavy ? 1200 : 1100);
    }
    const fxMs = result.countered
      ? (result.heavy ? 2300 : 2100)
      : result.usedBed ? 1400 : result.crystalDestroyed ? 1100 : 900;
    window.setTimeout(() => {
      if (seq !== combatFxSeq.current) return;
      setCombatBusy(false);
      const layout = shuffleCombatTiers();
      setCombatLayout(layout);
      setIncomingFx(null);
      setPlayerHitHearts(result.countered ? result.takenHearts : null);
      setPlayerDiedFx(result.playerDied);
      setDragonHeavyHit(result.heavy);
      if (result.playerDied) {
        showToast("倒された！", "progress");
        void playMiningSfx("break");
      }
      if (result.crystalDestroyed && typeof result.target === "number") {
        setDragonTarget(nextLivingCrystal(result.state.dragonFight?.crystals ?? [], result.target));
      }
      if (result.defeated) setEndCinematic("dragon_win");
    }, fxMs);
  };

  const explodeDragonBed = () => {
    if (combatBusy || digBusy) return;
    const base = miningRef.current;
    const result = resolveDragonAttack({
      state: ensureDragonFight({ ...base, lastSelectedGacha: "the_end" }),
      target: "dragon",
      useBed: true,
      buddyProgress,
      dateKey,
    });
    if ("error" in result) {
      showToast(result.error);
      return;
    }
    navigator.vibrate?.(20);
    void unlockAudio();
    void playMiningSfx(result.defeated ? "chapter" : "break");
    const seq = ++combatFxSeq.current;
    setCombatBusy(true);
    setDragonFx({
      seq,
      target: "dragon",
      damage: result.damage,
      heal: 0,
      swings: 1,
      usedBed: true,
      crystalDestroyed: false,
      emphasis: "jackpot",
      heavy: result.heavy,
    });
    onChange((prev) => rebaseMiningWrite(prev, base, result.state));
    if (result.countered) {
      window.setTimeout(() => {
        if (seq !== combatFxSeq.current) return;
        void playMiningSfx(result.heavy ? "dragon_breath" : "slash");
        setIncomingFx({
          kind: result.heavy ? "breath" : "dragon",
          hearts: result.takenHearts,
        });
        setPlayerHitHearts(result.takenHearts);
        setDragonHeavyHit(result.heavy);
      }, result.heavy ? 1600 : 1500);
    }
    window.setTimeout(() => {
      if (seq !== combatFxSeq.current) return;
      setCombatBusy(false);
      setIncomingFx(null);
      setPlayerHitHearts(result.countered ? result.takenHearts : null);
      setPlayerDiedFx(result.playerDied);
      setDragonHeavyHit(result.heavy);
      if (result.playerDied) {
        showToast("倒された！", "progress");
        void playMiningSfx("break");
      }
      if (result.defeated) setEndCinematic("dragon_win");
    }, result.countered ? 2800 : 2400);
  };

  const startSpecialInSheet = () => {
    if (combatBusy || digBusy || tapRush) return;
    if (!specialGaugeReady(mining)) {
      showToast("必殺がまだたまってないよ");
      return;
    }
    if (mining.tickets < 1) {
      showToast("チケットが足りないよ");
      return;
    }
    if (!canPlayerFight(mining)) {
      showToast("倒れているよ。チケットで起き上がろう");
      return;
    }
    combatFxSeq.current += 1;
    setCombatBusy(true);
    setTapRush(true);
  };

  const onSpecialFirstTap = () => {
    const base = miningRef.current;
    const begun = beginSpecialAttack(base, dateKey);
    if (begun.error) {
      showToast(begun.error);
      setTapRush(false);
      setCombatBusy(false);
      return;
    }
    onChange((prev) => rebaseMiningWrite(prev, base, begun.state));
  };

  const finishSpecialTaps = (taps: number) => {
    setTapRush(false);
    const seq = combatFxSeq.current;
    const base = miningRef.current;
    if (isTheEndGacha(selectedGacha)) {
      const fin = applyDragonSpecialFinish({
        state: base,
        target: dragonTarget,
        taps,
        buddyProgress,
        dateKey,
      });
      if ("error" in fin) {
        setCombatBusy(false);
        showToast(fin.error);
        return;
      }
      setSpecialFinale({ taps, damage: fin.damage });
      setDragonFx({
        seq,
        target: fin.target,
        damage: fin.damage,
        heal: fin.heal,
        swings: 3,
        usedBed: false,
        crystalDestroyed: fin.crystalDestroyed,
        emphasis: "jackpot",
        heavy: fin.heavy,
      });
      void playMiningSfx("slash");
      navigator.vibrate?.(24);
      onChange((prev) => rebaseMiningWrite(prev, base, fin.state));
      const finaleAt = 2200;
      if (fin.countered) {
        window.setTimeout(() => {
          if (seq !== combatFxSeq.current) return;
          setSpecialFinale(null);
          void playMiningSfx(fin.heavy ? "dragon_breath" : "slash");
          setIncomingFx({
            kind: fin.heavy ? "breath" : "dragon",
            hearts: fin.takenHearts,
          });
          setPlayerHitHearts(fin.takenHearts);
          setDragonHeavyHit(fin.heavy);
        }, finaleAt);
      }
      window.setTimeout(() => {
        if (seq !== combatFxSeq.current) return;
        setSpecialFinale(null);
        setCombatBusy(false);
        setIncomingFx(null);
        setCombatLayout(shuffleCombatTiers());
        setPlayerHitHearts(fin.countered ? fin.takenHearts : null);
        setPlayerDiedFx(fin.playerDied);
        setDragonHeavyHit(fin.heavy);
        if (fin.playerDied) {
          showToast("倒された！", "progress");
          void playMiningSfx("break");
        }
        if (fin.crystalDestroyed && typeof fin.target === "number") {
          setDragonTarget(nextLivingCrystal(fin.state.dragonFight?.crystals ?? [], fin.target));
        }
        if (fin.defeated) setEndCinematic("dragon_win");
      }, fin.countered ? finaleAt + 1100 : finaleAt + 200);
      return;
    }
    if (!isCombatGacha(selectedGacha)) {
      setCombatBusy(false);
      return;
    }
    const fin = applyCombatSpecialFinish({
      state: base,
      gacha: selectedGacha,
      taps,
      dateKey,
    });
    if ("error" in fin) {
      setCombatBusy(false);
      showToast(fin.error);
      return;
    }
    setSpecialFinale({ taps, damage: fin.swingDamage });
    setCombatFlash(fin.targets);
    setCombatSwings(fin.swings);
    setCombatHitDamage(fin.swingDamage);
    setCombatEmphasis("jackpot");
    setCombatSlashSeed(seq + 11);
    void playMiningSfx("slash");
    navigator.vibrate?.(24);
    onChange((prev) => rebaseMiningWrite(prev, base, fin.state));
    const finaleAt = 2200;
    window.setTimeout(() => {
      if (seq !== combatFxSeq.current) return;
      setCombatFallen(fin.killed);
      if (fin.killed.length) void playMiningSfx("break");
    }, 500);
    if (fin.countered) {
      window.setTimeout(() => {
        if (seq !== combatFxSeq.current) return;
        setSpecialFinale(null);
        setCombatFlash([]);
        setStriking(fin.counterFrom);
        setIncomingFx({
          kind: selectedGacha === "fortress" ? "blaze" : "enderman",
          hearts: fin.takenHearts,
        });
        setPlayerHitHearts(fin.takenHearts);
        navigator.vibrate?.(fin.takenHearts > 0 ? 22 : 8);
        void playMiningSfx(selectedGacha === "fortress" ? "smelt" : "break");
      }, finaleAt);
    }
    window.setTimeout(() => {
      if (seq !== combatFxSeq.current) return;
      setSpecialFinale(null);
      finishMobFightFx({ seq, result: fin, gacha: selectedGacha });
    }, fin.countered ? finaleAt + 1100 : finaleAt + 200);
  };

  const reviveInFight = () => {
    const base = miningRef.current;
    const result = revivePlayer(syncPlayerHpForDate(base, dateKey));
    if (result.error) {
      showToast(result.error);
      return;
    }
    onChange((prev) => rebaseMiningWrite(prev, base, result.state));
    setPlayerDiedFx(false);
    setPlayerHitHearts(null);
    setDragonHeavyHit(false);
    setIncomingFx(null);
    setStriking([]);
    setTapRush(false);
    setSpecialFinale(null);
    showToast("起き上がった！");
  };

  const insertEyeAtPortal = () => {
    const base = mining;
    const result = insertPortalEye(base);
    if (result.error) {
      showToast(result.error);
      return;
    }
    if (!result.inserted) return;
    navigator.vibrate?.(12);
    void unlockAudio();
    if (!result.completed) void playMiningSfx("eye_insert");
    setPortalShake(true);
    setInsertPulse((n) => n + 1);
    window.setTimeout(() => setPortalShake(false), 420);
    onChange((prev) => rebaseMiningWrite(prev, base, refreshUnlocks(result.state)));
    if (result.completed) {
      setEndCinematic("unlock");
      return;
    }
    showToast(`はめた ${result.state.endQuest?.eyes}/12`);
  };

  const openTheEndFromPortal = () => {
    const base = mining;
    const result = unlockTheEnd(base);
    if (result.error) {
      showToast(result.error);
      return;
    }
    const next = refreshUnlocks({ ...result.state, lastSelectedGacha: "the_end" });
    onChange((prev) => rebaseMiningWrite(prev, base, next));
    setSelectedGacha("the_end");
    setToolKind("sword");
    setDigDestStep("place");
    setOverlay("digDestination");
    void playMiningSfx("chapter");
    showToast("ジ・エンドがひらいた！ほりばから行こう", "progress");
  };

  /** party / equip / enchant は全画面置換。digDestination はボトムシートなので本体UIを残す */
  const blockingOverlay = overlay === "party" || overlay === "equip" || overlay === "enchant";
  const blockingTitle =
    overlay === "party" ? "なかま"
    : overlay === "equip" ? "そうび"
    : overlay === "enchant" ? "エンチャント"
    : "";
  const selectedMeta = GACHA_META[selectedGacha];
  const contentPadBottom = blockingOverlay ? 96 : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: "80vh", paddingBottom: contentPadBottom, width: "100%", minWidth: 0 }}>
      {/* 固定ヘッダ: 本体タブ or そうび/なかま/エンチャント */}
      <div style={{ height: chromeSpacerHeight, flexShrink: 0 }} aria-hidden />
      <div
        ref={setChromeEl}
        className="mining-pin-chrome"
        style={{
          position: "fixed",
          top: pinRect.top,
          left: pinRect.left,
          width: pinRect.width,
          paddingLeft: pinRect.padL,
          paddingRight: pinRect.padR,
          paddingTop: pinRect.padT,
          paddingBottom: 8,
          boxSizing: "border-box",
          zIndex: 50,
          backgroundColor: theme.bg.editor,
        }}
      >
        {blockingOverlay ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ScrollSafeBackButton onBack={() => setOverlay(null)} />
            <div style={{ fontSize: 18, fontWeight: 800, color: theme.text.primary, display: "inline-flex", alignItems: "center", gap: 8 }}>
              {overlay === "enchant" && (
                <MiningItemIcon src={ENCHANTING_TABLE_IMAGE} size={28} alt="" />
              )}
              {blockingTitle}
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <ScrollSafeBackButton onBack={onBack} />
              <div style={{ fontSize: 18, fontWeight: 800, color: theme.text.primary }}>こうざん／クラフト</div>
            </div>
            <div className="mining-main-tabs">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`mining-main-tab${tab === t.id ? " is-active" : ""}`}
                >
                  <MiningItemIcon src={t.icon} size={22} alt="" />
                  <span className="mining-main-tab-label">{t.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {!blockingOverlay && tab !== "mine" && (
      <>
      <div style={{ ...card, padding: "10px 12px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <span style={{ fontWeight: 900, color: theme.category.orange, fontSize: 16 }}>🎫 {mining.tickets}</span>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={{ fontWeight: 800, color: theme.text.secondary, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <MiningItemIcon src={EMERALD_IMAGE} size={18} alt="" emoji="💚" />
              エメラルド {mining.miningPoints}
            </div>
            <div style={{ marginTop: 2, fontSize: 11, fontWeight: 700, color: theme.text.tertiary }}>
              もちもので素材にかえられるよ
            </div>
          </div>
        </div>

        <div className="mining-next-hero">
          <div className="mining-next-hero-label">つぎやること</div>
          <div className="mining-next-hero-title">{nextHero.title}</div>
          {nextHero.subtitle && (
            <div className="mining-next-hero-sub">{nextHero.subtitle}</div>
          )}
          {nextHero.tools && (
            <div className="mining-next-hero-tools">
              {nextHero.tools.map((t) => {
                const isNext = !t.done && nextHero.tools!.find((x) => !x.done)?.id === t.id;
                return (
                  <div
                    key={t.id}
                    className={`mining-next-hero-tool${t.done ? " is-done" : ""}${isNext ? " is-next" : ""}`}
                  >
                    <div className="mining-next-hero-tool-icon">
                      <MiningItemIcon gear={t.id} size={22} alt="" />
                    </div>
                    {t.done ? "✓" : isNext ? "●" : "○"} {t.label.replace(/^(木|石|鉄|ダイヤ)の/, "")}
                  </div>
                );
              })}
            </div>
          )}
          {nextHero.kind !== "done" && (
            <button type="button" className="mining-next-hero-cta" style={btnPrimary} onClick={jumpFromHero}>
              {nextHero.ctaLabel
                ?? (nextHero.jumpTab === "mine" ? "ほりにいく" : "クラフトへ")}
            </button>
          )}
          {nextHero.kind === "done" && nextHero.highlightKind === "rocks" && (
            <button type="button" className="mining-next-hero-cta" style={btnPrimary} onClick={jumpFromHero}>
              {nextHero.ctaLabel ?? "ほりにいく"}
            </button>
          )}
          {activeEnchantChips.length > 0 && (
            <div className="mining-enchant-chips" aria-label="いまのエンチャント">
              {activeEnchantChips.map(({ target, enchant }) => (
                <span key={target} className="mining-enchant-chip">
                  {ENCHANT_TARGET_LABEL[target]} · {ENCHANT_META[enchant.id].label} Lv{enchant.level}
                </span>
              ))}
            </div>
          )}
        </div>
        {netheriteFullComplete(mining) && (
          <div style={{ marginTop: 4, fontSize: 11, fontWeight: 800, color: theme.category.green }}>
            ネザライトそろい！
          </div>
        )}
      </div>
      </>
      )}

      {!blockingOverlay && progressNudge && (
        <div style={{
          ...card,
          padding: 12,
          backgroundColor: `${theme.category.orange}14`,
          borderColor: `${theme.category.orange}66`,
        }}>
          <div style={{ fontWeight: 900, fontSize: 15, color: theme.category.orange, marginBottom: 4 }}>
            {progressNudge.title}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text.primary, lineHeight: 1.45, marginBottom: 10 }}>
            {progressNudge.body}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={btnPrimary} onClick={() => runNudgeAction(progressNudge)}>
              {progressNudge.actionLabel}
            </button>
            <button type="button" style={btnGhost} onClick={() => setProgressNudge(null)}>
              とじる
            </button>
          </div>
        </div>
      )}

      {!blockingOverlay && tab === "mine" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={card} className={highlightRocks ? "mining-equip-strip is-next-target" : "mining-equip-strip"}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontWeight: 800 }}>いまのどうぐ</div>
              <button
                type="button"
                className="mining-equip-strip-link"
                onClick={() => setOverlay("equip")}
              >
                そうびをかえる →
              </button>
            </div>
            <div className="mining-equip-strip-list">
              {(["axe", "sword", "pickaxe"] as ToolKind[]).map((kind) => {
                const best = bestOwnedTool(mining, kind);
                const selected = toolKind === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    className={`mining-equip-strip-row${selected ? " is-selected" : ""}${!best ? " is-empty" : ""}`}
                    onClick={() => {
                      if (!best) {
                        setOverlay("equip");
                        return;
                      }
                      selectToolKind(kind);
                    }}
                  >
                    <span className="mining-equip-strip-icon" aria-hidden>
                      {best ? (
                        <MiningItemIcon gear={best} size={32} alt="" />
                      ) : (
                        <span className="mining-equip-strip-empty">？</span>
                      )}
                    </span>
                    <span className="mining-equip-strip-effect">{TOOL_EFFECT_BLURB[kind]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mining-more-fold">
            <button
              type="button"
              onClick={() => setMineMoreOpen((v) => !v)}
              style={{
                width: "100%",
                border: "none",
                background: "transparent",
                padding: "4px 0",
                cursor: "pointer",
                textAlign: "left",
                fontWeight: 800,
                fontSize: 13,
                color: theme.text.secondary,
              }}
            >
              つよさ・詳細 {mineMoreOpen ? "▲" : "▼"}
            </button>
            {mineMoreOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
                <MiningStrengthDetails
                  boost={boost}
                  bareBoost={bareBoost}
                  strength={strength}
                  selectedGacha={selectedGacha}
                  mining={mining}
                />
                {lastDig && digFx === "idle" && (
                  <div>
                    <div style={{ fontWeight: 800, marginBottom: 6, fontSize: 13 }}>さいごにほった結果</div>
                    <div className="mining-dig-slot-row">
                      {lastDig.drops.map((d) => (
                        <div key={d.material} className="mining-dig-slot-wrap">
                          <MiningSlot material={d.material} amount={d.amount} size={40} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {overlay === "equip" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text.secondary, lineHeight: 1.45 }}>
            いちばん強いどうぐ・ぼうぐをつけよう
          </div>

          <div style={card}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>ほるどうぐ</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(["axe", "sword", "pickaxe"] as ToolKind[]).map((kind) => {
                const best = bestOwnedTool(mining, kind);
                const equipped = parseToolId(mining.equipped.tool)?.kind === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    disabled={!best}
                    className={`mining-equip-tool-row${equipped ? " is-equipped" : ""}`}
                    onClick={() => {
                      if (!best) return;
                      setToolKind(kind);
                      onChange((prev) => equipTool(prev, best));
                      showToast(`${gearLabel(best)} をそうびした！`);
                    }}
                    style={{ opacity: best ? 1 : 0.4 }}
                  >
                    <span className="mining-equip-tool-icon" aria-hidden>
                      {best ? <MiningItemIcon gear={best} size={32} alt="" /> : "？"}
                    </span>
                    <span className="mining-equip-tool-body">
                      <span className="mining-equip-tool-effect">{TOOL_EFFECT_BLURB[kind]}</span>
                      {equipped && <span className="mining-equip-tool-badge">そうび中</span>}
                      {mining.enchants[kind] && (
                        <span className="mining-enchant-chip is-inline">
                          {ENCHANT_META[mining.enchants[kind]!.id].label} Lv{mining.enchants[kind]!.level}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={card}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>持ち物</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: theme.text.secondary, marginBottom: 8 }}>
              空のマスをタップして入れる。水はエンドマンに＋2。エンダーアイはほりばにヒントが出る
            </div>
            {(() => {
              const heldId = mining.equipped.held && have(mining.equipped.held) >= 1
                ? mining.equipped.held
                : null;
              const holdables = HOLDABLE_MATERIALS.filter((id) => have(id) >= 1);
              return (
                <>
                  <button
                    type="button"
                    className={`mining-held-slot${heldId ? " is-filled" : ""}${heldPickerOpen ? " is-open" : ""}`}
                    aria-label={heldId ? `${MATERIAL_META[heldId].label}（持ち物）` : "持ち物をえらぶ"}
                    onClick={() => setHeldPickerOpen((open) => !open)}
                  >
                    {heldId ? (
                      <MiningItemIcon material={heldId} size={40} alt="" />
                    ) : (
                      <span className="mining-held-slot-plus" aria-hidden>＋</span>
                    )}
                  </button>
                  {heldId && (
                    <div className="mining-held-slot-name">{MATERIAL_META[heldId].label}</div>
                  )}
                  {heldPickerOpen && (
                    <div className="mining-held-picker">
                      {holdables.length === 0 && (
                        <div className="mining-held-picker-empty">入れるものがないよ</div>
                      )}
                      <div className="mining-held-picker-grid">
                        {holdables.map((id) => (
                          <button
                            key={id}
                            type="button"
                            className={`mining-held-pick${heldId === id ? " is-current" : ""}`}
                            onClick={() => {
                              onChange((prev) => equipHeld(prev, id));
                              setHeldPickerOpen(false);
                              showToast(
                                id === "ender_eye"
                                  ? "エンダーアイを持ち物にした！ほりばにヒントが出るよ"
                                  : `${MATERIAL_META[id].label}を持ち物にした！`,
                              );
                            }}
                          >
                            <MiningItemIcon material={id} size={36} alt="" />
                            <span className="mining-held-pick-name">{MATERIAL_META[id].label}</span>
                            <span>×{have(id)}</span>
                          </button>
                        ))}
                      </div>
                      {heldId && (
                        <button
                          type="button"
                          className="mining-held-unequip"
                          onClick={() => {
                            onChange((prev) => equipHeld(prev, null));
                            setHeldPickerOpen(false);
                            showToast("持ち物をはずした");
                          }}
                        >
                          はずす
                        </button>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
            {mining.crafted.elytra && (
              <div className="mining-equip-tool-row" style={{ marginTop: 8 }}>
                <span className="mining-equip-tool-icon" aria-hidden>
                  <MiningItemIcon gear="elytra" size={32} alt="" />
                </span>
                <span className="mining-equip-tool-body">
                  <span className="mining-equip-tool-effect">エリトラ（効果はこれから）</span>
                </span>
              </div>
            )}
          </div>

          <div style={card}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>ぼうぐ</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {armorSlots.map((slot) => {
                const owned = ownedArmorForSlot(mining, slot);
                const current = mining.equipped[slot];
                const open = !!armorDetailOpen[slot];
                return (
                  <div
                    key={slot}
                    className={`mining-equip-armor-row${open ? " is-open" : ""}${current ? " is-equipped" : ""}`}
                  >
                    <button
                      type="button"
                      className="mining-equip-armor-head"
                      onClick={() =>
                        setArmorDetailOpen((prev) => (prev[slot] ? {} : { [slot]: true }))
                      }
                    >
                      <span className="mining-equip-armor-icon" aria-hidden>
                        {current ? <MiningItemIcon gear={current} size={28} alt="" /> : "＋"}
                      </span>
                      <span className="mining-equip-armor-body">
                        <span className="mining-equip-armor-title">
                          {ARMOR_KIND_LABEL[slot]}
                          {current && <span className="mining-equip-tool-badge">そうび中</span>}
                        </span>
                        <span className="mining-equip-armor-effect">{ARMOR_EFFECT_SHORT[slot]}</span>
                      </span>
                      <span className="mining-equip-armor-chevron" aria-hidden>{open ? "▲" : "▼"}</span>
                    </button>
                    {open && (
                      <div className="mining-equip-armor-detail">
                        <div style={{ fontSize: 12, fontWeight: 700, color: theme.text.secondary, marginBottom: 8, lineHeight: 1.45 }}>
                          {ARMOR_EFFECT_BLURB[slot]}
                        </div>
                        {mining.enchants[slot] && (
                          <div className="mining-enchant-chip is-inline" style={{ marginBottom: 8 }}>
                            {ENCHANT_META[mining.enchants[slot]!.id].label} Lv{mining.enchants[slot]!.level}
                          </div>
                        )}
                        {owned.length === 0 ? (
                          <div style={{ fontSize: 12, color: theme.text.tertiary }}>まだないよ（鉄クラフト後）</div>
                        ) : (
                          <div className="mining-equip-armor-picks">
                            {owned.map((id) => {
                              const tier = armorTierFromGearId(id);
                              const effectCopy = tier
                                ? armorTierEffectCopy(slot, tier)
                                : ARMOR_EFFECT_SHORT[slot];
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  className={`mining-equip-armor-pick${current === id ? " is-equipped" : ""}`}
                                  onClick={() => {
                                    onChange((prev) => equipArmor(prev, slot, id));
                                    showToast(`${gearLabel(id)} をそうびした！`);
                                  }}
                                >
                                  <span className="mining-equip-armor-pick-icon" aria-hidden>
                                    <MiningItemIcon gear={id} size={28} alt="" />
                                  </span>
                                  <span className="mining-equip-armor-pick-body">
                                    <span className="mining-equip-armor-pick-label">{effectCopy}</span>
                                    {current === id && (
                                      <span className="mining-equip-tool-badge">そうび中</span>
                                    )}
                                  </span>
                                </button>
                              );
                            })}
                            {current && (
                              <button
                                type="button"
                                className="mining-equip-armor-pick is-unequip"
                                onClick={() => {
                                  onChange((prev) => equipArmor(prev, slot, null));
                                  showToast("はずしたよ");
                                }}
                              >
                                はずす
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={card}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>いまのつよさ</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: theme.text.secondary, marginBottom: 8, lineHeight: 1.45 }}>
              そうびをかえると、数字が変わるよ
            </div>
            <MiningStrengthDetails
              boost={boost}
              bareBoost={bareBoost}
              strength={strength}
              selectedGacha={selectedGacha}
              mining={mining}
            />
          </div>
        </div>
      )}

      {!blockingOverlay && tab === "craft" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(() => {
            const guide = craftTutorialBanner(mining);
            return (
              <div style={{
                ...card,
                backgroundColor: `${theme.accent.primary}10`,
                borderColor: `${theme.accent.primary}44`,
              }}>
                <div style={{ fontWeight: 900, fontSize: 15, color: theme.accent.primary, marginBottom: 8 }}>
                  {guide.title}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {guide.steps.map((step) => (
                    <div key={step} style={{ fontSize: 13, fontWeight: 700, color: theme.text.primary, lineHeight: 1.45 }}>
                      {step}
                    </div>
                  ))}
                </div>
                {guide.tip && (
                  <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: theme.text.secondary, lineHeight: 1.45 }}>
                    ヒント: {guide.tip}
                  </div>
                )}
              </div>
            );
          })()}
          {unlockCard && hasWorkbench(mining) && (
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
          <div className="mining-craft-tabs" role="tablist" aria-label="クラフトのしゅるい">
            {CRAFT_RECIPE_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={craftTab === t.id}
                className={`mining-craft-tab${craftTab === t.id ? " is-active" : ""}`}
                onClick={() => setCraftTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {(() => {
            const annotated = recipes.map((recipe) => {
              const upgradeFrom = recipe.craftFlag ? NETHERITE_UPGRADE_REQUIRES[recipe.craftFlag] : undefined;
              const hasUpgradeBase = !upgradeFrom || !!mining.crafted[upgradeFrom];
              const bedFull = false;
              const owned = !!(recipe.craftFlag && mining.crafted[recipe.craftFlag]);
              const ok =
                canAffordRecipe(recipe.costs, have, recipe.fuelOptions)
                && hasUpgradeBase
                && !owned
                && (!recipe.needsWorkbench || hasWorkbench(mining))
                && (!recipe.needsFurnace || hasFurnace(mining))
                && (!recipe.needsSmithingTable || hasSmithingTable(mining));
              return { recipe, upgradeFrom, hasUpgradeBase, bedFull, owned, ok };
            });
            const byId = new Map(annotated.map((a) => [a.recipe.id, a]));
            const scoped = annotated.filter((a) => recipeMatchesCraftTab(a.recipe, craftTab));
            const recommendOrder = recommendedCraftRecipeIds(mining);
            const recommended = recommendOrder
              .map((id) => byId.get(id))
              .filter((a): a is typeof annotated[number] => !!a && !a.owned && recipeMatchesCraftTab(a.recipe, craftTab));
            const ready = scoped.filter((a) => a.ok);
            const recommendedIds = new Set(recommended.map((a) => a.recipe.id));
            const readyIds = new Set(ready.map((a) => a.recipe.id));
            const rest = scoped.filter((a) => !readyIds.has(a.recipe.id) && !recommendedIds.has(a.recipe.id));
            const collapseRest = craftTab === "all";
            const shownRest = collapseRest && !craftShowAll ? rest.slice(0, 4) : rest;

            const renderRecipe = (a: typeof annotated[number]) => {
              const { recipe, upgradeFrom, hasUpgradeBase, owned, ok } = a;
              const progress = recipeProgress(recipe.costs, have);
              const craftGrid = craftGridForRecipe(recipe);
              const fuelPicked = (() => {
                if (!recipe.fuelOptions?.length) return null;
                const chosen = fuelChoice[recipe.id];
                if (chosen) {
                  const opt = recipe.fuelOptions.find((f) => f.material === chosen);
                  if (opt && have(opt.material) >= opt.amount) return opt;
                }
                return recipe.fuelOptions.find((f) => have(f.material) >= f.amount) ?? null;
              })();
              const isSmelt = !!recipe.fuelOptions?.length;
              const maxTimes = maxCraftTimes(recipe, have, {
                fuel: fuelPicked,
                remainingBeds: recipe.grantsBed ? MAX_BEDS - slots : undefined,
              });
              const qtyStep = smeltQtyStep(fuelPicked);
              const defaultTimes = qtyStep > 1 && maxTimes >= qtyStep ? qtyStep : 1;
              const times = alignCraftTimes(craftQty[recipe.id] ?? defaultTimes, maxTimes, qtyStep);
              const oreCount = isSmelt && recipe.costs[0] ? have(recipe.costs[0].material) : 0;
              const coalWarn = fuelPicked?.material === "coal" ? coalSmeltRemainderWarning(oreCount) : null;
              return (
                <div
                  key={recipe.id}
                  className={`mining-recipe-card${highlightRecipeId === recipe.id ? " is-next-target" : ""}`}
                  style={card}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
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
                        {owned && <span style={{ marginLeft: 8, color: theme.category.green, fontSize: 12 }}>{recipe.grantsBed ? "いっぱい" : "もってる"}</span>}
                      </div>
                      {(() => {
                        const effect = recipeEffectLine(recipe);
                        if (!effect) return null;
                        return (
                          <div style={{
                            marginTop: 6,
                            fontSize: 12,
                            fontWeight: 800,
                            color: theme.accent.primary,
                            lineHeight: 1.4,
                          }}>
                            効果: {effect}
                          </div>
                        );
                      })()}
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
                      {isSmelt ? (
                        <div className={`mining-furnace-ui${smeltingId === recipe.id ? " is-smelting" : ""}`}>
                          <div className="mining-furnace-slot">
                            {recipe.costs[0] && (
                              <MiningSlot material={recipe.costs[0].material} amount={have(recipe.costs[0].material)} size={44} />
                            )}
                            <span className="mining-furnace-cap">いれる</span>
                          </div>
                          <div className={`mining-furnace-flame${fuelPicked ? " is-lit" : ""}${smeltingId === recipe.id ? " is-smelting" : ""}`} aria-hidden>
                            <span className="mining-furnace-flame-core" />
                          </div>
                          <div className="mining-furnace-slot">
                            {fuelPicked ? (
                              <MiningSlot material={fuelPicked.material} amount={have(fuelPicked.material)} size={44} />
                            ) : (
                              <div className="mining-slot is-empty" style={{ width: 44, height: 44 }} />
                            )}
                            <span className="mining-furnace-cap">ねんりょう</span>
                          </div>
                          <div className="mining-furnace-arrow">→</div>
                          <div className="mining-furnace-slot">
                            {recipe.outputs?.[0] && (
                              <MiningSlot material={recipe.outputs[0].material} amount={recipe.outputs[0].amount * times} size={44} />
                            )}
                            <span className="mining-furnace-cap">できる</span>
                          </div>
                          {smeltingId === recipe.id && (
                            <div style={{ width: "100%" }}>
                              <div className="mining-furnace-smelt-bar" aria-hidden>
                                <div className="mining-furnace-smelt-fill" style={{ width: `${Math.round(smeltProgress * 100)}%` }} />
                              </div>
                              <div style={{ marginTop: 4, fontSize: 11, fontWeight: 800, color: "#ffe0a0", textAlign: "center" }}>
                                せいれんちゅう…
                              </div>
                            </div>
                          )}
                        </div>
                      ) : craftGrid ? (
                        <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <CraftGridPreview cells={craftGrid} />
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                            {progress.map((p) => (
                              <div
                                key={p.cost.material}
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: p.ok ? theme.category.green : theme.text.secondary,
                                }}
                              >
                                {MATERIAL_META[p.cost.material].label} {p.have}/{p.cost.amount}
                                {!p.ok && <span style={{ marginLeft: 4, color: theme.category.orange }}>あと{p.need}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
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
                      )}
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                        {progress.map((p) => (
                          !p.ok && (() => {
                            const g = gachaForMaterial(p.cost.material);
                            if (!g || !mining.unlockedGachas.includes(g)) return null;
                            return (
                              <button
                                key={`jump-${p.cost.material}`}
                                type="button"
                                style={{ ...btnGhost, alignSelf: "flex-start", padding: "2px 8px", fontSize: 11, fontWeight: 800 }}
                                onClick={() => {
                                  setOverlay(null);
                                  setTab("mine");
                                  chooseGacha(g);
                                }}
                              >
                                {MATERIAL_META[p.cost.material].label}をほる
                              </button>
                            );
                          })()
                        ))}
                        {recipe.fuelOptions && (
                          <div style={{ marginTop: 4 }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: theme.text.secondary, marginBottom: 4 }}>
                              燃料をえらぶ（どれか1つ）{recipe.needsFurnace ? "・かまど必要" : ""}
                            </div>
                            <div style={{ fontSize: 11, color: theme.text.tertiary, marginBottom: 6, lineHeight: 1.45 }}>
                              石炭は1つでせいれん2回できるよ。2こずつせいれんするよ。「せきたんのやま」でほれるよ
                              {mining.unlockedGachas.includes("coal") && (
                                <button
                                  type="button"
                                  style={{ ...btnGhost, marginLeft: 6, padding: "2px 8px", fontSize: 11, fontWeight: 800 }}
                                  onClick={() => {
                                    setOverlay(null);
                                    setTab("mine");
                                    chooseGacha("coal");
                                  }}
                                >
                                  せきたんへ
                                </button>
                              )}
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {recipe.fuelOptions.map((f) => {
                                const h = have(f.material);
                                const fOk = h >= f.amount;
                                const using = fuelPicked?.material === f.material;
                                return (
                                  <button
                                    key={f.material}
                                    type="button"
                                    disabled={!fOk}
                                    onClick={() => {
                                      if (!fOk) return;
                                      setFuelChoice((prev) => ({ ...prev, [recipe.id]: f.material }));
                                    }}
                                    style={{
                                      ...btnGhost,
                                      opacity: fOk ? 1 : 0.45,
                                      borderColor: using ? theme.accent.primary : theme.stroke.secondary,
                                      backgroundColor: using ? `${theme.accent.primary}18` : theme.fill.secondary,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 6,
                                      padding: "8px 10px",
                                    }}
                                  >
                                    <MiningItemIcon material={f.material} size={18} alt="" />
                                    <span style={{ fontWeight: 800, fontSize: 12 }}>
                                      {MATERIAL_META[f.material].label}×{f.amount}
                                      {f.crafts && f.crafts > 1 ? `（${f.crafts}回）` : ""}
                                    </span>
                                    <span style={{ fontSize: 11, color: theme.text.secondary }}>{h}個</span>
                                    {using && <span style={{ color: theme.accent.primary, fontWeight: 900 }}>選択中</span>}
                                  </button>
                                );
                              })}
                            </div>
                            {coalWarn && (
                              <div style={{
                                marginTop: 8,
                                padding: "8px 10px",
                                borderRadius: 10,
                                backgroundColor: `${theme.category.orange}18`,
                                border: `1.5px solid ${theme.category.orange}66`,
                                fontSize: 12,
                                fontWeight: 800,
                                color: theme.category.orange,
                                lineHeight: 1.45,
                              }}>
                                {coalWarn}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 6, flexShrink: 0 }}>
                      {maxTimes >= 2 && (
                        <div className="mining-craft-qty">
                          <button
                            type="button"
                            className="mining-craft-qty-btn"
                            disabled={times <= qtyStep || !!smeltingId}
                            aria-label={qtyStep > 1 ? `${qtyStep}こへらす` : "へらす"}
                            onClick={() => setCraftQty((prev) => ({
                              ...prev,
                              [recipe.id]: alignCraftTimes(times - qtyStep, maxTimes, qtyStep),
                            }))}
                          >
                            {qtyStep > 1 ? `−${qtyStep}` : "−"}
                          </button>
                          <span className="mining-craft-qty-n">{times}</span>
                          <button
                            type="button"
                            className="mining-craft-qty-btn"
                            disabled={times + qtyStep > maxTimes || !!smeltingId}
                            aria-label={qtyStep > 1 ? `${qtyStep}こふやす` : "ふやす"}
                            onClick={() => setCraftQty((prev) => ({
                              ...prev,
                              [recipe.id]: alignCraftTimes(times + qtyStep, maxTimes, qtyStep),
                            }))}
                          >
                            {qtyStep > 1 ? `＋${qtyStep}` : "＋"}
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        disabled={!ok || owned || !!smeltingId}
                        onClick={() => onCraft(recipe, times)}
                        style={{
                          ...btnPrimary,
                          opacity: ok && !owned && !smeltingId ? 1 : 0.4,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {smeltingId === recipe.id
                          ? "せいれん中"
                          : times > 1
                            ? (isSmelt ? `${times}こせいれん` : `${times}こつくる`)
                            : isSmelt ? "せいれん" : "つくる"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            };

            return (
              <>
                {scoped.length === 0 && (
                  <div style={{ ...card, fontSize: 13, fontWeight: 800, color: theme.text.secondary }}>
                    まだこのレシピはないよ
                  </div>
                )}
                {recommended.length > 0 && (
                  <div style={{ fontWeight: 800, fontSize: 13, color: theme.category.orange }}>
                    おすすめ（いまこれ）
                  </div>
                )}
                {recommended.map(renderRecipe)}
                {ready.length > 0 && (
                  <div style={{ fontWeight: 800, fontSize: 13, color: theme.category.green, marginTop: recommended.length ? 4 : 0 }}>
                    いまつくれる
                  </div>
                )}
                {ready.filter((a) => !recommendedIds.has(a.recipe.id)).map(renderRecipe)}
                {(shownRest.length > 0 || (collapseRest && rest.length > 4)) && (
                  <div style={{ fontWeight: 800, fontSize: 13, color: theme.text.secondary, marginTop: 4 }}>ほかのレシピ</div>
                )}
                {shownRest.map(renderRecipe)}
                {collapseRest && rest.length > 4 && (
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
          {partyStep === "slots" && (
            <div style={card}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>なかまを入れよう</div>
              <div style={{ fontSize: 12, color: theme.text.secondary, lineHeight: 1.5, marginBottom: 8 }}>
                ベッドをつくると、なかまが1人ふえる（いま {slots}/{MAX_BEDS}）
              </div>
              <div style={{
                padding: "8px 10px",
                borderRadius: 10,
                backgroundColor: `${theme.accent.primary}12`,
                fontSize: 12,
                fontWeight: 800,
                color: theme.text.primary,
                lineHeight: 1.45,
                marginBottom: 12,
              }}>
                「{GACHA_META[selectedGacha].label}」向き・人数多め・高Lvほど、素材がふえやすい
              </div>
              <div className="mining-party-slot-list">
                {Array.from({ length: slots }, (_, i) => {
                  const id = mining.partyIds[i];
                  const item = id ? REWARD_LOOKUP[id] : null;
                  const lv = id ? getBuddyEntry(buddyProgress, id).level : 0;
                  return (
                    <button
                      key={i}
                      type="button"
                      className="mining-party-slot-card"
                      onClick={() => {
                        setPartySlotEdit(i);
                        setPartyCategoryFilter(null);
                        setPartyStep("category");
                      }}
                    >
                      <span className="mining-party-slot-face" aria-hidden>
                        {item ? (
                          <StickerThumb item={item} level={lv} size={48} />
                        ) : (
                          <span className="mining-party-slot-empty">＋</span>
                        )}
                      </span>
                      <span className="mining-party-slot-body">
                        <span className="mining-party-slot-title">
                          {item ? `${item.label} Lv${lv}` : "＋ いれる"}
                        </span>
                        <span className="mining-party-slot-sub">
                          {item ? `とくい ${specialtyBlurb(item.category)}` : `スロット${i + 1}`}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {partyStep === "category" && partySlotEdit !== null && (
            <div style={card}>
              <button
                type="button"
                className="mining-dig-dest-back"
                onClick={() => {
                  setPartyStep("slots");
                  setPartySlotEdit(null);
                  setPartyCategoryFilter(null);
                }}
              >
                ← スロットにもどる
              </button>
              <div style={{ fontWeight: 800, marginTop: 8, marginBottom: 4 }}>
                スロット{partySlotEdit + 1} · とくいの場所をえらぶ
              </div>
              <div style={{ fontSize: 12, color: theme.text.secondary, marginBottom: 10, lineHeight: 1.45 }}>
                どの場所がとくいのなかまを入れる？
              </div>
              {mining.partyIds[partySlotEdit] && (
                <button
                  type="button"
                  style={{ ...btnGhost, width: "100%", marginBottom: 10 }}
                  onClick={() => {
                    onChange((prev) => setPartySlot(prev, partySlotEdit, null));
                    showToast("はずしたよ");
                    setPartyStep("slots");
                    setPartySlotEdit(null);
                  }}
                >
                  いまのなかまをはずす
                </button>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {STICKER_CATEGORIES.map((cat) => {
                  const spec = specialtyOfCategory(cat.id);
                  const meta = SPECIALTY_META[spec];
                  const count = ownedStickers.filter((r) => r.category === cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      className="mining-party-cat-btn"
                      disabled={count === 0}
                      onClick={() => {
                        setPartyCategoryFilter(cat.id);
                        setPartyStep("pick");
                      }}
                    >
                      <span>{cat.label}</span>
                      <span className="mining-party-cat-meta">
                        {meta.emoji} {meta.label}
                        <span className="mining-party-cat-count">{count}人</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {partyStep === "pick" && partySlotEdit !== null && partyCategoryFilter && (
            <div style={card}>
              <button
                type="button"
                className="mining-dig-dest-back"
                onClick={() => {
                  setPartyStep("category");
                  setPartyCategoryFilter(null);
                }}
              >
                ← カテゴリにもどる
              </button>
              <div style={{ fontWeight: 800, marginTop: 8, marginBottom: 4 }}>
                スロット{partySlotEdit + 1} · なかまをえらぶ
              </div>
              <div style={{ fontSize: 12, color: theme.text.secondary, marginBottom: 10, lineHeight: 1.45 }}>
                {STICKER_CATEGORIES.find((c) => c.id === partyCategoryFilter)?.label}
                {" · "}
                {specialtyBlurb(partyCategoryFilter)}
              </div>
              {partyCandidates.length === 0 ? (
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.text.tertiary, padding: "12px 4px" }}>
                  このカテゴリのシールはまだないよ
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, maxHeight: 420, overflowY: "auto" }}>
                  {partyCandidates.map((item) => {
                    const lv = getBuddyEntry(buddyProgress, item.id).level;
                    const blurb = specialtyBlurb(item.category);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (!stickerAlbum.includes(item.id)) return;
                          onChange((prev) => setPartySlot(prev, partySlotEdit, item.id));
                          showToast(`${item.label} Lv${lv} を入れた！`);
                          setPartyStep("slots");
                          setPartySlotEdit(null);
                          setPartyCategoryFilter(null);
                        }}
                        style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, textAlign: "left" }}
                      >
                        <StickerThumb item={item} level={lv} />
                        <div style={{ fontSize: 10, fontWeight: 700, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: theme.accent.primary, lineHeight: 1.3, marginTop: 2 }}>
                          Lv{lv} · {blurb}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!blockingOverlay && tab === "bag" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={card}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>おしらせ</div>
            <button
              type="button"
              style={{ ...btnGhost, width: "100%", textAlign: "left" }}
              onClick={() => setBagNoticeOpen((v) => !v)}
            >
              鉱山のおしらせをみる {bagNoticeOpen ? "▲" : "▼"}
            </button>
            {bagNoticeOpen && (
              <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: theme.text.secondary, lineHeight: 1.5 }}>
                岩がかたくなったよ。そのかわり、エンチャントと新しいほりばがふえた！
                農場・牧場・うみ・ようがん・ラピスどうくつと、エンチャントテーブルに挑戦しよう。
                {tableReady && !mining.unlockedGachas.includes("nether") && (
                  <div style={{ marginTop: 8 }}>
                    ダイヤどうぐ3つでネザーがひらくよ。エンチャントはすきなときに。
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={card}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>こうかん所</div>
            <div style={{ fontSize: 12, color: theme.text.secondary, marginBottom: 8, lineHeight: 1.5 }}>
              エメラルドと素材を、おたがいにかえられるよ
            </div>
            {bargainOff > 0 && (
              <div className="mining-bargain-banner">
                やすうりでエメラルド{bargainOff} 安くなってる！
              </div>
            )}
            <div className="mining-exchange-groups">
              <div>
                <div className="mining-exchange-group-label">エメラルドをもらう</div>
                <ExchangeShopRow
                  give={{ material: "nether_quartz", label: "クォーツ", amount: 1 }}
                  get={{ src: EMERALD_IMAGE, label: "エメラルド", amount: QUARTZ_TO_POINTS }}
                  owned={`所持 クォーツ ${have("nether_quartz")}`}
                  disabled={have("nether_quartz") < 1}
                  onClick={() => {
                    const r = exchangeQuartzForPoints(mining);
                    if (r.error) showToast(r.error);
                    else {
                      onChange(patchFromResult((prev) => exchangeQuartzForPoints(prev)));
                      showToast(`ネザークォーツをエメラルド${QUARTZ_TO_POINTS}にかえした！`);
                    }
                  }}
                />
                <ExchangeShopRow
                  give={{ material: "netherrack", label: "ネザーラック", amount: 1 }}
                  get={{ src: EMERALD_IMAGE, label: "エメラルド", amount: NETHERRACK_TO_POINTS }}
                  owned={`所持 ネザーラック ${have("netherrack")}`}
                  disabled={have("netherrack") < 1}
                  onClick={() => {
                    const r = exchangeNetherrackForPoints(mining);
                    if (r.error) showToast(r.error);
                    else {
                      onChange(patchFromResult((prev) => exchangeNetherrackForPoints(prev)));
                      showToast(`ネザーラックをエメラルド${NETHERRACK_TO_POINTS}にかえした！`);
                    }
                  }}
                />
                {isEndChapterDevEnabled() && (
                  <ExchangeShopRow
                    give={{ material: "warped_wart", label: "ウォート", amount: 1 }}
                    get={{ src: EMERALD_IMAGE, label: "エメラルド", amount: WARPED_WART_TO_POINTS }}
                    owned={`所持 ウォート ${have("warped_wart")}`}
                    disabled={have("warped_wart") < 1}
                    onClick={() => {
                      const r = exchangeWarpedWartForPoints(mining);
                      if (r.error) showToast(r.error);
                      else {
                        onChange(patchFromResult((prev) => exchangeWarpedWartForPoints(prev)));
                        showToast(`ウォートをエメラルド${WARPED_WART_TO_POINTS}にかえした！`);
                      }
                    }}
                  />
                )}
              </div>
              <div>
                <div className="mining-exchange-group-label">エメラルドで買う</div>
                <div className="mining-exchange-rows">
                  {EXCHANGE_BUY_OFFERS.map((offer) => {
                    const cost = exchangeCost(offer.baseCost, mining);
                    const meta = MATERIAL_META[offer.material];
                    return (
                      <ExchangeShopRow
                        key={offer.material}
                        give={{ src: EMERALD_IMAGE, label: "エメラルド", amount: cost }}
                        get={{ material: offer.material, label: meta.label, amount: 1 }}
                        owned={`所持 エメラルド ${mining.miningPoints} · ${meta.label} ${have(offer.material)}`}
                        disabled={mining.miningPoints < cost}
                        onClick={() => {
                          const r = exchangePointsForMaterial(mining, offer.material);
                          if (r.error) showToast(r.error);
                          else {
                            onChange(patchFromResult((prev) => exchangePointsForMaterial(prev, offer.material)));
                            showToast(`${meta.label}を1つこうかんした！`);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: theme.text.tertiary, lineHeight: 1.45 }}>
              ネザーでは白い石がよく出るよ。ほしいものはエメラルドでかえられるよ
              {netheriteFullComplete(mining) && (
                <span style={{ display: "block", marginTop: 4, color: theme.category.green, fontWeight: 800 }}>
                  ネザライトそろい！
                </span>
              )}
            </div>
          </div>

          <div style={card}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>素材</div>
            <div style={{ fontSize: 12, color: theme.text.secondary, marginBottom: 8 }}>タップするとクラフトへ行くよ</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(Object.keys(MATERIAL_META) as MaterialId[]).map((id) => {
                const n = have(id);
                if (n <= 0 && id !== "log" && id !== "plank" && id !== "stick" && id !== "wool" && id !== "cobble") return null;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { setOverlay(null); setTab("craft"); }}
                    style={{
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      color: theme.text.primary,
                    }}
                  >
                    <MiningSlot material={id} amount={n} size={52} />
                    <span style={{ fontSize: 11, fontWeight: 800 }}>{MATERIAL_META[id].label}</span>
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

      {!blockingOverlay && (
        <div
          aria-hidden
          style={{ height: bottomChromeHeight + 12, flexShrink: 0 }}
        />
      )}

      {!blockingOverlay && (
        <div
          ref={setBottomChromeEl}
          className="mining-bottom-chrome"
          aria-label="ほる・そうび・なかま・エンチャント"
        >
          {tab === "mine" && overlay !== "digDestination" && (
            <button
              type="button"
              className={`mining-dig-cta${mining.tickets >= 1 && !digBusy ? " is-ready" : ""}`}
              disabled={digBusy}
              onClick={() => openDigDestination("place")}
            >
              {mining.tickets < 1
                ? "ほる場所をみる"
                : `ほる場所をえらぶ · あと${mining.tickets}回`}
            </button>
          )}
          <div className="mining-main-tabs mining-bottom-tabs" aria-label="そうび・なかま・エンチャント">
            <button
              type="button"
              className="mining-main-tab"
              onClick={() => setOverlay("equip")}
            >
              <MiningItemIcon src="/mining/Iron_Chestplate.webp" size={22} alt="" />
              <span className="mining-main-tab-label">そうび</span>
            </button>
            <button
              type="button"
              className="mining-main-tab"
              onClick={() => {
                setOverlay("party");
                setPartyStep("slots");
                setPartySlotEdit(null);
                setPartyCategoryFilter(null);
              }}
            >
              <MiningItemIcon src={STEVE_IMAGE} size={22} alt="" />
              <span className="mining-main-tab-label">なかま</span>
            </button>
            <button
              type="button"
              className={`mining-main-tab${!tableReady ? " is-locked" : ""}`}
              aria-disabled={!tableReady}
              onClick={() => {
                if (!tableReady) {
                  showToast("テーブルができたら使えるよ");
                  return;
                }
                setOverlay("enchant");
              }}
            >
              <MiningItemIcon src={ENCHANTING_TABLE_IMAGE} size={22} alt="" />
              <span className="mining-main-tab-label">エンチャント</span>
            </button>
          </div>
        </div>
      )}

      {overlay === "digDestination" && (
        <div
          className="mining-dig-dest-backdrop"
          onClick={() => {
            resetCombatFx();
            setOverlay(null);
            setDigDestStep("place");
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              resetCombatFx();
              setOverlay(null);
              setDigDestStep("place");
            }
          }}
          role="presentation"
        >
          <div
            className={`mining-dig-dest-sheet${digDestStep === "rock" && isTheEndGacha(selectedGacha) ? " is-end-fight" : ""}${incomingFx ? " is-shake" : ""}${digDestStep === "rock" && (isCombatGacha(selectedGacha) || isTheEndGacha(selectedGacha)) && !canPlayerFight(mining) && !combatBusy && !tapRush ? " is-you-died" : ""}${combatBusy && dragonFx?.usedBed ? " is-bed-boom" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={
              digDestStep === "place"
                ? "どこをほる？"
                : isBucketGacha(selectedGacha)
                  ? `${selectedMeta.label}でくむ`
                  : `${selectedMeta.label}でほる`
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mining-dig-dest-handle" aria-hidden />
            {tapRush && (
              <SpecialTapRush
                showHint={!mining.specialHintSeen}
                onFirstTap={onSpecialFirstTap}
                onFinish={finishSpecialTaps}
              />
            )}
            <SpecialFinale
              active={!!specialFinale}
              taps={specialFinale?.taps ?? 0}
              damage={specialFinale?.damage ?? 0}
            />
            {digDestStep === "rock"
              && (isCombatGacha(selectedGacha) || isTheEndGacha(selectedGacha))
              && !canPlayerFight(mining)
              && !combatBusy
              && !tapRush && (
              <YouDiedOverlay
                tickets={mining.tickets}
                busy={combatBusy}
                onRevive={reviveInFight}
                onFlee={fleeFromFight}
              />
            )}
            <div className="mining-dig-dest-head">
              <div className="mining-dig-dest-title">
                {digDestStep === "place" ? "どこをほる？" : ""}
              </div>
              <button
                type="button"
                className="mining-dig-dest-close"
                onClick={() => {
                  resetCombatFx();
                  setOverlay(null);
                  setDigDestStep("place");
                }}
                aria-label="とじる"
              >
                ×
              </button>
            </div>

            {digDestStep === "place" && (
              <>
                {mining.tickets < 1 && (
                  <div className="mining-dig-dest-hint">チケットがないよ。みるだけできるよ</div>
                )}
                {ironRoute && (
                  <div className="mining-dig-dest-hint">おすすめ: せきたん → かまど → てつ</div>
                )}
                {showsEnderEyeHoldHint(mining) && (
                  <div className="mining-dig-dest-hint">
                    そうびの持ち物にエンダーアイを入れて、ほりばで持ってみると…？
                  </div>
                )}
                {showsEndHuntHint(mining) && (
                  <div className="mining-dig-dest-hint">
                    {mining.endQuest?.mark
                      ? `エンダーアイのマーク：${GACHA_META[mining.endQuest.mark].label}`
                      : "エンダーアイを持ち物にしたよ。どこかをほると投げるよ"}
                  </div>
                )}
                <div className="mining-biome-grid">
                  {GACHA_ORDER.filter((gid) => listsMiningDestination(mining, gid)).map((gid) => {
                    const unlocked = mining.unlockedGachas.includes(gid);
                    const meta = GACHA_META[gid];
                    const isLucky = unlocked && lucky === gid;
                    const selected = unlocked && selectedGacha === gid;
                    const hasOtherSelected = unlocked && selectedGacha !== gid;
                    const isNext = highlightGacha === gid;
                    if (!unlocked) {
                      return (
                        <button
                          key={gid}
                          type="button"
                          className="mining-biome-card is-locked"
                          onClick={() => showToast(gachaLockHint(gid, mining), "normal", 4000)}
                        >
                          <img className="mining-biome-card-img" src={DIG_BLOCK_IMAGE[gid]} alt="" draggable={false} />
                          <div className="mining-biome-card-shade" />
                          <div className="mining-biome-card-body">
                            <div className="mining-biome-card-title">🔒 {meta.label}</div>
                            <div className="mining-biome-card-badge">{gachaLockBadge(gid)}</div>
                          </div>
                        </button>
                      );
                    }
                    return (
                      <button
                        key={gid}
                        type="button"
                        className={`mining-biome-card${selected ? " is-selected" : ""}${hasOtherSelected ? " is-dim" : ""}${isNext ? " is-next-target" : ""}`}
                        onClick={() => selectDigPlace(gid)}
                      >
                        <img className="mining-biome-card-img" src={DIG_BLOCK_IMAGE[gid]} alt="" draggable={false} />
                        <div className="mining-biome-card-shade" />
                        {showsEndHuntHint(mining) && mining.endQuest?.mark === gid && (
                          <img
                            className="mining-biome-card-eye"
                            src={ENDER_EYE_IMAGE}
                            alt=""
                            draggable={false}
                          />
                        )}
                        <div className="mining-biome-card-body">
                          <div className="mining-biome-card-title">{meta.emoji} {meta.label}</div>
                          {meta.badge && <div className="mining-biome-card-badge">{meta.badge}</div>}
                          {gid === "coal" && !meta.badge && (
                            <div className="mining-biome-card-badge">石炭がとれる</div>
                          )}
                          {gid === "gold" && (
                            <div className="mining-biome-card-badge is-optional">あとでOK</div>
                          )}
                          {gid === "diamond" && !meta.badge && (
                            <div className="mining-biome-card-badge">ダイヤのかけら</div>
                          )}
                          {isLucky && (
                            <div className="mining-biome-card-badge is-lucky">★こううん日</div>
                          )}
                          {selected && (
                            <div className="mining-biome-card-badge">いまここ</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {digDestStep === "rock" && (
              <div className="mining-dig-dest-rock">
                {!isTheEndGacha(selectedGacha) && (
                <div className="mining-rock-scene" aria-hidden={false}>
                  <img
                    className="mining-rock-scene-img"
                    src={DIG_BLOCK_IMAGE[selectedGacha]}
                    alt=""
                    draggable={false}
                  />
                  <div className="mining-rock-scene-shade" />
                  <div className="mining-rock-scene-caption">
                    <span aria-hidden>{selectedMeta.emoji}</span>
                    <span>
                      {selectedGacha === "river"
                        ? "うみで水をくむ"
                        : selectedGacha === "lava_cave"
                          ? "ようがんでくむ"
                          : isChestGacha(selectedGacha)
                            ? `${selectedMeta.label}のチェスト`
                            : isCombatGacha(selectedGacha) || isTheEndGacha(selectedGacha)
                              ? `${selectedMeta.label}でたたかう`
                              : isEndPortalGacha(selectedGacha)
                                ? "エンダーアイをはめる"
                                : `${selectedMeta.label}でほる`}
                    </span>
                  </div>
                </div>
                )}

                <button
                  type="button"
                  className="mining-dig-dest-back"
                  onClick={() => {
                    resetCombatFx();
                    setDigDestStep("place");
                  }}
                >
                  ← 場所を選びなおす
                </button>

                {isEndPortalGacha(selectedGacha) ? (
                  <EndPortalPanel
                    mining={mining}
                    shaking={portalShake}
                    insertPulse={insertPulse}
                    onInsert={insertEyeAtPortal}
                    onUnlockTheEnd={openTheEndFromPortal}
                  />
                ) : isTheEndGacha(selectedGacha) ? (
                  <EndDragonPanel
                    mining={mining}
                    buddyProgress={buddyProgress}
                    busy={combatBusy}
                    tickets={mining.tickets}
                    selected={dragonTarget}
                    fx={dragonFx}
                    takenHearts={playerHitHearts}
                    playerDied={playerDiedFx}
                    heavyHit={dragonHeavyHit}
                    incoming={incomingFx}
                    onSelect={setDragonTarget}
                    onPick={pickDragonInSheet}
                    onBed={explodeDragonBed}
                    onRevive={reviveInFight}
                    onFlee={fleeFromFight}
                    onFireSpecial={startSpecialInSheet}
                  />
                ) : isCombatGacha(selectedGacha) ? (
                  <MiningCombatPanel
                    mining={mining}
                    gacha={selectedGacha}
                    hint={rockHint}
                    busy={combatBusy}
                    fallen={combatFallen}
                    flash={combatFlash}
                    gone={combatGone}
                    swings={combatSwings}
                    hitDamage={combatHitDamage}
                    emphasis={combatEmphasis}
                    slashSeed={combatSlashSeed}
                    tickets={mining.tickets}
                    takenHearts={playerHitHearts}
                    playerDied={playerDiedFx}
                    incoming={incomingFx}
                    striking={striking}
                    onFireSpecial={startSpecialInSheet}
                    onPick={pickRockInSheet}
                    onRevive={reviveInFight}
                  />
                ) : isBucketGacha(selectedGacha) && !hasBucket(mining) ? (
                  <div style={{ marginTop: 12, fontSize: 14, fontWeight: 800, color: theme.category.orange }}>
                    鉄のバケツを作ってから入ろう
                    <button
                      type="button"
                      style={{ ...btnPrimary, width: "100%", marginTop: 12 }}
                      onClick={() => {
                        setOverlay(null);
                        setCraftTab("facility");
                        setTab("craft");
                      }}
                    >
                      クラフトへ
                    </button>
                  </div>
                ) : (
                  <div className="mining-rock-pick-stage">
                    <div className="mining-rock-pick-stage-title">
                      {isBucketGacha(selectedGacha)
                        ? "どれをくむ？"
                        : isChestGacha(selectedGacha)
                          ? "どのチェスト？"
                          : "どれをたたく？"}
                    </div>
                    <div className="mining-rock-pick-stage-sub">あたりはひみつ。すきなのを選ぼう</div>
                    <div className="mining-rock-hero-row">
                      {(["左", "まんなか", "みぎ"] as const).map((label, i) => {
                        const isHitHint = rockHint.kind === "hit" && rockHint.index === i;
                        const isMissHint = rockHint.kind === "miss" && rockHint.index === i;
                        return (
                          <button
                            key={label}
                            type="button"
                            className={`mining-rock-tile v${i}${isHitHint ? " is-glow" : ""}${isMissHint ? " is-miss-hint" : ""}`}
                            disabled={digBusy || mining.tickets < 1}
                            onClick={() => pickRockInSheet(i)}
                          >
                            <span className="mining-rock-tile-face" aria-hidden>
                              <img
                                className="mining-rock-tile-img"
                                src={DIG_BLOCK_IMAGE[selectedGacha]}
                                alt=""
                                draggable={false}
                              />
                              <span className="mining-rock-tile-crack" />
                            </span>
                            <span className="mining-rock-tile-label">{label}</span>
                            {isMissHint && (
                              <span className="mining-rock-tile-badge is-miss">はずれ</span>
                            )}
                            {isHitHint && (
                              <span className="mining-rock-tile-badge is-hit">あたり</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {mining.tickets < 1 && (
                      <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: theme.text.secondary }}>
                        チケットが足りないよ
                      </div>
                    )}
                    {rockHint.kind === "hit" && (
                      <div className="mining-rock-pick-lucky-hint">
                        {isBucketGacha(selectedGacha)
                          ? "ヘルメットのヒント：キラッと光るところがあたりだよ"
                          : isChestGacha(selectedGacha)
                            ? "ヘルメットのヒント：キラッと光るチェストがあたりだよ"
                            : "ヘルメットのヒント：キラッと光る岩があたりだよ"}
                      </div>
                    )}
                    {rockHint.kind === "miss" && (
                      <div className="mining-rock-pick-lucky-hint">
                        {isBucketGacha(selectedGacha)
                          ? "ヘルメットのヒント：うすいところははずれだよ"
                          : isChestGacha(selectedGacha)
                            ? "ヘルメットのヒント：うすいチェストははずれだよ"
                            : "ヘルメットのヒント：うすい岩ははずれだよ"}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {overlay === "enchant" && hasEnchantingTable(mining) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 24 }}>
          <MiningEnchantPanel
            mining={mining}
            onChange={onChange}
            showToast={(msg) => showToast(msg)}
            onFirstEnchant={(id) => {
              setOverlay(null);
              setDemoDig(id);
            }}
          />
        </div>
      )}

      {demoDig && (
        <div className="mining-rock-pick-backdrop" role="dialog" aria-label="デモほり">
          <div className="mining-rock-pick-sheet">
            {(() => {
              const demo = demoDigLines(demoDig);
              return (
                <>
                  <div className="mining-rock-pick-title">{demo.title}</div>
                  <div className="mining-demo-lines">
                    {demo.lines.map((line) => (
                      <div key={line} className="mining-demo-line">{line}</div>
                    ))}
                  </div>
                  <div className="mining-demo-highlight">{demo.highlight}</div>
                  <button
                    type="button"
                    className="mining-enchant-primary"
                    onClick={() => setDemoDig(null)}
                  >
                    わかった！
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {routeBranchOpen && !versionNoticeOpen && !demoDig && (
        <div className="mining-rock-pick-backdrop" role="dialog" aria-label="つぎのどっちも正解">
          <div className="mining-rock-pick-sheet">
            <div className="mining-rock-pick-title">どっちも正解！</div>
            <div className="mining-rock-pick-sub" style={{ textAlign: "left", lineHeight: 1.5 }}>
              エンチャントも、ネザーも、すきな順でOKだよ
            </div>
            <div className="mining-route-branch">
              <button
                type="button"
                className="mining-route-branch-card"
                onClick={() => {
                  onChange((prev) => ({ ...prev, miningRouteBranchSeen: true }));
                  setRouteBranchOpen(false);
                  setTab("craft");
                  showToast("はやくネザーへ！ダイヤどうぐをつくろう", "progress");
                }}
              >
                <div className="mining-route-branch-title">はやくネザーへ</div>
                <div className="mining-route-branch-body">ダイヤどうぐ3つをそろえて、すぐネザーへ</div>
              </button>
              <button
                type="button"
                className="mining-route-branch-card"
                onClick={() => {
                  onChange((prev) => ({ ...prev, miningRouteBranchSeen: true }));
                  setRouteBranchOpen(false);
                  setOverlay("enchant");
                  showToast("つよくなってから行こう！エンチャントをつけよう", "progress");
                }}
              >
                <div className="mining-route-branch-title">つよくなってから行く</div>
                <div className="mining-route-branch-body">エンチャントをつけてから、ネザーへ進む</div>
              </button>
            </div>
            <button
              type="button"
              className="mining-enchant-secondary"
              onClick={() => {
                onChange((prev) => ({ ...prev, miningRouteBranchSeen: true }));
                setRouteBranchOpen(false);
              }}
            >
              あとで決める
            </button>
          </div>
        </div>
      )}

      {versionNoticeOpen && (
        <div className="mining-rock-pick-backdrop" role="dialog" aria-label="鉱山アップデート">
          <div className="mining-rock-pick-sheet">
            <div className="mining-rock-pick-title">鉱山がバージョンアップ！</div>
            <div className="mining-rock-pick-sub" style={{ textAlign: "left", lineHeight: 1.55 }}>
              岩がかたくなったよ。そのかわり、エンチャントと新しいほりばがふえた！
              農場・牧場・うみ・ようがん・ラピスどうくつと、エンチャントテーブルに挑戦しよう。
            </div>
            <button
              type="button"
              className="mining-enchant-primary"
              onClick={() => {
                onChange((prev) => ({ ...prev, miningVersionNoticeSeen: true }));
                setVersionNoticeOpen(false);
              }}
            >
              わかった！
            </button>
          </div>
        </div>
      )}

      <DigFxOverlay
        phase={digFx}
        crackStage={crackStage}
        maxCrackStage={MAX_CRACK_STAGE}
        gacha={selectedGacha}
        result={lastDig}
        partyItems={partyDigItems}
        digHitPulse={digHitPulse}
        ownedCount={have}
        canDigAgain={
          digFx === "reveal"
          && !pendingDiscover
          && mining.tickets >= 1
          && mining.unlockedGachas.includes(selectedGacha)
          && !isCombatGacha(selectedGacha)
          && !isTheEndGacha(selectedGacha)
        }
        onCrackTap={onCrackTap}
        onDigAgain={digAgainFromFx}
        onClose={closeDigFx}
      />

      {endCinematic && (
        <EndCinematicOverlay
          kind={endCinematic}
          onClose={() => setEndCinematic(null)}
        />
      )}

      {portalFx && (
        <NetherPortalOverlay onClose={() => setPortalFx(false)} />
      )}

      {chapterQueue[0] && !portalFx && (
        <ChapterCelebrateOverlay
          moment={chapterQueue[0]}
          onClose={() => setChapterQueue((q) => q.slice(1))}
        />
      )}

      {craftPop && (
        <CraftSuccessPop label={craftPop.label} icon={craftPop.icon} />
      )}

      {toast && (
        <div
          className={toastKind === "progress" ? "mining-progress-toast" : undefined}
          style={toastKind === "progress" ? undefined : {
            position: "fixed", left: 16, right: 16,
            bottom: tab === "mine"
              ? "calc(max(env(safe-area-inset-bottom, 0px), 10px) + 64px)"
              : 24,
            zIndex: 200,
            padding: "12px 16px", borderRadius: 14, background: "rgba(0,0,0,0.82)",
            color: "#fff", fontWeight: 800, textAlign: "center",
            whiteSpace: "pre-line", lineHeight: 1.45,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
