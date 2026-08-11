import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { theme } from "./theme";
import { ScrollSafeBackButton } from "./ScrollSafeBackButton";
import { StickerFrameWithBadge, StickerImg } from "./Rewards";
import { BuddyFrame } from "./BuddyFrame";
import { getBuddyEntry, type BuddyProgressMap } from "./buddyProgress";
import { REWARD_LOOKUP, STICKER_CATEGORIES, type RewardCategory, type RewardLookupEntry } from "./stickerRewards";
import { playGachaAmbient, playMiningSfx, unlockAudio } from "./alarm";
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
  digHitTier,
  isDigHighlightDrop,
  setPartySlot,
  specialtyForGacha,
  tryCraft,
  type DigResult,
  type MiningRecipe,
} from "./miningProgress";
import { NETHERITE_UPGRADE_REQUIRES, craftGridForRecipe, recipeProgress } from "./miningRecipes";
import { MiningItemIcon } from "./MiningItemIcon";
import {
  boostStrengthLabel,
  craftTutorialBanner,
  detectChapterMoments,
  detectProgressNudge,
  digRevealTitle,
  gachaForMaterial,
  miningNextHero,
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
  DIG_BLOCK_IMAGE,
  GACHA_META,
  GACHA_ORDER,
  MATERIAL_META,
  MAX_BEDS,
  TOOL_KIND_LABEL,
  TOOL_EFFECT_BLURB,
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
  onBack: () => void;
}

type TabId = "mine" | "craft" | "bag";
type OverlayId = "party" | "equip" | "digDestination" | null;
type DigFxPhase = "idle" | "crack" | "break" | "reveal";
type ArmorSlot = "helmet" | "chest" | "leggings" | "boots";
type ToastKind = "normal" | "progress";

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
  stone: { top: "#9aa0a6", front: "#7d838a", side: "#5f646a", edge: "#2f3338" },
  iron: { top: "#c4cdd6", front: "#8a959f", side: "#6a737c", edge: "#3a424a" },
  coal: { top: "#5a5a5a", front: "#3d3d3d", side: "#2a2a2a", edge: "#111" },
  gold: { top: "#f0d060", front: "#c9a227", side: "#9a7a14", edge: "#5a4408" },
  diamond: { top: "#6ad4e8", front: "#2aa8c4", side: "#1a7a90", edge: "#0a3a48" },
  nether: { top: "#8b3a32", front: "#6b241e", side: "#4a1512", edge: "#220a08" },
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
          {(tier === "good" || tier === "great") && (
            <div className="mining-dig-burst" aria-hidden style={{ position: "relative", marginBottom: 4 }}>
              {tier === "great" ? "✦" : "✧"}
            </div>
          )}
          <div className={`mining-fp-result-title${tier !== "normal" ? ` is-${tier}` : ""}`}>
            {revealCopy.title}
          </div>
          {revealCopy.sub && (
            <div className="mining-fp-result-sub">{revealCopy.sub}</div>
          )}
          <div className="mining-dig-slot-row">
            {result && result.drops.map((d, i) => {
              const highlight = isDigHighlightDrop(d.material, d.amount, tier);
              return (
                <div
                  key={`${d.material}-${i}`}
                  className={`mining-dig-slot-wrap${highlight ? " is-highlight" : ""}${tier === "great" && highlight ? " is-great-pop" : ""}`}
                >
                  <MiningSlot material={d.material} amount={d.amount} size={highlight ? 56 : 48} highlight={highlight} />
                  <span className="mining-dig-slot-label">{MATERIAL_META[d.material].label}</span>
                </div>
              );
            })}
          </div>
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
          {result && (
            <div className="mining-dig-breakdown">
              {result.breakdown.join(" · ")}
              {result.usedTool ? ` · ${gearLabel(result.usedTool)}` : ""}
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

function gachaLockHint(gid: GachaId): string {
  if (gid === "stone") return "木の剣・斧・ツルハシでひらく";
  if (gid === "iron" || gid === "gold" || gid === "coal") return "石の剣・斧・ツルハシでひらく";
  if (gid === "diamond") return "鉄の剣・斧・ツルハシでひらく";
  if (gid === "nether") return "ダイヤの剣・斧・ツルハシでひらく";
  return "まだひらいてない";
}

export function MiningScreen({
  mining,
  stickerAlbum,
  buddyProgress,
  dateKey,
  onChange,
  onBack,
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
  const [digBusy, setDigBusy] = useState(false);
  const [boostDetailOpen, setBoostDetailOpen] = useState(false);
  const [craftShowAll, setCraftShowAll] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [progressNudge, setProgressNudge] = useState<ProgressNudge | null>(null);
  const [fuelChoice, setFuelChoice] = useState<Partial<Record<string, MaterialId>>>({});
  const [chapterQueue, setChapterQueue] = useState<ChapterMoment[]>([]);
  const [craftPop, setCraftPop] = useState<{ label: string; icon: ReactNode } | null>(null);
  const [armorDetailOpen, setArmorDetailOpen] = useState<Partial<Record<ArmorSlot, boolean>>>({});
  const [smeltingId, setSmeltingId] = useState<string | null>(null);
  const [smeltProgress, setSmeltProgress] = useState(0);
  const [pinRect, setPinRect] = useState({ top: 0, left: 0, width: 0, padL: 16, padR: 16, padT: 16 });
  const [chromeHeight, setChromeHeight] = useState(96);
  const chromeRef = useRef<HTMLDivElement>(null);
  const crackStageRef = useRef(0);
  const smeltTimerRef = useRef(0);
  const pendingDigChaptersRef = useRef<ChapterMoment[]>([]);
  const miningRef = useRef(mining);
  miningRef.current = mining;

  useLayoutEffect(() => {
    const scroll = document.querySelector("[data-app-scroll]");
    if (!(scroll instanceof HTMLElement)) return;

    const sync = () => {
      const r = scroll.getBoundingClientRect();
      const cs = getComputedStyle(scroll);
      const padT = parseFloat(cs.paddingTop) || 0;
      const padL = parseFloat(cs.paddingLeft) || 16;
      const padR = parseFloat(cs.paddingRight) || 16;
      // AppScroll 上端にぴったり固定。safe-area はヘッダー内部の padding で吸収する
      // （padding 下に置くと、その隙間からスクロール内容が覗く）
      setPinRect({
        top: r.top,
        left: r.left,
        width: r.width,
        padL,
        padR,
        padT,
      });
      if (chromeRef.current) {
        setChromeHeight(chromeRef.current.offsetHeight);
      }
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(scroll);
    if (chromeRef.current) ro.observe(chromeRef.current);
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [overlay, tab]);

  /** AppScroll の padding-top 分は既に空いているので、スペーサーはヘッダーのうち中身側だけ */
  const chromeSpacerHeight = Math.max(0, chromeHeight - pinRect.padT);

  const recipes = useMemo(() => recipesForState(mining), [mining]);
  /** 作業台前だけ折りたたみ。以降は常に見える（どこで設定するか迷子防止） */
  const supportFoldable = !hasWorkbench(mining);
  const supportExpanded = !supportFoldable || supportOpen;
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

  const showToast = (msg: string, kind: ToastKind = "normal") => {
    setToast(msg);
    setToastKind(kind);
    if (kind === "progress") void playMiningSfx("progress");
    window.setTimeout(() => setToast(null), kind === "progress" ? 2600 : 2200);
  };

  const have = (id: MaterialId) => getMaterialCount(mining, id);

  const selectToolKind = (kind: ToolKind) => {
    setToolKind(kind);
    const best = bestOwnedTool(mining, kind);
    if (best) onChange(equipTool(mining, best));
  };

  /** 行き先を選び、おすすめどうぐを装備し、前回行き先を保存する */
  const chooseGacha = (gid: GachaId) => {
    setSelectedGacha(gid);
    const kind = recommendToolKind(gid);
    setToolKind(kind);
    void unlockAudio();
    playGachaAmbient(gid);
    let next: MiningState = { ...mining, lastSelectedGacha: gid };
    const best = bestOwnedTool(next, kind);
    if (best) next = equipTool(next, best);
    onChange(next);
  };

  const beginDigFx = (result: DigResult) => {
    const before = mining;
    const beforeUnlocks = new Set(mining.unlockedGachas);
    setDigBusy(true);
    onChange(result.state);
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

  /** 行き先を確定して即掘る（シート用。gacha を明示して stale state を避ける） */
  const digAt = (gacha: GachaId) => {
    if (digBusy) return;
    const kind = recommendToolKind(gacha);
    setSelectedGacha(gacha);
    setToolKind(kind);
    setOverlay(null);
    void unlockAudio();
    playGachaAmbient(gacha);
    let stateForDig: MiningState = { ...mining, lastSelectedGacha: gacha };
    const best = bestOwnedTool(stateForDig, kind);
    if (best) stateForDig = equipTool(stateForDig, best);
    const result = resolveDig({
      state: stateForDig,
      gacha,
      toolKind: kind,
      buddyProgress,
      dateKey,
    });
    if ("error" in result) {
      onChange(stateForDig);
      showToast(result.error);
      return;
    }
    beginDigFx(result);
  };

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
  };

  const digAgainFromFx = () => {
    if (digFx !== "reveal") return;
    if (mining.tickets < 1) {
      showToast("チケットが足りないよ");
      closeDigFx();
      return;
    }
    const result = resolveDig({
      state: mining,
      gacha: selectedGacha,
      toolKind,
      buddyProgress,
      dateKey,
    });
    if ("error" in result) {
      showToast(result.error);
      closeDigFx();
      return;
    }
    beginDigFx(result);
  };

  const announceUnlocks = (before: Set<GachaId>, next: MiningState) => {
    const unlockMessages: { id: GachaId; label: string }[] = [
      { id: "stone", label: "いしのどうくつ ひらいた！" },
      { id: "iron", label: "てつのこうざん ひらいた！" },
      { id: "coal", label: "せきたんのやま ひらいた！" },
      { id: "gold", label: "きんのこうざん ひらいた！" },
      { id: "diamond", label: "ダイヤのしんそう ひらいた！" },
      { id: "nether", label: "ネザー ひらいた！" },
    ];
    let delay = 500;
    for (const msg of unlockMessages) {
      if (!before.has(msg.id) && next.unlockedGachas.includes(msg.id)) {
        if (msg.id === "nether") {
          window.setTimeout(() => setPortalFx(true), delay);
        } else {
          window.setTimeout(() => showToast(msg.label, "progress"), delay);
        }
        delay += 900;
      }
    }
  };

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
  ) => {
    const beforeUnlocks = new Set(before.unlockedGachas);
    const beforeBeds = partySlotCount(before);
    onChange(nextState);

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
    setCraftPop({ label: `${recipe.label} できた！`, icon });
    window.setTimeout(() => setCraftPop(null), 1100);

    const nudge = detectProgressNudge(before, nextState);
    if (nudge) {
      setProgressNudge(nudge);
      if (nudge.action === "party" || nudge.action === "equip") {
        setSupportOpen(true);
      }
      if (nudge.action === "craft") {
        setTab("craft");
      }
    } else if (recipe.grantsBed && partySlotCount(nextState) > beforeBeds) {
      showToast(`ベッドできた！なかま ${partySlotCount(nextState)}人まで`, "progress");
    }

    announceUnlocks(beforeUnlocks, nextState);
    enqueueChapters(detectChapterMoments(before, nextState));
  };

  const runNudgeAction = (nudge: ProgressNudge) => {
    if (nudge.action === "party") {
      setSupportOpen(true);
      setOverlay("party");
      setPartySlotEdit(0);
      setTab("mine");
    } else if (nudge.action === "equip") {
      setSupportOpen(true);
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

  const onCraft = (recipe: MiningRecipe) => {
    if (smeltingId) return;
    const chosenId = fuelChoice[recipe.id];
    const fuel =
      recipe.fuelOptions && chosenId
        ? recipe.fuelOptions.find((f) => f.material === chosenId)
        : undefined;
    const snapshot = miningRef.current;

    if (recipe.fuelOptions?.length) {
      const preview = tryCraft(snapshot, recipe, fuel ? { fuel } : undefined);
      if (preview.error) {
        showToast(preview.error);
        return;
      }
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
          const latest = miningRef.current;
          const result = tryCraft(latest, recipe, fuel ? { fuel } : undefined);
          if (result.error) {
            showToast(result.error);
            return;
          }
          finishCraftSuccess(latest, recipe, result.state);
          return;
        }
        smeltTimerRef.current = window.setTimeout(tick, 40);
      };
      smeltTimerRef.current = window.setTimeout(tick, 40);
      return;
    }

    const result = tryCraft(snapshot, recipe, fuel ? { fuel } : undefined);
    if (result.error) {
      showToast(result.error);
      return;
    }
    finishCraftSuccess(snapshot, recipe, result.state);
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

  const tabs: { id: TabId; label: string }[] = [
    { id: "mine", label: "ほる" },
    { id: "craft", label: "クラフト" },
    { id: "bag", label: "もちもの" },
  ];
  const unlockCard = nextGachaUnlock(mining);

  const armorSlots: ArmorSlot[] = ["helmet", "chest", "leggings", "boots"];

  const nextHero = miningNextHero(mining);
  const ironRoute = showIronRouteGuide(mining);
  const strength = boostStrengthLabel(boost.expectedExtra);
  const wantSpec = specialtyForGacha(selectedGacha);
  const digNeedsTickets = mining.tickets < 1;
  const digSheetReady = !digBusy && mining.tickets >= 1;

  const jumpFromHero = () => {
    if (nextHero.preferredGacha && mining.unlockedGachas.includes(nextHero.preferredGacha)) {
      chooseGacha(nextHero.preferredGacha);
    }
    if (nextHero.jumpTab === "mine") {
      setOverlay(null);
      setTab("mine");
      return;
    }
    setOverlay(null);
    setTab("craft");
  };

  /** party / equip は全画面置換。digDestination はボトムシートなので本体UIを残す */
  const blockingOverlay = overlay === "party" || overlay === "equip";
  const selectedMeta = GACHA_META[selectedGacha];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: "80vh", paddingBottom: tab === "mine" ? 120 : 72 }}>
      {!blockingOverlay && (
        <>
          {/* フロー内スペーサー: fixed ヘッダーのうち、AppScroll padding より下の分だけ確保 */}
          <div style={{ height: chromeSpacerHeight, flexShrink: 0 }} aria-hidden />
          <div
            ref={chromeRef}
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
                  style={
                    tab === t.id
                      ? {
                          backgroundColor: `${theme.accent.primary}18`,
                          borderColor: theme.accent.primary,
                          color: theme.accent.primary,
                        }
                      : {
                          backgroundColor: theme.fill.secondary,
                          borderColor: theme.stroke.secondary,
                          color: theme.text.primary,
                        }
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {blockingOverlay && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ScrollSafeBackButton onBack={() => setOverlay(null)} />
          <div style={{ fontSize: 18, fontWeight: 800, color: theme.text.primary }}>
            {overlay === "party" ? "パーティ" : "そうび"}
          </div>
        </div>
      )}

      {!blockingOverlay && (
      <>
      <div style={{ ...card, padding: "10px 12px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <span style={{ fontWeight: 900, color: theme.category.orange, fontSize: 16 }}>🎫 {mining.tickets}</span>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={{ fontWeight: 800, color: theme.text.secondary, fontSize: 14 }}>
              こうかん⭐ {mining.miningPoints}
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
              {nextHero.jumpTab === "mine" ? "ほりにいく" : "クラフトへ"}
            </button>
          )}
        </div>

        {mining.tickets < 1 && (
          <div style={{
            marginTop: 8,
            padding: "8px 10px",
            borderRadius: 10,
            backgroundColor: `${theme.category.orange}18`,
            fontSize: 13,
            fontWeight: 800,
            color: theme.text.primary,
            lineHeight: 1.45,
          }}>
            チケットは親のハンコでもらえるよ。もどってタスクをクリアしよう！
            <button
              type="button"
              onClick={onBack}
              style={{ ...btnGhost, marginTop: 6, fontWeight: 900, borderColor: theme.category.orange }}
            >
              タスクにもどる
            </button>
          </div>
        )}
        {netheriteFullComplete(mining) && (
          <div style={{ marginTop: 4, fontSize: 11, fontWeight: 800, color: theme.category.green }}>
            ネザライトそろい：残骸が出やすいよ
          </div>
        )}
      </div>

      {progressNudge && !blockingOverlay && (
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

      <div
        style={{
          ...card,
          padding: 10,
          borderColor: progressNudge && (progressNudge.action === "party" || progressNudge.action === "equip")
            ? theme.accent.primary
            : theme.stroke.secondary,
          boxShadow: progressNudge && (progressNudge.action === "party" || progressNudge.action === "equip")
            ? `0 0 0 2px ${theme.accent.primary}33`
            : undefined,
        }}
      >
        <button
          type="button"
          onClick={() => { if (supportFoldable) setSupportOpen((v) => !v); }}
          style={{
            width: "100%", border: "none", background: "transparent", padding: 0,
            cursor: supportFoldable ? "pointer" : "default", textAlign: "left", color: theme.text.primary,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: theme.text.secondary }}>
              パーティ・そうび
              {supportFoldable && !supportOpen && <span style={{ marginLeft: 8, fontWeight: 700 }}>（作業台のあとでひらく）</span>}
            </div>
            {supportFoldable && (
              <span style={{ fontSize: 12, fontWeight: 800, color: theme.text.tertiary }}>{supportOpen ? "▲" : "▼"}</span>
            )}
          </div>
        </button>
        {supportExpanded && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.text.tertiary }}>
              緑わく＝いまの場所向き。ベッドでなかまがふえるよ
            </div>
            <button type="button" onClick={() => { setOverlay("party"); setPartySlotEdit(0); }} style={{ ...btnGhost, textAlign: "left", padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontWeight: 800, fontSize: 13 }}>パーティ（{slots}/{MAX_BEDS}）</span>
                <span style={{ color: theme.text.tertiary }}>›</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {Array.from({ length: slots }, (_, i) => {
                  const id = mining.partyIds[i];
                  const item = id ? REWARD_LOOKUP[id] : null;
                  const lv = id ? getBuddyEntry(buddyProgress, id).level : 1;
                  const match = !!(item && specialtyOfCategory(item.category) === wantSpec);
                  return (
                    <div key={i} style={{
                      width: 48, height: 52, borderRadius: 10,
                      border: `1.5px ${match ? "solid" : "dashed"} ${match ? theme.category.green : theme.stroke.primary}`,
                      background: match ? `${theme.category.green}14` : theme.fill.quaternary,
                      padding: 2, display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {item ? <StickerThumb item={item} level={lv} size={42} /> : (
                        <span style={{ fontSize: 11, color: theme.text.tertiary }}>空</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </button>
            <button type="button" onClick={() => setOverlay("equip")} style={{ ...btnGhost, textAlign: "left", padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontWeight: 800, fontSize: 13 }}>そうび</span>
                <span style={{ color: theme.text.tertiary }}>›</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {([
                  { id: mining.equipped.tool, label: "どうぐ" },
                  { id: mining.equipped.helmet, label: "あたま" },
                  { id: mining.equipped.chest, label: "むね" },
                  { id: mining.equipped.leggings, label: "あし" },
                  { id: mining.equipped.boots, label: "くつ" },
                ] as const).map((slot) => (
                  <div key={slot.label} style={{ textAlign: "center" }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      border: `1px ${slot.id ? "solid" : "dashed"} ${theme.stroke.tertiary}`,
                      background: theme.bg.editor,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }} title={slot.id ? gearLabel(slot.id) : "なし"}>
                      {slot.id ? <MiningItemIcon gear={slot.id} size={28} alt="" /> : (
                        <span style={{ fontSize: 12, color: theme.text.tertiary }}>?</span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: theme.text.tertiary, marginTop: 2 }}>{slot.label}</div>
                  </div>
                ))}
              </div>
            </button>
          </div>
        )}
      </div>
      </>
      )}

      {!blockingOverlay && tab === "mine" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={card}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>どこをほる？</div>
            {ironRoute && (
              <div className="mining-route-guide" style={{ marginBottom: 10 }}>
                <div className="mining-route-guide-title">おすすめルート</div>
                <div className="mining-route-guide-steps">
                  <button
                    type="button"
                    className="mining-route-guide-step"
                    onClick={() => chooseGacha("coal")}
                  >
                    ①せきたん
                  </button>
                  <span>→</span>
                  <button
                    type="button"
                    className="mining-route-guide-step"
                    onClick={() => setTab("craft")}
                  >
                    ②かまど
                  </button>
                  <span>→</span>
                  <button
                    type="button"
                    className="mining-route-guide-step"
                    onClick={() => chooseGacha("iron")}
                  >
                    ③てつ
                  </button>
                </div>
                <div className="mining-route-guide-note">きんはあとでOK</div>
              </div>
            )}
            <div className="mining-biome-grid">
              {GACHA_ORDER.filter((gid) => mining.unlockedGachas.includes(gid)).map((gid) => {
                const meta = GACHA_META[gid];
                const isLucky = lucky === gid;
                const selected = selectedGacha === gid;
                const hasOtherSelected = selectedGacha !== gid;
                return (
                  <button
                    key={gid}
                    type="button"
                    className={`mining-biome-card${selected ? " is-selected" : ""}${hasOtherSelected ? " is-dim" : ""}`}
                    onClick={() => chooseGacha(gid)}
                  >
                    <img className="mining-biome-card-img" src={DIG_BLOCK_IMAGE[gid]} alt="" draggable={false} />
                    <div className="mining-biome-card-shade" />
                    <div className="mining-biome-card-body">
                      <div className="mining-biome-card-title">{meta.emoji} {meta.label}</div>
                      {gid === "coal" && (
                        <div className="mining-biome-card-badge">石炭がとれる</div>
                      )}
                      {gid === "gold" && (
                        <div className="mining-biome-card-badge is-optional">あとでOK</div>
                      )}
                      {gid === "diamond" && (
                        <div className="mining-biome-card-badge">ダイヤのかけら</div>
                      )}
                      {isLucky && (
                        <div className="mining-biome-card-badge is-lucky">★こううん日</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            {GACHA_ORDER.some((gid) => !mining.unlockedGachas.includes(gid)) && (
              <div className="mining-biome-locked">
                <div style={{ fontSize: 11, fontWeight: 800, color: theme.text.tertiary }}>まだの場所</div>
                {GACHA_ORDER.filter((gid) => !mining.unlockedGachas.includes(gid)).map((gid) => {
                  const meta = GACHA_META[gid];
                  return (
                    <div key={gid} className="mining-biome-locked-card">
                      <img src={DIG_BLOCK_IMAGE[gid]} alt="" draggable={false} />
                      <div className="mining-biome-locked-shade" />
                      <div className="mining-biome-locked-body">
                        <span className="mining-biome-locked-title">🔒 {meta.label}</span>
                        <span className="mining-biome-locked-hint">{gachaLockHint(gid)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={card}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>つかうどうぐの種類</div>
            <div style={{ fontSize: 12, color: theme.text.secondary, marginBottom: 8, lineHeight: 1.5 }}>
              種類を選ぶと、いちばん強いのを使うよ
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
                      borderColor: selected ? theme.accent.primary : theme.stroke.secondary,
                      backgroundColor: selected ? `${theme.accent.primary}18` : theme.fill.secondary,
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
                        <span style={{ color: theme.accent.primary, fontWeight: 800 }}>つかう</span>
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
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ display: "flex", gap: 3 }}>
                    {[1, 2, 3].map((n) => (
                      <span
                        key={n}
                        style={{
                          width: 10,
                          height: 14,
                          borderRadius: 3,
                          backgroundColor: n <= strength.pips ? strength.color : theme.stroke.tertiary,
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: strength.color }}>
                    {strength.label} {boostDetailOpen ? "▲" : "▼"}
                  </div>
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
              <div style={{ fontWeight: 900, marginBottom: 8 }}>さいごにほった結果</div>
              <div className="mining-dig-slot-row" style={{ marginBottom: 8 }}>
                {lastDig.drops.map((d) => (
                  <div key={d.material} className="mining-dig-slot-wrap">
                    <MiningSlot material={d.material} amount={d.amount} size={48} />
                    <span className="mining-dig-slot-label">{MATERIAL_META[d.material].label}</span>
                  </div>
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
            <div style={{ fontSize: 13, lineHeight: 1.5, color: theme.text.secondary }}>
              ここで強いどうぐ・ぼうぐをつけるよ
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
                      showToast(`${gearLabel(best)} をそうびした！`);
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
                        {equipped && <span style={{ marginLeft: 8, color: theme.category.green }}>そうび中</span>}
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
            <div style={{ fontWeight: 800, marginBottom: 4 }}>ぼうぐ（かぶる・きるもの）</div>
            <div style={{ fontSize: 12, color: theme.text.secondary, marginBottom: 10, lineHeight: 1.45 }}>
              鉄からつくれるよ。部位ごとに1つそうびできるよ。
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {armorSlots.map((slot) => {
                const owned = ownedArmorForSlot(mining, slot);
                const current = mining.equipped[slot];
                return (
                  <div
                    key={slot}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      border: `1px solid ${theme.stroke.tertiary}`,
                      backgroundColor: theme.fill.quaternary,
                    }}
                  >
                    <div style={{ fontWeight: 800, marginBottom: 2, fontSize: 15 }}>{ARMOR_KIND_LABEL[slot]}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: theme.text.primary, marginBottom: 4, lineHeight: 1.4 }}>
                      {ARMOR_EFFECT_SHORT[slot]}
                    </div>
                    <button
                      type="button"
                      onClick={() => setArmorDetailOpen((prev) => ({ ...prev, [slot]: !prev[slot] }))}
                      style={{
                        border: "none",
                        background: "transparent",
                        padding: 0,
                        marginBottom: 8,
                        fontSize: 11,
                        fontWeight: 800,
                        color: theme.text.tertiary,
                        cursor: "pointer",
                      }}
                    >
                      {armorDetailOpen[slot] ? "▲ くわしく" : "▼ くわしく"}
                    </button>
                    {armorDetailOpen[slot] && (
                      <div style={{ fontSize: 12, fontWeight: 700, color: theme.text.secondary, marginBottom: 8, lineHeight: 1.45 }}>
                        {ARMOR_EFFECT_BLURB[slot]}
                      </div>
                    )}
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
                              showToast(`${gearLabel(id)} をそうびした！`);
                            }}
                            style={{
                              ...btnGhost,
                              borderColor: current === id ? theme.category.green : theme.stroke.secondary,
                              backgroundColor: current === id ? `${theme.category.green}18` : theme.bg.editor,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <MiningItemIcon gear={id} size={22} alt="" />
                            {gearLabel(id)}
                            {current === id && (
                              <span style={{ color: theme.category.green, fontWeight: 800 }}>そうび中</span>
                            )}
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
          </div>

          <div style={{ fontSize: 12, color: theme.text.secondary, lineHeight: 1.5, padding: "0 4px" }}>
            くわしいつよさは「ほる」タブで見れるよ
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
          {(() => {
            const annotated = recipes.map((recipe) => {
              const upgradeFrom = recipe.craftFlag ? NETHERITE_UPGRADE_REQUIRES[recipe.craftFlag] : undefined;
              const hasUpgradeBase = !upgradeFrom || !!mining.crafted[upgradeFrom];
              const bedFull = !!(recipe.grantsBed && slots >= MAX_BEDS);
              const owned = !!(recipe.craftFlag && mining.crafted[recipe.craftFlag]) || bedFull;
              const ok =
                canAffordRecipe(recipe.costs, have, recipe.fuelOptions)
                && hasUpgradeBase
                && !owned
                && (!recipe.needsWorkbench || hasWorkbench(mining))
                && (!recipe.needsFurnace || hasFurnace(mining));
              return { recipe, upgradeFrom, hasUpgradeBase, bedFull, owned, ok };
            });
            const byId = new Map(annotated.map((a) => [a.recipe.id, a]));
            const recommendOrder = recommendedCraftRecipeIds(mining);
            const recommended = recommendOrder
              .map((id) => byId.get(id))
              .filter((a): a is typeof annotated[number] => !!a && !a.owned);
            const ready = annotated.filter((a) => a.ok);
            const recommendedIds = new Set(recommended.map((a) => a.recipe.id));
            const readyIds = new Set(ready.map((a) => a.recipe.id));
            const rest = annotated.filter((a) => !readyIds.has(a.recipe.id) && !recommendedIds.has(a.recipe.id));
            const shownRest = craftShowAll ? rest : rest.slice(0, 4);

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
              return (
                <div key={recipe.id} style={card}>
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
                              <MiningSlot material={recipe.outputs[0].material} amount={recipe.outputs[0].amount} size={44} />
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
                              石炭は「せきたんのやま」でほれるよ
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
                                    </span>
                                    <span style={{ fontSize: 11, color: theme.text.secondary }}>{h}個</span>
                                    {using && <span style={{ color: theme.accent.primary, fontWeight: 900 }}>選択中</span>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!ok || owned || !!smeltingId}
                      onClick={() => onCraft(recipe)}
                      style={{
                        ...btnPrimary,
                        opacity: ok && !owned && !smeltingId ? 1 : 0.4,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {smeltingId === recipe.id ? "せいれん中" : isSmelt ? "せいれん" : "つくる"}
                    </button>
                  </div>
                </div>
              );
            };

            return (
              <>
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
            }}>
              「{GACHA_META[selectedGacha].label}」向き・人数多め・高Lvほど、素材がふえやすい
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
            <div style={{ fontWeight: 800, marginBottom: 8 }}>とくいの場所</div>
            <div style={{ fontSize: 12, color: theme.text.secondary, marginBottom: 8, lineHeight: 1.5 }}>
              タップすると、そのなかまだけ見えるよ
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
              <div style={{ fontSize: 12, fontWeight: 800, color: theme.text.secondary, marginBottom: 8, lineHeight: 1.45 }}>
                空いている枠に、Lvの高いなかまを入れよう
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
                        if (!stickerAlbum.includes(item.id)) return;
                        onChange(setPartySlot(mining, partySlotEdit, item.id));
                        showToast(`${item.label} Lv${lv} を入れた！`);
                        setPartySlotEdit(null);
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
            <div style={{ fontWeight: 800, marginBottom: 4 }}>こうかん所</div>
            <div style={{ fontSize: 12, color: theme.text.secondary, marginBottom: 8, lineHeight: 1.5 }}>
              こうかん⭐と素材を、おたがいにかえられるよ
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                style={btnGhost}
                onClick={() => {
                  const r = exchangeQuartzForPoints(mining);
                  if (r.error) showToast(r.error);
                  else { onChange(r.state); showToast(`ネザークォーツをこうかん⭐${QUARTZ_TO_POINTS}にかえした！`); }
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <MiningItemIcon material="nether_quartz" size={18} alt="" />
                  クォーツ1 → こうかん⭐{QUARTZ_TO_POINTS}
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
                原木1（こうかん⭐{exchangeCost(EXCHANGE_LOG_COST, mining)}）
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
                丸石1（こうかん⭐{exchangeCost(8, mining)}）
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
                  羊毛1（こうかん⭐{exchangeCost(EXCHANGE_WOOL_COST, mining)}）
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
                  残骸1（こうかん⭐{exchangeCost(EXCHANGE_DEBRIS_COST, mining)}）
                </span>
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: theme.text.tertiary, lineHeight: 1.45 }}>
              ネザーでは白い石がよく出るよ。ほしいものは⭐でかえられるよ
              {netheriteFullComplete(mining) && (
                <span style={{ display: "block", marginTop: 4, color: theme.category.green, fontWeight: 800 }}>
                  ネザライトそろい：残骸が出やすいよ
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

      {!blockingOverlay && tab === "mine" && (
        <div
          className="mining-dig-cta-bar"
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 35,
            boxSizing: "border-box",
            /* 右はハンバーガー分あける。下はバー自体を画面端まで伸ばし、余白は内側 padding */
            padding: "10px 72px max(10px, env(safe-area-inset-bottom, 0px)) 16px",
            backgroundColor: theme.bg.editor,
            boxShadow: "0 -10px 18px -14px rgba(0,0,0,0.28)",
          }}
        >
          <button
            type="button"
            className={digSheetReady ? "mining-dig-cta is-ready" : "mining-dig-cta"}
            onClick={() => {
              if (mining.tickets < 1) { onBack(); return; }
              if (digBusy) return;
              setOverlay("digDestination");
            }}
            disabled={digBusy}
            style={{
              ...btnPrimary,
              width: "100%",
              fontSize: 16,
              padding: "14px 16px",
              opacity: digBusy ? 0.55 : 1,
              cursor: digBusy ? "not-allowed" : "pointer",
              /* undefined だとブラウザ既定のグレーに見えることがあるので、常に色を明示する */
              backgroundColor: digNeedsTickets
                ? theme.category.orange
                : digSheetReady
                  ? theme.accent.primary
                  : theme.fill.secondary,
              color: digNeedsTickets || digSheetReady ? "#fff" : theme.text.tertiary,
              boxShadow: digSheetReady ? "0 4px 16px rgba(91, 142, 255, 0.55)" : "none",
              border: digSheetReady ? "none" : `1.5px solid ${theme.stroke.secondary}`,
            }}
          >
            {mining.tickets < 1
              ? "🎫をもらおう（タスクにもどる）"
              : `${selectedMeta.emoji} ${selectedMeta.label}をほる · 🎫${mining.tickets}`}
          </button>
        </div>
      )}

      {overlay === "digDestination" && (
        <div
          className="mining-dig-dest-backdrop"
          onClick={() => setOverlay(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOverlay(null);
          }}
          role="presentation"
        >
          <div
            className="mining-dig-dest-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="どこをほる？"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mining-dig-dest-handle" aria-hidden />
            <div className="mining-dig-dest-head">
              <div className="mining-dig-dest-title">どこをほる？</div>
              <button
                type="button"
                className="mining-dig-dest-close"
                onClick={() => setOverlay(null)}
                aria-label="とじる"
              >
                ×
              </button>
            </div>
            {ironRoute && (
              <div className="mining-dig-dest-hint">おすすめ: せきたん → かまど → てつ</div>
            )}
            <div className="mining-biome-grid">
              {GACHA_ORDER.filter((gid) => mining.unlockedGachas.includes(gid)).map((gid) => {
                const meta = GACHA_META[gid];
                const isLucky = lucky === gid;
                const selected = selectedGacha === gid;
                const hasOtherSelected = selectedGacha !== gid;
                return (
                  <button
                    key={gid}
                    type="button"
                    className={`mining-biome-card${selected ? " is-selected" : ""}${hasOtherSelected ? " is-dim" : ""}`}
                    onClick={() => digAt(gid)}
                  >
                    <img className="mining-biome-card-img" src={DIG_BLOCK_IMAGE[gid]} alt="" draggable={false} />
                    <div className="mining-biome-card-shade" />
                    <div className="mining-biome-card-body">
                      <div className="mining-biome-card-title">{meta.emoji} {meta.label}</div>
                      {gid === "coal" && (
                        <div className="mining-biome-card-badge">石炭がとれる</div>
                      )}
                      {gid === "gold" && (
                        <div className="mining-biome-card-badge is-optional">あとでOK</div>
                      )}
                      {gid === "diamond" && (
                        <div className="mining-biome-card-badge">ダイヤのかけら</div>
                      )}
                      {isLucky && (
                        <div className="mining-biome-card-badge is-lucky">★こううん日</div>
                      )}
                      {selected && (
                        <div className="mining-biome-card-badge">いまここ · タップでほる</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
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
        canDigAgain={
          digFx === "reveal"
          && mining.tickets >= 1
          && mining.unlockedGachas.includes(selectedGacha)
        }
        onCrackTap={onCrackTap}
        onDigAgain={digAgainFromFx}
        onClose={closeDigFx}
      />

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
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
