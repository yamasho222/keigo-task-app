/** Profile-owned authoritative transactions. No localStorage, fixtures, free resources or UI. */
import type { BuddyProgressMap } from './buddyProgress';
import { getBuddyEntry } from './buddyProgress';
import { actOnBlaze, createBlazeRun, type BlazeAction, type BlazeLoadout } from './blazePrototypeEngine';
import { actOnEnderman, createEndermanRun, type EndermanAction } from './endermanPrototypeEngine';
import { createDragonCampaign, stepDragonCampaign, crystalMaxHp, validCampaignDay, type CampaignAction, type CampaignOutcome } from './dragonCampaignEngine';
import { REWARD_LOOKUP } from './stickerRewards';
import { enableDragonAdventure } from './dragonCampaignAdventure';
import { enableDragonSkills } from './dragonSkillRules';
import { enableDragonCritical } from './dragonCriticalRules';
import { enableBattleSkills, unlockedBattleSkills } from './battleSkillRules';
import { maxHp, upgradeCampaign, type CampaignEquipment, type CampaignSupplies } from './campaignEquipment';
import { readAdventure, type AdventureState, type AdventureLocation } from './adventureState';
import { refreshUnlocks } from './miningProgress';
import { getMaterialCount, type MiningState } from './miningTypes';

export const PRODUCTION_DRAGON_HP = 2700;
export type AdventureCommand = { revision: number; day: string; location: AdventureLocation } & (
  | { kind: 'enter' | 'retry' | 'next' | 'lesson' }
  | { kind: 'blaze'; action: BlazeAction }
  | { kind: 'enderman'; action: EndermanAction }
  | { kind: 'dragon'; action: CampaignAction }
  | { kind: 'magic'; category: 'attack' | 'defense'; value: string }
  | { kind: 'upgrade'; category: 'attack' | 'defense' }
);
export type AdventureResult = { state: MiningState; error?: string; outcome?: ReturnType<typeof actOnBlaze> | ReturnType<typeof actOnEnderman> | CampaignOutcome };
export function adventureEquipment(mining: MiningState, buddies: BuddyProgressMap = {}): CampaignEquipment {
  const tiers = ['netherite', 'diamond', 'iron', 'stone', 'gold', 'wood'] as const;
  const sword = tiers.find(tier => mining.crafted[`sword_${tier}`]) ?? 'none';
  const armor = Object.fromEntries((['helmet', 'chest', 'leggings', 'boots'] as const).map(slot => {
    const id = mining.equipped[slot];
    const match = id && mining.crafted[id] ? /_(iron|gold|diamond|netherite)$/.exec(id) : null;
    return [slot === 'chest' ? 'chest' : slot, match?.[1] ?? 'none'];
  })) as CampaignEquipment['armor'];
  return { sword, armor, shield: mining.equipped.held === 'shield' && getMaterialCount(mining, 'shield') > 0,
    attack: mining.adventure?.attack ?? { kind: 'none', rank: 0 }, defense: mining.adventure?.defense ?? { kind: 'none', rank: 0 },
    buddies: [...new Set(mining.partyIds.slice(0, mining.bedCount).filter((id): id is string => !!id))].slice(0, 3)
      .filter(id => !!REWARD_LOOKUP[id])
      .map(id => ({ id, image: REWARD_LOOKUP[id].image, level: getBuddyEntry(buddies, id).level })) };
}
export function adventureSupplies(mining: MiningState): CampaignSupplies {
  const materials = { ...mining.materials, lapis_lazuli: mining.materials.lapis ?? 0, quartz: mining.materials.nether_quartz ?? 0 };
  return { materials, partySlots: mining.bedCount, hasTable: !!mining.crafted.enchanting_table,
    owned: { ...mining.crafted, shield: (mining.materials.shield ?? 0) > 0 } } as CampaignSupplies;
}
function nextHeldItem(mining: MiningState): 'none' | 'shield' | 'water' {
  const item = mining.equipped.held;
  return (item === 'shield' || item === 'water') && (mining.materials[item] ?? 0) > 0 ? item : 'none';
}
export function ensureAdventure(mining: MiningState, day: string): MiningState {
  if (!validCampaignDay(day)) throw new Error('Invalid adventure day');
  const current = readAdventure(mining.adventure);
  if (current) {
    if (day <= current.day || [current.dragon, current.blaze, current.enderman].some(run => run?.skills?.pending)) return mining;
    return { ...mining, adventure: { ...current, day, hp: maxHp(adventureEquipment(mining)), foodToday: 0, fallen: false, revision: current.revision + 1 } };
  }
  const hp = mining.playerHpDate && mining.playerHpDate < day ? 20 : Math.min(20, mining.playerHp ?? 20);
  const legacyHand = Object.values(mining.combatProgress ?? {}).some(progress => progress?.attackStep === 1 || progress?.freeFirstAttack) ? 1 : 0;
  return { ...mining, adventure: { version: 1, revision: 0, day, hp, hands: hp > 0 ? legacyHand : 0, gauge: Math.min(3, mining.specialGauge ?? 0),
    foodToday: 0, fallen: hp === 0, seed: 10617, endermanDefeats: 0, lessons: {}, attack: { kind: 'none', rank: 0 }, defense: { kind: 'none', rank: 0 } } };
}
function hydrate(mining: MiningState, s: AdventureState, location: AdventureLocation, buddies: BuddyProgressMap) {
  const eq = adventureEquipment({ ...mining, adventure: s }, buddies), supplies = adventureSupplies(mining);
  const loadout: BlazeLoadout = { sword: eq.sword, armor: eq.armor, magic: { attack: eq.attack, defense: eq.defense } };
  const bread = Math.min(supplies.materials.bread ?? 0, 2 - s.foodToday), hp = Math.min(s.hp, maxHp(eq));
  const common = { hp, maxHp: maxHp(eq), tickets: mining.tickets, handsLeft: s.hands, gauge: s.gauge, bread, loadout };
  const unlocked = unlockedBattleSkills(mining.unlockedGachas);
  const critical = s.critical ?? s.dragon?.critical ?? s.blaze?.critical ?? s.enderman?.critical ?? { version: 1 as const, seed: (s.seed ^ 0x9e3779b9) >>> 0 };
  if (location === 'fortress') {
    const run = structuredClone(s.blaze?.phase === 'lost' && !s.fallen ? createBlazeRun({ loadout }) : s.blaze ?? createBlazeRun({ loadout }));
    if (!s.blaze && mining.combatEncounters?.fortress?.mobs.some(mob => mob.hp > 0)) {
      const old = mining.combatEncounters.fortress.mobs;
      run.enemies[0].hp = Math.max(1, Math.min(run.enemies[0].maxHp, Math.ceil(run.enemies[0].maxHp * old.reduce((sum, mob) => sum + Math.max(0, mob.hp), 0) / (old.length * 20))));
    }
    return { kind: 'blaze' as const, run: enableBattleSkills({ ...run, ...common, critical, ...(s.fallen ? { phase: 'lost' as const } : {}), item: eq.shield ? 'shield' as const : 'none' as const }, unlocked) };
  }
  if (location === 'warped_forest') {
    const item = mining.equipped.held === 'water' && (mining.materials.water ?? 0) > 0 ? 'water' as const : eq.shield ? 'shield' as const : 'none' as const;
    const run = structuredClone(s.enderman?.phase === 'lost' && !s.fallen ? createEndermanRun({ loadout, item }) : s.enderman ?? createEndermanRun({ loadout, item }));
    if (!s.enderman && mining.combatEncounters?.warped_forest?.mobs.some(mob => mob.hp > 0)) {
      const old = mining.combatEncounters.warped_forest.mobs;
      run.enemyHp = Math.max(1, Math.min(run.enemyMaxHp, Math.ceil(run.enemyMaxHp * old.reduce((sum, mob) => sum + Math.max(0, mob.hp), 0) / (old.length * 40))));
    }
    return { kind: 'enderman' as const, run: enableBattleSkills({ ...run, ...common, critical, ...(s.fallen ? { phase: 'lost' as const } : {}), item }, unlocked) };
  }
  let run = s.dragon;
  if (!run) {
    run = enableDragonCritical(enableDragonSkills(enableDragonAdventure(createDragonCampaign(s.day, { equipment: eq, supplies, tickets: mining.tickets }))));
    run.bodyMaxHp = PRODUCTION_DRAGON_HP; run.bodyHp = PRODUCTION_DRAGON_HP; run.checkpointHp = PRODUCTION_DRAGON_HP;
    const old = mining.dragonFight;
    if (old) {
      run.crystals = run.crystals.map((_, i) => Math.ceil(crystalMaxHp(i) * Math.min(16, old.crystals[i] ?? 16) / 16));
      // Preserve the remaining proportion and already-completed crystal phase; never grant a second trophy.
      run.bodyHp = Math.max(1, Math.ceil(PRODUCTION_DRAGON_HP * Math.min(2000, old.hp) / 2000)); run.checkpointHp = run.bodyHp;
      if (run.crystals.every(value => value === 0)) { run.phase = 'wings'; run.finalEntryHp = Math.max(1, run.bodyHp); }
      if (old.defeated || mining.crafted.elytra) { run.status = 'won'; run.bodyHp = 0; run.checkpointHp = 0; run.rewardClaimed = true; }
    }
  }
  return { kind: 'dragon' as const, run: { ...structuredClone(run), unlockedSkills: unlocked, critical, heldItem: nextHeldItem(mining), equipment: eq, supplies, hp, tickets: mining.tickets,
    hands: s.hands, gauge: s.gauge, foodToday: s.foodToday, day: s.day } };
}
export function projectAdventure(mining: MiningState, location: AdventureLocation, buddies: BuddyProgressMap = {}) {
  return hydrate(mining, mining.adventure!, location, buddies);
}
export function transitionAdventure(input: MiningState, command: AdventureCommand, buddies: BuddyProgressMap = {}): AdventureResult {
  const reject = (error: string): AdventureResult => ({ state: input, error });
  if (!validCampaignDay(command.day)) return reject('日付を確認してください。');
  if (command.revision !== (input.adventure?.revision ?? -1)) return reject('別の操作で記録が変わりました。読み直してね。');
  if (!input.unlockedGachas.includes(command.location)) return reject('まだ いけない ばしょだよ。');
  if (command.kind === 'blaze' && command.location !== 'fortress' || command.kind === 'enderman' && command.location !== 'warped_forest' || command.kind === 'dragon' && command.location !== 'the_end') return reject('たたかう ばしょを たしかめよう。');
  let mining: MiningState;
  try { mining = ensureAdventure(input, command.day); } catch { return reject('記録を上書きせず停止しました。更新を確認してください。'); }
  const s = structuredClone(mining.adventure!);
  const pendingLocation = s.dragon?.skills?.pending ? 'dragon' : s.blaze?.skills?.pending ? 'blaze' : s.enderman?.skills?.pending ? 'enderman' : null;
  if (pendingLocation && !(command.kind === pendingLocation && 'action' in command && ['releaseSkill', 'chooseSkill', 'cancelSkill'].includes(command.action.kind))) return reject('ひっさつを はなってから つづけよう。');
  let next = { ...mining, materials: { ...mining.materials }, crafted: { ...mining.crafted } };
  const save = (): AdventureResult => {
    s.fallen = s.hp === 0; s.revision = (input.adventure?.revision ?? -1) + 1;
    // Cached battle projections must show the authoritative shared resources,
    // including prepaid actions retained after victory and returning.
    const hasSession = command.location === 'fortress' ? !!s.blaze : command.location === 'warped_forest' ? !!s.enderman : !!s.dragon;
    if (hasSession) {
      const view = hydrate({ ...next, adventure: s }, s, command.location, buddies);
      if (view.kind === 'blaze') s.blaze = view.run;
      else if (view.kind === 'enderman') s.enderman = view.run;
      else s.dragon = view.run;
      if (outcome) outcome = { ...outcome, state: view.run } as AdventureResult['outcome'];
    }
    next = { ...next, adventure: s, playerHp: Math.min(20, s.hp), playerHpDate: s.day };
    try { readAdventure(s); } catch { return reject('記録の整合性を確認できません。'); }
    return { state: refreshUnlocks(next), ...(outcome ? { outcome } : {}) };
  };
  let outcome: AdventureResult['outcome'];
  if (command.kind === 'lesson') { s.lessons[command.location] = true; return save(); }
  if (command.kind === 'magic' || command.kind === 'upgrade') {
    if (!next.crafted.enchanting_table) return reject('まほうのテーブルを つくろう。');
    if (command.kind === 'magic' && s.dragon && s.dragon.status !== 'won' && !s.dragon.safePreparation) return reject('たたかいの くぎりで かえよう。');
    if (command.kind === 'magic') {
      const values = command.category === 'attack' ? ['power', 'ultimate', 'break'] : ['protection', 'health', 'fire'];
      if (!values.includes(command.value)) return reject('まほうを えらぼう。');
      if (command.category === 'attack') s.attack.kind = command.value as AdventureState['attack']['kind'];
      else s.defense.kind = command.value as AdventureState['defense']['kind'];
      s.hp = Math.min(s.hp, maxHp(adventureEquipment({ ...next, adventure: s }, buddies)));
    } else {
      const eq = adventureEquipment({ ...next, adventure: s }, buddies), upgraded = upgradeCampaign(eq, adventureSupplies(next), command.category);
      if (upgraded.error) return reject(upgraded.error);
      s.attack = upgraded.equipment.attack; s.defense = upgraded.equipment.defense;
      next.materials.lapis = upgraded.supplies.materials.lapis_lazuli ?? 0; next.materials.nether_quartz = upgraded.supplies.materials.quartz ?? 0; next.materials.book = upgraded.supplies.materials.book ?? 0;
    }
    return save();
  }
  if (command.kind === 'retry') {
    if (!s.fallen) return reject('いまは おきあがらなくて だいじょうぶ。');
    if (next.tickets < 1) return reject('チケットが 1まい ひつようだよ。');
    next.tickets--; s.hp = 10; s.hands = 4; s.gauge = 0; s.fallen = false;
    if (s.blaze?.phase === 'lost') delete s.blaze;
    if (s.enderman?.phase === 'lost') delete s.enderman;
    if (s.dragon?.status === 'lost') s.dragon.status = 'paused';
    return save();
  }
  const projected = hydrate(next, s, command.location, buddies);
  if (command.kind === 'enter' || command.kind === 'next') {
    if (projected.kind === 'dragon') {
      s.dragon = projected.run;
      if (!s.fallen && s.dragon.status !== 'won') s.dragon.status = 'battle';
    } else if (projected.kind === 'blaze') {
      s.blaze = projected.run;
      if (!s.fallen && s.blaze.phase === 'returned') s.blaze.phase = 'battle';
      if (!s.fallen && s.blaze.phase === 'won' && command.kind === 'next') s.blaze = createBlazeRun({ loadout: s.blaze.loadout });
    } else {
      s.enderman = projected.run;
      if (!s.fallen && s.enderman.phase === 'returned') s.enderman.phase = 'battle';
      if (!s.fallen && s.enderman.phase === 'won' && command.kind === 'next') s.enderman = createEndermanRun({ loadout: s.enderman.loadout, item: s.enderman.item });
    }
    return save();
  }
  if (s.fallen) return reject('おきあがってから たたかおう。');
  if ((command.kind === 'blaze' || command.kind === 'enderman') && command.action.kind === 'equip') {
    if (projected.kind === 'dragon' || projected.run.phase !== 'battle') return reject('たたかいの あいだに つけかえよう。');
    const item = command.action.item;
    const material = item === 'water' ? 'water' : item === 'shield' ? 'shield' : null;
    if (item === 'stone' || material && (next.materials[material] ?? 0) < 1) return reject('もっているものから えらぼう。');
    if (next.equipped.held === material) return { state: input };
    if (s.hands === 0 && next.tickets < 1) return reject('つけかえには 1こうどう いるよ。');
    if (s.hands === 0) { next.tickets--; s.hands = 4; } s.hands--;
    next = { ...next, equipped: { ...next.equipped, held: material } };
    const view = hydrate(next, s, command.location, buddies);
    if (view.kind === 'blaze') { s.blaze = view.run; outcome = { state: view.run, events: [] }; }
    else if (view.kind === 'enderman') { s.enderman = view.run; outcome = { state: view.run, events: [] }; }
    return save();
  }
  if (!('action' in command)) return reject('こうどうを えらぼう。');
  const healing = command.kind === 'dragon' ? command.action.kind === 'heal' : command.action.kind === 'eat';
  if (healing && (s.foodToday >= 2 || (next.materials.bread ?? 0) < 1 || s.hp >= maxHp(adventureEquipment(next, buddies)))) return reject('きょうの パン・ハートを たしかめてね。');
  if (command.kind === 'blaze' && projected.kind === 'blaze') {
    if (command.action.kind === 'equip') return reject('そうびは もっているものから えらぼう。');
    // Eating does not require buying an action bundle.
    const before = { ...projected.run, ...(healing && s.hands === 0 && next.tickets === 0 ? { handsLeft: 1 } : {}) };
    const result = actOnBlaze(before, command.action); if (result.error) return reject(result.error);
    s.blaze = result.state; s.hp = result.state.hp; s.gauge = result.state.gauge; s.critical = result.state.critical; outcome = result;
    const retreat = command.action.kind === 'return';
    const paid = !healing && !retreat && !['beginSkill', 'chooseSkill', 'cancelSkill'].includes(command.action.kind);
    next.tickets = paid ? result.state.tickets : next.tickets;
    s.hands = paid ? (before.handsLeft || 4) - 1 : s.hands;
    if (result.events.some(event => event.kind === 'kill')) next.materials.blaze_rod = (next.materials.blaze_rod ?? 0) + 1;
  } else if (command.kind === 'enderman' && projected.kind === 'enderman') {
    if (command.action.kind === 'equip') return reject('そうびは もっているものから えらぼう。');
    const before = { ...projected.run, ...(healing && s.hands === 0 && next.tickets === 0 ? { handsLeft: 1 } : {}) };
    const result = actOnEnderman(before, command.action); if (result.error) return reject(result.error);
    s.enderman = result.state; s.hp = result.state.hp; s.gauge = result.state.gauge; s.critical = result.state.critical; outcome = result;
    const paid = !healing && !['return', 'beginSkill', 'chooseSkill', 'cancelSkill'].includes(command.action.kind);
    next.tickets = paid ? result.state.tickets : next.tickets; s.hands = paid ? (before.handsLeft || 4) - 1 : s.hands;
    if (result.events.some(event => event.kind === 'kill')) next.materials.ender_pearl = (next.materials.ender_pearl ?? 0) + 1;
    if (result.state.phase === 'lost') s.endermanDefeats++;
  } else if (command.kind === 'dragon' && projected.kind === 'dragon') {
    if (['retry', 'equip', 'craft', 'upgrade', 'harvest'].includes(command.action.kind)) return reject('そうび・クラフトの画面で じゅんびしよう。');
    const result = stepDragonCampaign(projected.run, command.action); if (result.error) return reject(result.error);
    s.dragon = result.state; s.hp = result.state.hp; s.hands = result.state.hands; s.gauge = result.state.gauge; s.critical = result.state.critical;
    if (command.action.kind === 'hold') next = { ...next, equipped: { ...next.equipped, held: command.action.item === 'none' ? null : command.action.item } };
    next.tickets = result.state.tickets; outcome = result;
    next.materials.spare_bed = result.state.supplies.materials.spare_bed ?? 0;
    if (result.events.some(event => event.kind === 'victory')) next.crafted.elytra = true;
  } else return reject('たたかう ばしょを たしかめよう。');
  if (healing) { s.foodToday++; next.materials.bread = (next.materials.bread ?? 0) - 1; }
  if (s.hp === 0) { s.hands = 0; s.gauge = 0; }
  return save();
}
