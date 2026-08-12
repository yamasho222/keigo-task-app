import type { BuddyProgressMap } from "./buddyProgress";
import { ALL_REWARDS } from "./stickerRewards";
import {
  emptyMiningState,
  type CraftedGearId,
  type MaterialId,
  type MiningState,
} from "./miningTypes";

/** 開発・体験用の余裕ある初期量（自分で触って試せる量） */
const DEV_TICKETS = 200;
const DEV_MINING_POINTS = 5000;
const DEV_DUPLICATE_TOKENS = 999;
const DEV_BUDDY_LEVEL = 10;
const DEV_MATERIAL_AMOUNT = 200;

const DEV_MATERIALS: Record<MaterialId, number> = {
  log: DEV_MATERIAL_AMOUNT,
  plank: DEV_MATERIAL_AMOUNT,
  stick: DEV_MATERIAL_AMOUNT,
  wool: DEV_MATERIAL_AMOUNT,
  cobble: DEV_MATERIAL_AMOUNT,
  iron_ore: DEV_MATERIAL_AMOUNT,
  iron_ingot: DEV_MATERIAL_AMOUNT,
  gold_ore: DEV_MATERIAL_AMOUNT,
  gold_ingot: DEV_MATERIAL_AMOUNT,
  coal: DEV_MATERIAL_AMOUNT,
  diamond_shard: DEV_MATERIAL_AMOUNT,
  diamond: DEV_MATERIAL_AMOUNT,
  ancient_debris: DEV_MATERIAL_AMOUNT,
  nether_quartz: DEV_MATERIAL_AMOUNT,
  netherite_scrap: DEV_MATERIAL_AMOUNT,
  netherite_ingot: DEV_MATERIAL_AMOUNT,
  sugar_cane: DEV_MATERIAL_AMOUNT,
  paper: DEV_MATERIAL_AMOUNT,
  leather: DEV_MATERIAL_AMOUNT,
  water: DEV_MATERIAL_AMOUNT,
  lava: DEV_MATERIAL_AMOUNT,
  obsidian: DEV_MATERIAL_AMOUNT,
  lapis: DEV_MATERIAL_AMOUNT,
  book: DEV_MATERIAL_AMOUNT,
};

const DEV_CRAFTED: CraftedGearId[] = [
  "workbench",
  "furnace",
  "sword_wood",
  "axe_wood",
  "pickaxe_wood",
  "sword_stone",
  "axe_stone",
  "pickaxe_stone",
  "sword_iron",
  "axe_iron",
  "pickaxe_iron",
  "helmet_iron",
  "chest_iron",
  "leggings_iron",
  "boots_iron",
  "sword_gold",
  "axe_gold",
  "pickaxe_gold",
  "helmet_gold",
  "chest_gold",
  "leggings_gold",
  "boots_gold",
  "sword_diamond",
  "axe_diamond",
  "pickaxe_diamond",
  "helmet_diamond",
  "chest_diamond",
  "leggings_diamond",
  "boots_diamond",
  "sword_netherite",
  "axe_netherite",
  "pickaxe_netherite",
  "helmet_netherite",
  "chest_netherite",
  "leggings_netherite",
  "boots_netherite",
];

/** 開発用: 全シールを所持扱いにしてカテゴリ絞り込みで全部選べるようにする */
const DEV_STICKER_IDS = ALL_REWARDS.map((reward) => reward.id);

function firstRewardId(category: string): string | null {
  return ALL_REWARDS.find((reward) => reward.category === category)?.id ?? null;
}

const DEV_PARTY_IDS = [
  firstRewardId("pokemon"),
  firstRewardId("minecraft"),
  firstRewardId("brainrot"),
];

export function isDevSandboxEmpty(
  mining: MiningState,
  duplicateTokens: number,
): boolean {
  const hasMaterials = Object.values(mining.materials).some(
    (amount) => Number(amount) > 0,
  );
  return (
    mining.tickets <= 0
    && mining.miningPoints <= 0
    && duplicateTokens <= 0
    && !hasMaterials
  );
}

interface BuildDevSandboxSeedInput {
  mining: MiningState;
  duplicateTokens: number;
  stickerAlbum: string[];
  buddyProgress: BuddyProgressMap;
  buddyId: string | null;
}

export interface DevSandboxSeed {
  mining: MiningState;
  duplicateTokens: number;
  stickerAlbum: string[];
  buddyProgress: BuddyProgressMap;
  buddyId: string | null;
}

/** チケット／こうかん⭐だけ十分。素材・クラフト・装備は空（序盤から掘り直し用） */
export function buildDevTicketsOnlySeed(mining: MiningState): MiningState {
  const blank = emptyMiningState();
  return {
    ...mining,
    tickets: Math.max(mining.tickets, DEV_TICKETS),
    miningPoints: Math.max(mining.miningPoints, DEV_MINING_POINTS),
    materials: {},
    crafted: {},
    unlockedGachas: ["wood"],
    bedCount: 1,
    partyIds: [null, null, null],
    equipped: { ...blank.equipped },
  };
}

/** 素材・装備は触らず、チケット／こうかん⭐だけ足りなければ補充 */
export function topUpDevTicketsPoints(mining: MiningState): MiningState {
  return {
    ...mining,
    tickets: Math.max(mining.tickets, DEV_TICKETS),
    miningPoints: Math.max(mining.miningPoints, DEV_MINING_POINTS),
  };
}

/** 既存データは減らさず、体験に必要な量まで補充する。 */
export function buildDevSandboxSeed({
  mining,
  duplicateTokens,
  stickerAlbum,
  buddyProgress,
  buddyId,
}: BuildDevSandboxSeedInput): DevSandboxSeed {
  const materials = { ...mining.materials };
  for (const [id, amount] of Object.entries(DEV_MATERIALS)) {
    const materialId = id as MaterialId;
    materials[materialId] = Math.max(materials[materialId] ?? 0, amount);
  }

  const crafted = { ...mining.crafted };
  for (const id of DEV_CRAFTED) {
    crafted[id] = true;
  }

  const seededAlbum = [...new Set([...stickerAlbum, ...DEV_STICKER_IDS])];
  const seededProgress: BuddyProgressMap = { ...buddyProgress };
  for (const id of DEV_STICKER_IDS) {
    const current = seededProgress[id];
    if (!current || current.level < DEV_BUDDY_LEVEL) {
      seededProgress[id] = { level: DEV_BUDDY_LEVEL, xp: 0 };
    }
  }

  const partyIds = [...mining.partyIds];
  for (let index = 0; index < 3; index += 1) {
    if (!partyIds[index]) partyIds[index] = DEV_PARTY_IDS[index];
  }

  return {
    duplicateTokens: Math.max(duplicateTokens, DEV_DUPLICATE_TOKENS),
    stickerAlbum: seededAlbum,
    buddyProgress: seededProgress,
    buddyId: buddyId ?? DEV_PARTY_IDS[0] ?? seededAlbum[0] ?? null,
    mining: {
      ...mining,
      tickets: Math.max(mining.tickets, DEV_TICKETS),
      miningPoints: Math.max(mining.miningPoints, DEV_MINING_POINTS),
      materials,
      bedCount: Math.max(mining.bedCount ?? 1, 3),
      crafted,
      unlockedGachas: [
        ...new Set([
          ...mining.unlockedGachas,
          "wood",
          "stone",
          "iron",
          "coal",
          "gold",
          "diamond",
          "nether",
        ] as const),
      ],
      partyIds,
      equipped: {
        ...mining.equipped,
        tool: mining.equipped.tool ?? "pickaxe_netherite",
        helmet: mining.equipped.helmet ?? "helmet_netherite",
        chest: mining.equipped.chest ?? "chest_netherite",
        leggings: mining.equipped.leggings ?? "leggings_netherite",
        boots: mining.equipped.boots ?? "boots_netherite",
      },
    },
  };
}
