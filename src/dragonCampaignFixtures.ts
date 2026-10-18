/** Explicit DEV-only shortcuts; never imported by the real application. */
import { createDragonCampaign, type DragonCampaign } from './dragonCampaignEngine';
import { defaultEquipment, defaultSupplies, fullArmor, maxHp } from './campaignEquipment';
import { enableDragonAdventure } from './dragonCampaignAdventure';

export type DragonFixture = 'start' | 'inner' | 'wings' | 'wingUltimate' | 'orb' | 'rage' | 'ultimate' | 'victory' | 'lost';
export function dragonCampaignFixture(kind: DragonFixture, day: string, adventure = false): DragonCampaign {
  const eq = defaultEquipment(), supplies = defaultSupplies();
  supplies.materials = { ...supplies.materials, bread: 8, spare_bed: 3, wheat: 30, plank: 60, wool: 18, lapis_lazuli: 60, book: 4, quartz: 24, diamond: 24, netherite_ingot: 8, iron_ingot: 24, obsidian: 4, sugar_cane: 12, paper: 6, leather: 4 };
  supplies.hasTable = true;
  for (const tier of ['gold', 'iron', 'diamond', 'netherite']) {
    for (const slot of ['helmet', 'chest', 'leggings', 'boots']) supplies.owned[`armor_${slot}_${tier}`] = true;
  }
  supplies.owned.sword_netherite = true; supplies.owned.shield = true;
  const original = createDragonCampaign(day, { equipment: eq, supplies, id: `dragon-lab-${kind}-${Date.now()}` });
  const s = adventure ? enableDragonAdventure(original) : original;
  if (kind === 'start') return s;
  s.status = 'battle';
  if (kind === 'inner') { s.crystals = [0, 0, 0, 0, 28, 28, 28, 28]; s.selected = 'crystal:4'; s.intentIndex = 2; return s; }
  s.crystals.fill(0); s.finalEntryHp = 1200; s.phase = 'wings';
  if (kind === 'wings' || kind === 'wingUltimate') { s.selected = 'wing:0'; if (kind === 'wingUltimate') s.gauge = 3; return s; }
  s.wings = [0, 0]; s.phase = 'orb'; s.bodyHp = 800; s.checkpointHp = 800;
  if (kind === 'orb') { s.orbHp = 8; s.orbTurns = 2; s.selected = 'orb'; return s; }
  s.phase = 'rage'; s.bodyHp = 400; s.checkpointHp = 400; s.intentIndex = 2;
  if (kind === 'ultimate') { s.gauge = 3; s.landingTurns = 2; s.equipment.attack = { kind: 'ultimate', rank: 3 }; }
  if (kind === 'victory') { s.bodyHp = 4; s.checkpointHp = 60; s.intentIndex = 3; }
  if (kind === 'lost') { s.hp = 0; s.status = 'lost'; }
  return s;
}
/** DEV control only: does not change date, supplies, enemy, intent or prepaid actions. */
export function recoverDragonTestHp(state: DragonCampaign): DragonCampaign {
  if (state.status === 'won' || state.hp === maxHp(state.equipment) && state.status !== 'lost') return state;
  return { ...state, hp: maxHp(state.equipment), status: state.status === 'lost' ? 'paused' : state.status,
    revision: state.revision + 1, log: [...state.log, '試験用：自分のHPだけ全回復。'].slice(-12) };
}
export function dragonArmorFixture(s: DragonCampaign, tier: 'iron' | 'diamond' | 'netherite'): DragonCampaign {
  const next = structuredClone(s); next.equipment.armor = fullArmor(tier);
  if (tier === 'netherite') next.equipment.sword = 'netherite';
  for (const slot of ['helmet', 'chest', 'leggings', 'boots']) next.supplies.owned[`armor_${slot}_${tier}`] = true;
  next.supplies.owned[`sword_${next.equipment.sword}`] = true;
  next.hp = maxHp(next.equipment); next.revision++;
  return next;
}
