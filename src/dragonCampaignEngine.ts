/** New, isolated Dragon campaign. Pure transactions; never reads a real profile. */
import {
  attackDamage, craftCampaign, defaultEquipment, defaultSupplies, harvestCampaign,
  incomingDamage, maxHp, upgradeCampaign,
  type CampaignEquipment, type CampaignSupplies,
} from './campaignEquipment';
import { DRAGON_ADVENTURE_CYCLES, dragonFocusTarget, isDragonHeavyIntent, type DragonAdventure } from './dragonCampaignAdventure';
import { SAVED_SKILL_KINDS, skillOffers, skillBonus, type DragonSkillKind, type DragonSkills } from './dragonSkillRules';
import { validSkillUnlocks } from './battleSkillRules';
import { nextDragonCritical, validDragonCritical, type DragonCritical } from './dragonCriticalRules';
import { capAllyHits, emptyDragonEffects, rollAllyAttack, validDragonEffects, type AllyHit, type DragonEffects } from './dragonBattleEffects';

export const CAMPAIGN_VERSION = 1;
export const DRAGON_BODY_HP = 1200;
export const CAMPAIGN_ACTIONS = 4;
export const CAMPAIGN_CHECKPOINT_HP = 60;
export type CampaignPhase = 'crystals' | 'wings' | 'orb' | 'rage';
export type CampaignStatus = 'preparation' | 'battle' | 'paused' | 'lost' | 'won';
export type CampaignIntent = 'claw' | 'charge' | 'breath' | 'opening' | 'orbPrepare' | 'gust' | 'orbFire' | 'charge1' | 'charge2' | 'storm';
export type CampaignTarget = 'body' | `crystal:${number}` | `wing:${number}` | 'orb';
export type CampaignEvent = {
  kind: 'ticket' | 'hit' | 'companion' | 'guard' | 'counter' | 'heal' | 'partBreak' | 'landing' | 'crystalHeal'
    | 'interrupt' | 'orbReflect' | 'checkpoint' | 'phase' | 'defeat' | 'revive' | 'victory' | 'bed' | 'equip' | 'craft' | 'upgrade' | 'harvest' | 'pause' | 'counterReady' | 'weakHit' | 'skillBonus' | 'critical' | 'burn' | 'stun' | 'waterWard' | 'lightReserve' | 'effect';
  amount: number;
  target?: CampaignTarget;
  intent?: CampaignIntent;
  message?: string;
  allies?: AllyHit[];
};
export type DragonCampaign = {
  bodyMaxHp?: number;
  version: 1; revision: number; id: string; day: string;
  status: CampaignStatus; phase: CampaignPhase; equipment: CampaignEquipment; supplies: CampaignSupplies;
  hp: number; bodyHp: number; checkpointHp: number; finalEntryHp: number | null;
  crystals: number[]; wings: number[]; orbHp: number; orbTurns: number;
  intentIndex: number; landingTurns: number; barrierTurns: number;
  tickets: number; hands: number; gauge: number; foodToday: number; bedsUsed: number;
  selected: CampaignTarget; safePreparation: boolean; safePending: boolean; bodyAttempts: number;
  turns: number; defeats: number; rewardClaimed: boolean; seed: number; log: string[];
  adventure?: DragonAdventure;
  skills?: DragonSkills;
  unlockedSkills?: DragonSkillKind[];
  rescueSeen?: boolean;
  critical?: DragonCritical;
  allySeed?: number;
  effects?: DragonEffects;
  heldItem?: 'none' | 'shield' | 'water';
};
export type CampaignHarvestPlace = 'farm' | 'wood' | 'ranch' | 'lapis' | 'nether';
export type CampaignAction =
  | { kind: 'attack' | 'ultimate' | 'guard' | 'bed' | 'heal' | 'pause' | 'resume' | 'retry' }
  | { kind: 'select'; target: CampaignTarget }
  | { kind: 'hold'; item: 'none' | 'shield' | 'water' }
  | { kind: 'equip'; equipment: CampaignEquipment }
  | { kind: 'craft'; recipeId: string }
  | { kind: 'upgrade'; category: 'attack' | 'defense' }
  | { kind: 'harvest'; place: CampaignHarvestPlace }
  | { kind: 'beginSkill' | 'cancelSkill' | 'rescue' }
  | { kind: 'chooseSkill'; token: string; mode: DragonSkillKind }
  | { kind: 'releaseSkill'; token: string; score: number };
export type CampaignOutcome = { state: DragonCampaign; events: CampaignEvent[]; error?: string };

export const crystalMaxHp = (index: number) => index === 0 ? 4 : index < 4 ? 20 : 28;
export function validCampaignDay(day: unknown): day is string {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const stamp = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === day;
}
export const brokenCrystals = (s: DragonCampaign) => s.crystals.filter(hp => hp === 0).length;
export const campaignBodyMaxHp = (s: DragonCampaign) => s.bodyMaxHp ?? DRAGON_BODY_HP;
export const brokenWings = (s: DragonCampaign) => s.wings.filter(hp => hp === 0).length;
export const PHASE_CYCLES: Record<CampaignPhase, CampaignIntent[]> = {
  crystals: ['claw', 'charge', 'breath', 'opening'],
  wings: ['claw', 'claw', 'charge', 'breath', 'opening'],
  orb: ['claw', 'orbPrepare'],
  rage: ['claw', 'charge1', 'charge2', 'storm', 'opening'],
};

export function campaignIntent(s: DragonCampaign): CampaignIntent {
  if (s.landingTurns > 0) return 'opening';
  if (s.orbHp > 0) return s.orbTurns === 2 ? 'gust' : 'orbFire';
  const cycles = DRAGON_ADVENTURE_CYCLES[s.phase];
  const cycle = s.adventure ? cycles[s.adventure.pattern % cycles.length] : PHASE_CYCLES[s.phase];
  return cycle[s.intentIndex % cycle.length];
}
export function campaignRawDamage(s: DragonCampaign, intent = campaignIntent(s)): number {
  if (intent === 'claw') return Math.max(2, (s.phase === 'crystals' ? 6 : 8) - brokenWings(s));
  if (intent === 'gust') return 6;
  if (intent === 'breath' || intent === 'orbFire') return 20;
  if (intent === 'storm') return 24;
  return 0;
}
export function campaignCounterDamage(s: DragonCampaign, guarding = false): number {
  if ((s.effects?.stun ?? 0) > 0) return 0;
  const intent = campaignIntent(s);
  let amount = incomingDamage(s.equipment, campaignRawDamage(s, intent), ['breath', 'orbFire', 'storm'].includes(intent) ? 'fire' : 'physical', guarding);
  if ((s.effects?.water ?? 0) > 0) amount = Math.ceil(amount / 2);
  return Math.max(0, amount - (s.effects?.light ?? 0));
}
export function campaignBedAvailable(s: DragonCampaign): boolean {
  return s.bedsUsed < 3 && (s.supplies.materials.spare_bed ?? 0) > 0
    && (s.landingTurns > 0 || s.phase === 'orb' || s.phase === 'rage' || brokenWings(s) === 2);
}
export function campaignTargetHp(s: DragonCampaign, target: CampaignTarget): number {
  if (target === 'body') return s.bodyHp;
  if (target === 'orb') return s.phase === 'orb' ? s.orbHp : 0;
  const [kind, text] = target.split(':');
  const index = Number(text);
  if (!Number.isInteger(index) || String(index) !== text) return 0;
  if (kind === 'crystal' && s.phase === 'crystals' && index >= 0 && index < 8) return s.crystals[index];
  if (kind === 'wing' && s.phase === 'wings' && index >= 0 && index < 2) return s.wings[index];
  return 0;
}
export function createDragonCampaign(day: string, options: { equipment?: CampaignEquipment; supplies?: CampaignSupplies; tickets?: number; id?: string } = {}): DragonCampaign {
  const equipment = structuredClone(options.equipment ?? defaultEquipment());
  return {
    version: CAMPAIGN_VERSION, revision: 0, id: options.id ?? 'dragon-lab-1', day,
    status: 'preparation', phase: 'crystals', equipment, supplies: structuredClone(options.supplies ?? defaultSupplies()),
    hp: maxHp(equipment), bodyHp: DRAGON_BODY_HP, checkpointHp: DRAGON_BODY_HP, finalEntryHp: null,
    crystals: Array.from({ length: 8 }, (_, index) => crystalMaxHp(index)), wings: [48, 48], orbHp: 0, orbTurns: 0,
    intentIndex: 0, landingTurns: 0, barrierTurns: 0, tickets: Math.max(0, Math.floor(options.tickets ?? 60)), hands: 0,
    gauge: 0, foodToday: 0, bedsUsed: 0, selected: 'body', safePreparation: true, safePending: false, bodyAttempts: 0,
    turns: 0, defeats: 0, rewardClaimed: false, seed: 10617, log: ['ジ・エンドへ。そうびを ととのえよう。'],
  };
}

/** Calendar recovery is once per increasing date. Pausing/reloading cannot repeat it. */
export function refreshCampaignDay(s: DragonCampaign, day: string): DragonCampaign {
  if (s.skills?.pending || !validCampaignDay(day) || day <= s.day) return s;
  return { ...s, day, hp: s.status === 'won' ? s.hp : maxHp(s.equipment), foodToday: 0, revision: s.revision + 1,
    log: [...s.log, 'あたらしい日。ハートが もどった。'].slice(-12) };
}

export function stepDragonCampaign(input: DragonCampaign, action: CampaignAction): CampaignOutcome {
  const reject = (error: string): CampaignOutcome => ({ state: input, events: [], error });
  const allowed = ['attack', 'ultimate', 'guard', 'bed', 'heal', 'pause', 'resume', 'retry', 'select', 'hold', 'equip', 'craft', 'upgrade', 'harvest', 'beginSkill', 'chooseSkill', 'releaseSkill', 'cancelSkill', 'rescue'];
  if (!action || !allowed.includes(action.kind)) return reject('こうどうを えらんでね。');
  if (input.status === 'won') return reject('もう たおしたよ！');
  const pending = input.skills?.pending;
  if (pending && !['chooseSkill', 'releaseSkill', 'cancelSkill'].includes(action.kind)) return reject('ひっさつを はなってから つづけよう。');
  let skillScore: number | null = null;
  if (action.kind === 'releaseSkill') {
    if (!pending?.mode || pending.token !== action.token || !Number.isInteger(action.score) || action.score < 0 || action.score > 100) return reject('ひっさつの きろくを たしかめてね。');
    skillScore = action.score;
    action = { kind: 'ultimate' };
  } else if (action.kind === 'ultimate' && input.skills) return reject('ひっさつの あそびを えらぼう。');
  if (action.kind === 'select') {
    if (input.status !== 'battle' || typeof action.target !== 'string' || campaignTargetHp(input, action.target) <= 0) return reject('いま ねらえるところを えらぼう。');
    if (input.selected === action.target) return { state: input, events: [] };
    return { state: { ...input, selected: action.target, revision: input.revision + 1 }, events: [] };
  }
  const s = structuredClone(input);
  const events: CampaignEvent[] = [];
  const emit = (kind: CampaignEvent['kind'], amount = 0, extra: Partial<CampaignEvent> = {}) => { events.push({ kind, amount, ...extra }); };
  const note = (message: string) => { s.log = [...s.log, message].slice(-12); };
  const finish = (): CampaignOutcome => { s.revision = input.revision + 1; return { state: s, events }; };
  const canFund = () => s.hands > 0 || s.tickets > 0;
  const spend = () => {
    if (s.hands === 0) { s.tickets--; s.hands = CAMPAIGN_ACTIONS; emit('ticket', 1); }
    s.hands--; s.turns++; s.safePreparation = false;
  };

  if (action.kind === 'beginSkill') {
    if (!s.skills || s.status !== 'battle' || s.hp <= 0 || s.gauge < 3 || !canFund() || campaignTargetHp(s, s.selected) <= 0) return reject('ひっさつの じゅんびを しよう。');
    const offers = skillOffers(s.skills.casts, s.skills.last, s.unlockedSkills);
    s.skills.pending = { token: `${s.id}:${s.revision}:${s.skills.casts}`, target: s.selected, mode: offers.length === 1 ? offers[0] : null };
    return finish();
  }
  if (action.kind === 'chooseSkill') {
    if (!s.skills || !pending || pending.mode || pending.token !== action.token || !skillOffers(s.skills.casts, s.skills.last, s.unlockedSkills).includes(action.mode)) return reject('いまの ひっさつを たしかめよう。');
    s.skills.pending = { ...pending, mode: action.mode }; return finish();
  }
  if (action.kind === 'cancelSkill') {
    if (!s.skills || !pending || pending.mode) return reject('はじめた ひっさつは はなとう。');
    s.skills.pending = null; return finish();
  }
  if (skillScore !== null && s.skills && pending) {
    s.selected = pending.target; s.skills.last = pending.mode; s.skills.casts++; s.skills.pending = null;
  }
  if (action.kind === 'rescue') {
    if (s.status !== 'battle' || s.rescueSeen || !s.equipment.buddies.length) return reject('なかまは いっしょに たたかうよ。');
    s.rescueSeen = true; return finish();
  }

  if (action.kind === 'pause') {
    if (s.status !== 'battle') return reject('いまは たたかっていないよ。');
    s.status = 'paused'; emit('pause'); note('ここまで きろく。のこりの行動も とっておくよ。'); return finish();
  }
  if (action.kind === 'resume') {
    if (!['preparation', 'paused'].includes(s.status) || s.hp <= 0) return reject('もういちど ちょうせんしよう。');
    s.status = 'battle'; note('つづきから たたかう！'); return finish();
  }
  if (action.kind === 'retry') {
    if (s.status !== 'lost') return reject('いまは おきあがらなくて だいじょうぶ。');
    if (s.tickets < 1) return reject('もういちど たたかうには チケットが1枚いるよ。');
    s.tickets--; s.hands = CAMPAIGN_ACTIONS; s.hp = s.hp > 0 ? s.hp : Math.min(10, maxHp(s.equipment));
    s.effects = emptyDragonEffects(); s.status = 'battle'; emit('ticket', 1); emit('revive', s.hp); note('おきあがった！ このチケットで 4回うごけるよ。'); return finish();
  }
  if (action.kind === 'hold') {
    if (s.status !== 'battle' || !['none', 'shield', 'water'].includes(action.item)) return reject('もちものを たしかめてね。');
    if (action.item === 'shield' && !s.supplies.owned.shield || action.item === 'water' && (s.supplies.materials.water ?? 0) < 1) return reject('もっているものから えらぼう。');
    if ((s.heldItem ?? (s.equipment.shield ? 'shield' : 'none')) === action.item) return { state: input, events: [] };
    if (!canFund()) return reject('つけかえには 1こうどう いるよ。');
    spend(); s.heldItem = action.item; s.equipment.shield = action.item === 'shield';
    if (s.adventure) { s.adventure.counter = false; s.adventure.pressure = 0; }
    emit('equip'); note('もちものを かえた。'); return finish();
  }
  if (action.kind === 'craft' || action.kind === 'upgrade' || action.kind === 'harvest' || action.kind === 'equip') {
    if (s.status === 'battle') return reject('じゅんびの 画面で かえよう。');
    if (action.kind === 'craft') {
      const result = craftCampaign(s.supplies, action.recipeId);
      if (result.error) return reject(result.error);
      s.supplies = result.supplies; emit('craft', 1); note('クラフト できた！'); return finish();
    }
    if (action.kind === 'upgrade') {
      if (action.category !== 'attack' && action.category !== 'defense') return reject('きょうかするものを えらぼう。');
      const result = upgradeCampaign(s.equipment, s.supplies, action.category);
      if (result.error) return reject(result.error);
      s.equipment = result.equipment; s.supplies = result.supplies;
      s.hp = Math.min(s.hp, maxHp(s.equipment)); emit('upgrade', 1); note('きょうか できた！'); return finish();
    }
    if (action.kind === 'harvest') {
      if (!['farm', 'wood', 'ranch', 'lapis', 'nether'].includes(action.place)) return reject('ばしょを えらぼう。');
      if (s.tickets < 1) return reject('あつめるには チケットが1枚いるよ。');
      // One saved draw: reopening a menu never rerolls this result.
      s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
      const roll = s.seed / 4294967296;
      const result = harvestCampaign(s.supplies, action.place, roll, { tool: s.equipment.sword === 'none' ? 'wood' : s.equipment.sword, buddyBonus: Math.min(.45, s.equipment.buddies.reduce((sum, buddy) => sum + buddy.level / 10 * .15, 0)), outcome: s.seed % 12 === 0 ? 'jackpot' : s.seed % 3 === 0 ? 'hit' : 'normal' });
      s.tickets--; s.supplies = result.supplies; emit('harvest', 1, { message: result.message }); note(result.message); return finish();
    }
    const eq = action.equipment;
    if (!validEquipment(eq)) return reject('そうびを たしかめてね。');
    if (eq.attack.rank !== s.equipment.attack.rank || eq.defense.rank !== s.equipment.defense.rank) return reject('ほしは きょうかで ふやそう。');
    if (!s.safePreparation && (eq.attack.kind !== s.equipment.attack.kind || eq.defense.kind !== s.equipment.defense.kind)) return reject('しゅるいの へんこうは くぎりの後で できるよ。');
    if (!s.supplies.owned[`sword_${eq.sword}`] || (eq.shield && !s.supplies.owned.shield)) return reject('まだ もっていない そうびだよ。');
    for (const [slot, tier] of Object.entries(eq.armor)) if (tier !== 'none' && !s.supplies.owned[`armor_${slot}_${tier}`]) return reject('まだ もっていない ぼうぐだよ。');
    if (eq.buddies.length > s.supplies.partySlots || eq.buddies.some(buddy => !s.equipment.buddies.some(current => current.id === buddy.id && current.level === buddy.level && current.image === buddy.image))) return reject('なかまを たしかめてね。');
    if (JSON.stringify(eq) === JSON.stringify(s.equipment)) return { state: input, events: [] };
    if (!s.safePreparation) {
      if (!canFund()) return reject('そうびを かえるには 1行動いるよ。');
      spend();
      if (s.adventure) { s.adventure.counter = false; s.adventure.pressure = 0; s.adventure.beat++; }
      if (s.landingTurns > 0) s.landingTurns--;
      if (s.barrierTurns > 0) s.barrierTurns--;
      if (s.landingTurns === 0 && s.safePending) { s.safePending = false; s.safePreparation = true; }
    }
    s.equipment = structuredClone(eq); s.heldItem = eq.shield ? 'shield' : s.heldItem === 'water' ? 'water' : 'none'; s.hp = Math.min(s.hp, maxHp(eq)); emit('equip'); note('そうびを かえた。'); return finish();
  }

  if (s.status !== 'battle' || s.hp <= 0) return reject('じゅんびして たたかおう。');
  if (action.kind === 'heal') {
    if (s.foodToday >= 2) return reject('きょうの パンは 2こまでだよ。');
    if ((s.supplies.materials.bread ?? 0) < 1) return reject('パンを つくってこよう。');
    if (s.hp >= maxHp(s.equipment)) return reject('ハートは いっぱいだよ。');
    const amount = Math.min(10, maxHp(s.equipment) - s.hp);
    s.hp += amount; s.foodToday++; s.supplies.materials.bread--; emit('heal', amount); note('ハートが もどった！'); return finish();
  }
  if (!canFund()) return reject('チケットが ないよ。つづきは とっておけるよ。');
  if (action.kind === 'ultimate' && s.gauge < 3) return reject('ひかりが 3こ ひつようだよ。');
  if (action.kind === 'bed' && !campaignBedAvailable(s)) return reject(s.bedsUsed >= 3 ? 'ベッドは このたたかいで 3こまでだよ。' : 'ベッドは おりてきたときに つかおう。');
  if ((action.kind === 'attack' || action.kind === 'ultimate') && campaignTargetHp(s, s.selected) <= 0) return reject('ねらうところを えらんでね。');

  const oldIntent = campaignIntent(s), oldPhase = s.phase, oldLanding = s.landingTurns, oldBarrier = s.barrierTurns;
  const special = action.kind === 'ultimate', bed = action.kind === 'bed', guarding = action.kind === 'guard';
  const oldEffects = { ...(s.effects ?? emptyDragonEffects()) };
  s.effects = { ...oldEffects };
  const focus = dragonFocusTarget(input);
  const riposte = !!s.adventure?.counter && action.kind === 'attack';
  if (s.adventure) { s.adventure.counter = false; s.adventure.beat++; }
  let stagger = false, reflected = false;
  spend();
  const confirmProgress = () => {
    const checkpoint = Math.min(s.checkpointHp, Math.ceil(s.bodyHp / CAMPAIGN_CHECKPOINT_HP) * CAMPAIGN_CHECKPOINT_HP);
    if (checkpoint < s.checkpointHp) { s.checkpointHp = checkpoint; emit('checkpoint', checkpoint); }
  };
  let crystalHealed = false;
  const bodyDamage = (amount: number, kind: 'hit' | 'bed' | 'orbReflect' | 'burn') => {
    const dealt = Math.min(s.bodyHp, amount); s.bodyHp -= dealt;
    emit(kind, dealt, { target: 'body' });
    if (!crystalHealed && s.bodyHp > 0 && brokenCrystals(s) < 8) {
      crystalHealed = true;
      // Confirmed progress is permanent, even when crystals heal between attacks.
      const heal = Math.min(s.checkpointHp - s.bodyHp, 8 - brokenCrystals(s));
      s.bodyHp += heal; if (heal > 0) emit('crystalHeal', heal, { target: 'body' });
    }
    confirmProgress();
  };
  if (guarding) { emit('guard', campaignCounterDamage(s) - campaignCounterDamage(s, true)); note('まもる！'); }
  else if (bed) {
    s.supplies.materials.spare_bed--; s.bedsUsed++; bodyDamage(60, 'bed'); note('ベッドで どかーん！');
  } else {
    s.gauge = special ? 0 : Math.min(3, s.gauge + 1);
    const target = s.selected, part = target !== 'body';
    const damage = attackDamage(s.equipment, special, part, !part && oldLanding > 0);
    let allyHits: AllyHit[] = special ? s.equipment.buddies.slice(0, 3).map(buddy => ({ id: buddy.id, amount: Math.ceil(buddy.level / 4) })) : [];
    if (!special && s.critical) {
      const roll = nextDragonCritical(s.critical); s.critical = roll.state;
      if (roll.hit) {
        // Add exactly one unmultiplied sword hit, before barrier/HP capping.
        // Opening, riposte, allies and skill bonuses are never multiplied again.
        const bonus = attackDamage(s.equipment, false, part, false).weapon;
        damage.weapon += bonus; damage.total += bonus;
        emit('critical', bonus, { target });
      }
    }
    if (s.adventure && (riposte || focus === target && target.startsWith('wing:'))) {
      // Tactical rewards add one unmultiplied weapon hit. Allies never multiply.
      const base = attackDamage(s.equipment, special, part, false);
      damage.weapon += base.weapon; damage.total += base.weapon;
      emit('weakHit', base.weapon, { target });
    }
    if (special && skillScore !== null) {
      const bonus = skillBonus(s.equipment.sword, skillScore);
      damage.weapon += bonus; damage.total += bonus; emit('skillBonus', bonus, { target, message: `${skillScore}` });
    }
    if (!special && s.skills && s.equipment.buddies.length > 0) {
      const allies = rollAllyAttack(s.equipment.buddies, s.allySeed ?? (s.seed ^ 0xa511e9b3) >>> 0);
      s.allySeed = allies.seed; allyHits = allies.hits;
      damage.companions = allies.total; damage.total += allies.total;
    }
    if (s.adventure && s.phase === 'rage' && !part && oldLanding === 0) {
      if (!special && ['charge1', 'charge2'].includes(oldIntent)) s.adventure.pressure++;
      else s.adventure.pressure = 0;
      if (s.adventure.pressure >= 2 || special && oldIntent === 'charge2') {
        s.landingTurns = 2; s.safePending = true; s.adventure.pressure = 0;
        stagger = true; emit('landing', 2); emit('interrupt', 0, { intent: oldIntent });
      }
    }
    if (!part) { s.bodyAttempts++; bodyDamage(damage.total, 'hit'); }
    else {
      const [type, text] = target.split(':');
      const index = Number(text);
      const amount = type === 'crystal' && index >= 4 && oldBarrier === 0 && !(s.adventure && special) ? Math.ceil(damage.total / 2) : damage.total;
      const before = campaignTargetHp(s, target), dealt = Math.min(before, amount);
      if (target === 'orb') s.orbHp -= dealt;
      else if (type === 'crystal') s.crystals[index] -= dealt;
      else s.wings[index] -= dealt;
      emit('hit', dealt, { target });
      if (dealt === before) {
        emit('partBreak', 1, { target });
        if (target === 'orb') { s.orbTurns = 0; bodyDamage(s.adventure && special ? 64 : 32, 'orbReflect'); reflected = true; note('たまを はねかえした！'); }
        else if (type === 'wing' || brokenCrystals(s) % 2 === 0) {
          s.landingTurns = 2; s.safePending = true; stagger = true; emit('landing', 2); note('おりてきた！ チャンス！');
        }
        if (type === 'crystal') {
          if (s.adventure) s.gauge = Math.min(3, s.gauge + 1);
          const next = s.crystals.findIndex(hp => hp > 0);
          s.selected = stagger || next < 0 ? 'body' : `crystal:${next}`;
        } else { s.selected = 'body'; if (s.adventure && type === 'wing') s.gauge = 3; }
      }
    }
    // Record only the part of the aggregate hit actually dealt by the follow-up.
    // No phantom ally hit if the player's sword already destroyed the target.
    const hit = events.find(event => event.kind === 'hit' && event.target === target);
    const barrier = part && target.startsWith('crystal:') && Number(target.split(':')[1]) >= 4 && oldBarrier === 0 && !(s.adventure && special);
    const own = barrier ? Math.ceil(damage.weapon / 2) : damage.weapon;
    const assist = Math.max(0, (hit?.amount ?? 0) - own);
    if (assist > 0) emit('companion', assist, { target, allies: capAllyHits(allyHits, assist) });
    if (!reflected) note(special ? 'なかまと ひっさつ！' : events.some(event => event.kind === 'critical') ? 'かいしんの いちげき！' : 'こうげき！');
  }
  // Existing burns tick on paid combat turns only, never on the casting turn or menu actions.
  if (oldEffects.burn > 0 && s.bodyHp > 0) { s.effects.burn--; bodyDamage(5, 'burn'); }
  if (special && skillScore !== null && pending?.mode) {
    if (pending.mode === 'burst') { s.effects.burn = 3; emit('effect', 3, { message: 'やけど', target: 'body' }); }
    if (pending.mode === 'gauge') { s.effects.stun = 1; emit('effect', 1, { message: 'しびれ', target: 'body' }); }
    if (pending.mode === 'repel' || pending.mode === 'trace') { s.effects.water = 2; emit('effect', 2, { message: 'まもり', target: 'body' }); }
    if (pending.mode === 'aim') {
      const restored = Math.min(4, maxHp(s.equipment) - s.hp); s.hp += restored;
      s.effects.light = Math.max(s.effects.light, 4 - restored);
      if (restored) emit('heal', restored);
      if (s.effects.light) emit('lightReserve', s.effects.light);
      emit('effect', 4, { message: 'いやし', target: 'body' });
    }
  }
  if (s.bodyHp === 0) {
    s.status = 'won'; s.checkpointHp = 0; s.orbHp = 0; s.orbTurns = 0;
    if (!s.rewardClaimed) { s.rewardClaimed = true; s.supplies.owned.elytra = true; emit('victory', 1); }
    note('エンドラを たおした！ エリトラを てにいれた！'); return finish();
  }
  const changePhase = () => {
    if (s.phase === 'crystals' && brokenCrystals(s) === 8) {
      s.finalEntryHp = s.bodyHp; s.phase = 'wings';
    }
    if (s.finalEntryHp !== null && s.phase === 'wings' && s.bodyHp * 3 <= s.finalEntryHp * 2) s.phase = 'orb';
    if (s.finalEntryHp !== null && s.phase === 'orb' && s.bodyHp * 3 <= s.finalEntryHp) s.phase = 'rage';
    if (s.phase !== oldPhase) {
      s.intentIndex = 0; s.orbHp = 0; s.orbTurns = 0; s.checkpointHp = s.bodyHp;
      if (s.adventure) { s.adventure.pattern = 0; s.adventure.pressure = 0; }
      if (s.landingTurns > 0) s.safePending = true; else s.safePreparation = true;
      if (s.selected !== 'body' && campaignTargetHp(s, s.selected) === 0) s.selected = 'body';
      emit('phase'); note(s.phase === 'wings' ? 'かいふくの ひかりが きえた！' : s.phase === 'orb' ? 'おおきな たまが あらわれる！' : 'さいごの たたかい！');
      return true;
    }
    return false;
  };
  const changed = changePhase();
  let taken = 0;
  const advanceIntent = () => {
    s.intentIndex = (s.intentIndex + 1) % PHASE_CYCLES[s.phase].length;
    if (s.adventure && s.intentIndex === 0) s.adventure.pattern = (s.adventure.pattern + 1) % DRAGON_ADVENTURE_CYCLES[s.phase].length;
  };
  if (oldLanding > 0) { if (!stagger) s.landingTurns = Math.max(0, oldLanding - 1); }
  else if (changed) { /* Transition cancels the old phase's counter, never an extra attack. */ }
  else if (stagger) {
    if (s.adventure && oldPhase === 'rage') s.intentIndex = PHASE_CYCLES.rage.indexOf('opening');
    else advanceIntent();
  }
  else if (oldEffects.stun > 0 && !special && !bed && !reflected && campaignRawDamage(input, oldIntent) > 0) {
    s.effects.stun = Math.max(0, s.effects.stun - 1); emit('stun', s.effects.stun); note('しびれて うごけない！');
    if (oldIntent === 'gust') s.orbTurns = 1;
    else {
      if (oldIntent === 'orbFire') { s.orbHp = 0; s.orbTurns = 0; if (s.selected === 'orb') s.selected = 'body'; }
      advanceIntent();
    }
  }
  else if (special || bed) {
    emit('interrupt', 0, { intent: oldIntent });
    if (s.orbHp > 0) { s.orbHp = 0; s.orbTurns = 0; if (s.selected === 'orb') s.selected = 'body'; }
    if (['charge', 'charge1', 'charge2'].includes(oldIntent)) s.intentIndex = PHASE_CYCLES[s.phase].indexOf('opening');
    else if (oldIntent === 'orbPrepare') s.intentIndex = 0;
    else if (!['gust', 'orbFire'].includes(oldIntent)) advanceIntent();
  } else if (reflected) { /* The reflected orb cancels its counter. */ }
  else if (oldIntent === 'orbPrepare') { s.orbHp = 8; s.orbTurns = 2; s.intentIndex = 0; }
  else {
    taken = incomingDamage(s.equipment, campaignRawDamage(input, oldIntent), ['breath', 'orbFire', 'storm'].includes(oldIntent) ? 'fire' : 'physical', guarding);
    const incomingBeforeWard = taken;
    if (taken > 0 && s.effects.water > 0) { taken = Math.ceil(taken / 2); s.effects.water--; emit('waterWard', taken); }
    if (taken > 0 && s.effects.light > 0) {
      const absorbed = Math.min(taken, s.effects.light); taken -= absorbed; s.effects.light -= absorbed;
      emit('lightReserve', absorbed, { message: 'まもった' });
    }
    if (incomingBeforeWard > 0) emit('counter', Math.min(s.hp, taken), { intent: oldIntent });
    if (oldIntent === 'gust') s.orbTurns = 1;
    else if (oldIntent === 'orbFire') { s.orbHp = 0; s.orbTurns = 0; if (s.selected === 'orb') s.selected = 'body'; }
    else {
      if (oldIntent === 'breath' && s.phase === 'crystals') s.barrierTurns = 2;
      advanceIntent();
    }
  }
  if (s.adventure && guarding && oldLanding === 0 && taken > 0 && s.hp > taken && isDragonHeavyIntent(oldIntent)) {
    s.adventure.counter = true; emit('counterReady'); note('うけとめた！ つぎの こうげきで かえすぞ！');
    if (s.phase === 'rage' || s.phase === 'wings' && brokenWings(s) === 2) {
      s.landingTurns = 2; s.safePending = true; emit('landing', 2);
    }
  }
  if (s.adventure && !['charge1', 'charge2'].includes(oldIntent)) s.adventure.pressure = 0;
  if (oldBarrier > 0) s.barrierTurns = Math.max(0, oldBarrier - 1);
  if (s.landingTurns === 0 && s.safePending) { s.safePending = false; s.safePreparation = true; }
  s.hp = Math.max(0, s.hp - taken);
  if (s.hp === 0) {
    const rollback = Math.max(0, s.checkpointHp - s.bodyHp);
    s.bodyHp = s.checkpointHp;
    s.crystals = s.crystals.map((hp, index) => hp > 0 ? crystalMaxHp(index) : 0);
    s.wings = s.wings.map(hp => hp > 0 ? 48 : 0);
    s.orbHp = 0; s.orbTurns = 0; s.landingTurns = 0; s.barrierTurns = 0; s.gauge = 0; s.hands = 0;
    s.status = 'lost'; s.defeats++; s.selected = 'body'; s.intentIndex = 0;
    s.effects = emptyDragonEffects();
    s.safePreparation = true; s.safePending = false; emit('defeat', rollback); note('たおされた…。こわしたところは のこっているよ。');
    if (s.adventure) { s.adventure.counter = false; s.adventure.pressure = 0; }
  }
  return finish();
}

export function validEquipment(value: unknown): value is CampaignEquipment {
  if (!value || typeof value !== 'object') return false;
  const eq = value as CampaignEquipment;
  const rank = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 3;
  return ['none', 'wood', 'stone', 'iron', 'gold', 'diamond', 'netherite'].includes(eq.sword) && typeof eq.shield === 'boolean'
    && !!eq.armor && ['helmet', 'chest', 'leggings', 'boots'].every(slot => ['none', 'gold', 'iron', 'diamond', 'netherite'].includes(eq.armor[slot as keyof typeof eq.armor]))
    && !!eq.attack && ['none', 'power', 'ultimate', 'break'].includes(eq.attack.kind) && rank(eq.attack.rank)
    && !!eq.defense && ['none', 'protection', 'health', 'fire'].includes(eq.defense.kind) && rank(eq.defense.rank)
    && Array.isArray(eq.buddies) && eq.buddies.length <= 3 && new Set(eq.buddies.map(b => b?.id)).size === eq.buddies.length
    && eq.buddies.every(b => b && typeof b.id === 'string' && Number.isInteger(b.level) && b.level >= 1 && b.level <= 10 && typeof b.image === 'string' && b.image.startsWith('/stickers/'));
}

/** Exact schema validation: reject incompatible/corrupt saves, never migrate old real saves. */
export function isDragonCampaign(value: unknown): value is DragonCampaign {
  if (!value || typeof value !== 'object') return false;
  const s = value as DragonCampaign;
  const int = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
  const record = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v);
  if (s.version !== 1 || typeof s.id !== 'string' || !validCampaignDay(s.day) || !validEquipment(s.equipment)) return false;
  if (!['preparation', 'battle', 'paused', 'lost', 'won'].includes(s.status) || !['crystals', 'wings', 'orb', 'rage'].includes(s.phase)) return false;
  if (s.bodyMaxHp !== undefined && !int(s.bodyMaxHp, DRAGON_BODY_HP, 6000)) return false;
  if (!int(s.hp, 0, maxHp(s.equipment)) || !int(s.bodyHp, 0, campaignBodyMaxHp(s)) || !int(s.checkpointHp, s.bodyHp, campaignBodyMaxHp(s))) return false;
  if (s.finalEntryHp !== null && !int(s.finalEntryHp, 1, campaignBodyMaxHp(s))) return false;
  if (!Array.isArray(s.crystals) || s.crystals.length !== 8 || !s.crystals.every((hp, i) => int(hp, 0, crystalMaxHp(i)))) return false;
  if (!Array.isArray(s.wings) || s.wings.length !== 2 || !s.wings.every(hp => int(hp, 0, 48))) return false;
  if (!s.supplies || !record(s.supplies.materials) || !record(s.supplies.owned) || typeof s.supplies.hasTable !== 'boolean' || !int(s.supplies.partySlots, 1, 3)) return false;
  if (Object.values(s.supplies.materials).some(n => !int(n, 0, 1000000)) || Object.values(s.supplies.owned).some(v => typeof v !== 'boolean')) return false;
  for (const [key, max] of [['revision', 10000000], ['tickets', 1000000], ['hands', 4], ['gauge', 3], ['foodToday', 2], ['bedsUsed', 3], ['orbHp', 8], ['orbTurns', 2], ['intentIndex', PHASE_CYCLES[s.phase].length - 1], ['landingTurns', 2], ['barrierTurns', 2], ['turns', 10000000], ['bodyAttempts', 10000000], ['defeats', 1000000], ['seed', 4294967295]] as const) if (!int(s[key], 0, max)) return false;
  if (typeof s.safePreparation !== 'boolean' || typeof s.safePending !== 'boolean' || typeof s.rewardClaimed !== 'boolean' || !Array.isArray(s.log) || s.log.length > 12 || !s.log.every(line => typeof line === 'string' && line.length <= 500)) return false;
  if (typeof s.selected !== 'string' || !/^(body|orb|crystal:[0-7]|wing:[01])$/.test(s.selected)) return false;
  if (s.status === 'won' && (s.bodyHp !== 0 || !s.rewardClaimed)) return false;
  if (s.status !== 'won' && (s.bodyHp === 0 || s.rewardClaimed)) return false;
  if (s.status === 'battle' && s.hp === 0) return false;
  if (s.status === 'lost' && (s.hands !== 0 || s.gauge !== 0)) return false;
  if (s.phase !== 'crystals' && (brokenCrystals(s) !== 8 || s.finalEntryHp === null)) return false;
  if ((s.orbHp > 0) !== (s.orbTurns > 0) || (s.orbHp > 0 && s.phase !== 'orb')) return false;
  if (s.adventure !== undefined && (!s.adventure || s.adventure.version !== 1 || !int(s.adventure.beat, 0, 10000000) || !int(s.adventure.pattern, 0, 1)
    || typeof s.adventure.counter !== 'boolean' || !int(s.adventure.pressure, 0, 1))) return false;
  if (s.skills !== undefined) {
    const skills = s.skills;
    if (!skills || skills.version !== 1 || !int(skills.casts, 0, 10000000) || skills.last !== null && !SAVED_SKILL_KINDS.includes(skills.last)) return false;
    if (skills.pending !== null) {
      const p = skills.pending;
      if (!p || typeof p.token !== 'string' || p.token.length < 1 || p.token.length > 600 || s.status !== 'battle' || s.gauge !== 3 || s.hands === 0 && s.tickets === 0
        || typeof p.target !== 'string' || campaignTargetHp(s, p.target) <= 0 || p.mode !== null && !SAVED_SKILL_KINDS.includes(p.mode)) return false;
    }
  }
  if (s.critical !== undefined && !validDragonCritical(s.critical)) return false;
  if (s.allySeed !== undefined && !int(s.allySeed, 0, 4294967295)) return false;
  if (s.unlockedSkills !== undefined && !validSkillUnlocks(s.unlockedSkills)) return false;
  if (s.rescueSeen !== undefined && typeof s.rescueSeen !== 'boolean') return false;
  if (s.effects !== undefined && !validDragonEffects(s.effects)) return false;
  if (s.heldItem !== undefined && !['none', 'shield', 'water'].includes(s.heldItem)) return false;
  return true;
}
