/** Standalone, deterministic battle rules. No storage or production-game dependencies. */
import { attackDamage, incomingDamage, SWORD_POWER, type CampaignEquipment, type SwordTier } from './campaignEquipment';
import { nextDragonCritical, type DragonCritical } from './dragonCriticalRules';
import { absorbBattleDamage, grantBattleEffect, isBattleSkillAction, prepareBattleSkill, smallSkillBonus, type BattleSkillAction, type BattleSkillState } from './battleSkillRules';
export type BlazeTarget = { enemyId: number; part: 'body' };
export type BlazeIntent = 'ember' | 'charge' | 'burst';
export type BlazeSwordTier = SwordTier;
export type BlazeArmorTier = 'none' | 'iron' | 'gold' | 'diamond' | 'netherite';
export type BlazeArmorSlot = 'helmet' | 'chest' | 'leggings' | 'boots';
export type BlazeLoadout = {
  sword: BlazeSwordTier;
  armor: Record<BlazeArmorSlot, BlazeArmorTier>;
  magic?: Pick<CampaignEquipment, 'attack' | 'defense'>;
};
export type BlazeItem = 'none' | 'shield';
export type BlazeStartOptions = { loadout?: BlazeLoadout; startHp?: 'full' | 'half'; item?: BlazeItem };
export const BLAZE_ACTIONS_PER_TICKET = 4;

export const BLAZE_ARMOR_COST = { helmet: 5, chest: 8, leggings: 7, boots: 4 } as const;
const FULL_ARMOR_PERCENT: Record<BlazeArmorTier, number> = {
  none: 0, iron: 25, gold: 20, diamond: 40, netherite: 55,
};
const ARMOR_SLOTS: BlazeArmorSlot[] = ['helmet', 'chest', 'leggings', 'boots'];

export function blazeFullArmor(tier: BlazeArmorTier): BlazeLoadout['armor'] {
  return { helmet: tier, chest: tier, leggings: tier, boots: tier };
}

function armorPoints(loadout: BlazeLoadout): number {
  return Math.min(1320, ARMOR_SLOTS.reduce(
    (sum, slot) => sum + FULL_ARMOR_PERCENT[loadout.armor[slot]] * BLAZE_ARMOR_COST[slot], 0,
  ));
}

export function blazeArmorReductionRate(loadout: BlazeLoadout): number {
  return armorPoints(loadout) / 2400;
}

export function blazeAttackDamage(loadout: BlazeLoadout, ultimate = false): number {
  if (loadout.magic) return attackDamage({ ...loadout, ...loadout.magic, shield: false, buddies: [] }, ultimate, false, false).weapon;
  return (loadout.sword === 'netherite' ? 6 : 4) * (ultimate ? 2 : 1);
}

/** Integer numerator prevents floating-point errors at exact HP boundaries. */
export function blazeIncomingDamage(loadout: BlazeLoadout, intent: BlazeIntent, guarding = false, shield = false): number {
  const raw = intent === 'burst' ? 18 : intent === 'ember' ? 4 : 0;
  if (loadout.magic) return incomingDamage({ ...loadout, ...loadout.magic, shield, buddies: [] }, raw, 'fire', guarding);
  return Math.ceil(raw * (2400 - armorPoints(loadout)) * (guarding ? shield ? 2 : 5 : 10) / 24000);
}
export type BlazeEnemy = {
  id: number;
  hp: number;
  maxHp: number;
  intent: BlazeIntent;
  step: number;
};
export type BlazePhase = 'battle' | 'won' | 'lost' | 'returned';
export type BlazeRun = BattleSkillState & {
  critical?: DragonCritical;
  item: BlazeItem;
  loadout: BlazeLoadout;
  hp: number;
  maxHp: number;
  tickets: number;
  handsLeft: number;
  bread: number;
  gauge: number;
  turn: number;
  enemies: BlazeEnemy[];
  phase: BlazePhase;
  pendingRods: number;
  securedRods: number;
  log: string[];
};
export type BlazeEvent = {
  kind: 'slash' | 'guard' | 'ultimate' | 'counter' | 'heal' | 'kill' | 'critical' | 'burn' | 'effect' | 'stun';
  enemyId?: number;
  amount: number;
};
export type BlazeAction = BattleSkillAction
  | { kind: 'equip'; item: BlazeItem }
  | { kind: 'strike'; target: BlazeTarget }
  | { kind: 'ultimate'; enemyId: number }
  | { kind: 'guard' }
  | { kind: 'eat' }
  | { kind: 'return' };

export function createBlazeRun(options: BlazeStartOptions = {}): BlazeRun {
  const loadout = options.loadout ?? { sword: 'diamond', armor: blazeFullArmor('iron') };
  return {
    item: options.item ?? 'none',
    loadout: { ...loadout, armor: { ...loadout.armor } },
    hp: options.startHp === 'half' ? 10 : 20,
    maxHp: 20,
    tickets: 4,
    handsLeft: 0,
    bread: 2,
    gauge: 0,
    turn: 0,
    enemies: [
      { id: 0, hp: 24, maxHp: 24, intent: 'charge', step: 0 },
    ],
    phase: 'battle',
    pendingRods: 0,
    securedRods: 0,
    log: ['ブレイズが あらわれた！ ほのおのようすを よくみよう。'],
  };
}

function appendLog(state: BlazeRun, message: string): void {
  state.log.push(message);
  state.log = state.log.slice(-8);
}

/** Invalid actions return the original input, with no spent resources or events. */
export function actOnBlaze(
  run: BlazeRun,
  action: BlazeAction,
): { state: BlazeRun; events: BlazeEvent[]; error?: string } {
  const original = run;
  let cast: { score: number; mode: import('./dragonSkillRules').DragonSkillKind } | undefined;
  if (isBattleSkillAction(action.kind)) {
    const prepared = prepareBattleSkill(run, action as BattleSkillAction);
    if (prepared.error || !prepared.cast) return { ...prepared, events: [] };
    run = prepared.state; cast = prepared.cast; action = { kind: 'ultimate', enemyId: 0 };
  } else if (run.skills?.pending || action.kind === 'ultimate' && run.skills) return { state: original, events: [], error: 'ひっさつを えらんで はなとう。' };
  const reject = (error: string) => ({ state: original, events: [] as BlazeEvent[], error });
  if (run.phase !== 'battle') return reject('この たたかいは おわっているよ。');
  if (run.hp <= 0) return reject('いまは こうどうできないよ。');

  // Validate every requirement before cloning or spending anything.
  let target: BlazeEnemy | undefined;
  if (action.kind === 'strike' || action.kind === 'ultimate' || action.kind === 'guard') {
    if (action.kind === 'strike' && action.target?.part !== 'body') {
      return reject('ねらう ばしょを えらんでね。');
    }
    const enemyId = action.kind === 'strike' ? action.target.enemyId : action.kind === 'ultimate' ? action.enemyId : 0;
    target = run.enemies.find((enemy) => enemy.id === enemyId && enemy.hp > 0);
    if (!target) return reject('げんきな ブレイズを えらんでね。');
    if (action.kind === 'ultimate' && run.gauge < 3) return reject('ひっさつは あとすこしで つかえるよ。');
    if (run.handsLeft <= 0 && run.tickets <= 0) return reject('こうどうには チケットが ひつようだよ。');
  } else if (action.kind === 'eat') {
    if (run.bread <= 0) return reject('パンが ないよ。');
    if (run.hp >= run.maxHp) return reject('いまは げんきいっぱいだよ。');
    if (run.tickets <= 0 && run.handsLeft <= 0) return reject('いまは こうどうできないよ。パンを のこして かえろう。');
  } else if (action.kind === 'equip') {
    if (!['none', 'shield'].includes(action.item)) return reject('そうびを えらんでね。');
    if (action.item === run.item) return { state: run, events: [] };
    if (run.handsLeft <= 0 && run.tickets <= 0) return reject('こうどうには チケットが ひつようだよ。');
  } else if (action.kind !== 'return') {
    return reject('こうどうを えらんでね。');
  }

  const state: BlazeRun = {
    ...run,
    loadout: { ...run.loadout, armor: { ...run.loadout.armor } },
    enemies: run.enemies.map((enemy) => ({ ...enemy })),
    log: [...run.log],
  };
  const events: BlazeEvent[] = [];

  if (action.kind === 'eat') {
    const healed = Math.min(10, state.maxHp - state.hp);
    state.hp += healed;
    state.bread -= 1;
    events.push({ kind: 'heal', amount: healed });
    appendLog(state, 'パンを たべた！ ハートが かいふくしたよ。');
    return { state, events };
  }

  if (action.kind === 'return') {
    state.securedRods += state.pendingRods;
    state.pendingRods = 0;
    state.handsLeft = 0;
    state.phase = 'returned';
    appendLog(state, 'ロッドを もって かえったよ。また ちょうせんしよう！');
    return { state, events };
  }

  if (state.handsLeft <= 0) {
    state.tickets -= 1;
    state.handsLeft = BLAZE_ACTIONS_PER_TICKET;
  }
  state.handsLeft -= 1;
  state.turn += 1;

  if (action.kind === 'equip') {
    state.item = action.item;
    appendLog(state, 'もちものを かえた。こうどうを 1かい つかった。');
    return { state, events };
  }
  // The target was checked above; clone lookup avoids ever mutating the input.
  const enemy = state.enemies.find((candidate) => candidate.id === target!.id)!;

  const isUltimate = action.kind === 'ultimate';
  const isGuard = action.kind === 'guard';
  if (isGuard) {
    events.push({ kind: 'guard', enemyId: enemy.id, amount: blazeIncomingDamage(state.loadout, enemy.intent) - blazeIncomingDamage(state.loadout, enemy.intent, true, state.item === 'shield') });
    appendLog(state, enemy.intent === 'charge' ? 'まもった！ ブレイズは ひのたまを ためている。' : 'まもった！ ひのたまを よわめた！');
  } else {
    let power = blazeAttackDamage(state.loadout, isUltimate);
    if (cast) power += smallSkillBonus(SWORD_POWER[state.loadout.sword] * 2, cast.score);
    if (!isUltimate && state.critical) {
      const roll = nextDragonCritical(state.critical); state.critical = roll.state;
      if (roll.hit) { power += blazeAttackDamage(state.loadout); events.push({ kind: 'critical', enemyId: enemy.id, amount: blazeAttackDamage(state.loadout) }); }
    }
    const damage = Math.min(enemy.hp, power);
    enemy.hp -= damage;
    state.gauge = isUltimate ? 0 : Math.min(3, state.gauge + 1);
    events.push({ kind: isUltimate ? 'ultimate' : 'slash', enemyId: enemy.id, amount: damage });
    appendLog(state, isUltimate ? 'ひっさつ！ ブレイズを おしきった！' : 'ブレイズに こうげき！');
  }

  if ((original.effects?.burn ?? 0) > 0 && enemy.hp > 0) {
    state.effects = { ...original.effects!, burn: original.effects!.burn - 1 };
    const amount = Math.min(5, enemy.hp); enemy.hp -= amount; events.push({ kind: 'burn', amount, enemyId: enemy.id });
  }
  if (cast) {
    const effect = grantBattleEffect(state.effects, cast.mode, state.hp, state.maxHp);
    state.effects = effect.effects; state.hp += effect.healed;
    events.push({ kind: 'effect', amount: 0 });
    if (effect.healed) events.push({ kind: 'heal', amount: effect.healed });
  }
  if (enemy.hp === 0) {
    state.pendingRods += 1;
    events.push({ kind: 'kill', enemyId: enemy.id, amount: 1 });
    appendLog(state, '１たい たおした！ ロッドを ひろったよ。');
  }

  if (state.enemies.every((candidate) => candidate.hp === 0)) {
    state.securedRods += state.pendingRods;
    state.pendingRods = 0;
    state.effects = undefined;
    state.phase = 'won';
    appendLog(state, 'だいしょうり！ ロッドを もって かえろう！');
    return { state, events };
  }

  // Counters use the displayed intent, then advance to the next visible intent.
  // Resolve the whole enemy round, even if its combined damage is lethal.
  let incomingDamage = 0;
  for (const survivor of state.enemies) {
    if (survivor.hp === 0) continue;
    survivor.step += 1;
    if (survivor.id === enemy.id && isUltimate) {
      survivor.intent = 'ember';
      continue;
    }
    const intent = survivor.intent;
    let counterDamage = blazeIncomingDamage(state.loadout, intent, isGuard, state.item === 'shield');
    survivor.intent = intent === 'charge' ? 'burst' : intent === 'burst' ? 'ember' : 'charge';
    if (counterDamage > 0 && (original.effects?.stun ?? 0) > 0) {
      state.effects = { ...state.effects!, stun: Math.max(0, state.effects!.stun - 1) };
      events.push({ kind: 'stun', amount: 0 }); continue;
    }
    const attackAttempted = counterDamage > 0;
    const ward = absorbBattleDamage(state.effects, counterDamage); state.effects = ward.effects; counterDamage = ward.damage;
    if (attackAttempted) {
      incomingDamage += counterDamage;
      events.push({ kind: 'counter', enemyId: survivor.id, amount: counterDamage });
      appendLog(state, intent === 'burst' ? 'おおきな ひのたまが きた！' : 'ちいさな ひのたまが きた！');
    } else if (!isGuard) {
      appendLog(state, 'ブレイズが おおきな ひのたまを ためている！');
    }
  }
  state.hp = Math.max(0, state.hp - incomingDamage);
  if (state.hp === 0) {
    state.phase = 'lost';
    state.pendingRods = 0;
    state.handsLeft = 0;
    state.effects = undefined;
    appendLog(state, 'たおされた…。ひろった ロッドは おとしてしまった。');
  }
  return { state, events };
}
