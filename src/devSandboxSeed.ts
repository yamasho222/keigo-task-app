import type { BuddyProgressMap } from "./buddyProgress";
import { ALL_REWARDS } from "./stickerRewards";
import {
  type MaterialId,
  type MiningState,
} from "./miningTypes";

const DEV_TICKETS = 99;
const DEV_MINING_POINTS = 999;
const DEV_DUPLICATE_TOKENS = 999;
const DEV_BUDDY_LEVEL = 10;

const DEV_MATERIALS: Record<MaterialId, number> = {
  log: 99,
  plank: 99,
  stick: 99,
  wool: 99,
  cobble: 99,
  iron_ore: 99,
  iron_ingot: 99,
  gold_ore: 99,
  gold_ingot: 99,
  coal: 99,
  diamond_shard: 99,
  diamond: 99,
  ancient_debris: 99,
  netherite_scrap: 99,
  netherite_ingot: 99,
};

/** 開発用: 全シールを所持扱いにしてカテゴリ絞り込みで全部選べるようにする */
const DEV_STICKER_IDS = ALL_REWARDS
  .filter((reward) => reward.kind === "sticker")
  .map((reward) => reward.id);

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

/** 既存データは減らさず、体験に必要な最低量まで補充する。 */
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
      crafted: {
        ...mining.crafted,
        workbench: true,
        furnace: true,
        sword_wood: true,
        axe_wood: true,
        pickaxe_wood: true,
        sword_stone: true,
        axe_stone: true,
        pickaxe_stone: true,
        sword_iron: true,
        axe_iron: true,
        pickaxe_iron: true,
        helmet_iron: true,
        chest_iron: true,
        leggings_iron: true,
        boots_iron: true,
        sword_diamond: true,
        axe_diamond: true,
        pickaxe_diamond: true,
        helmet_diamond: true,
        chest_diamond: true,
        leggings_diamond: true,
        boots_diamond: true,
      },
      unlockedGachas: [
        ...new Set([
          ...mining.unlockedGachas,
          "wood",
          "stone",
          "iron",
          "gold",
          "diamond",
          "nether",
        ] as const),
      ],
      partyIds,
      equipped: {
        ...mining.equipped,
        tool: mining.equipped.tool ?? "pickaxe_diamond",
        helmet: mining.equipped.helmet ?? "helmet_diamond",
        chest: mining.equipped.chest ?? "chest_diamond",
        leggings: mining.equipped.leggings ?? "leggings_diamond",
        boots: mining.equipped.boots ?? "boots_diamond",
      },
    },
  };
}
