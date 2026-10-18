import { BLAZE_ACTIONS_PER_TICKET, blazeArmorReductionRate, blazeAttackDamage, blazeFullArmor, type BlazeLoadout } from './blazePrototypeEngine';
import { incomingDamage } from './campaignEquipment';

export const ENDERMAN_ACTIONS_PER_TICKET = BLAZE_ACTIONS_PER_TICKET;
export type EndermanItem = 'none' | 'water' | 'stone' | 'shield';
export type EndermanIntent = 'warp' | 'ambush' | 'approach' | 'opening';
export type EndermanSetup = { loadout: BlazeLoadout; item: EndermanItem; startHp: 'full' | 'half' };
export type EndermanRun = EndermanSetup & {
  hp: number; maxHp: number; enemyHp: number; enemyMaxHp: number;
  tickets: number; handsLeft: number; bread: number; gauge: number; turn: number;
  intent: EndermanIntent; phase: 'battle' | 'won' | 'lost' | 'returned';
  pearls: number; misses: number; log: string[];
};
export type EndermanAction = { kind: 'strike' | 'ultimate' | 'guard' | 'eat' | 'return' } | { kind: 'equip'; item: EndermanItem };
export type EndermanEvent = { kind: 'hit' | 'miss' | 'guard' | 'pin' | 'splash' | 'counter' | 'heal' | 'kill'; amount: number };
export type EndermanOutcome = { state: EndermanRun; events: EndermanEvent[]; error?: string };

export function createEndermanRun(options: Partial<EndermanSetup> = {}): EndermanRun {
  const loadout = options.loadout ?? { sword: 'diamond', armor: blazeFullArmor('iron') };
  return {
    loadout: { ...loadout, armor: { ...loadout.armor } }, item: options.item ?? 'none', startHp: options.startHp ?? 'full',
    hp: options.startHp === 'half' ? 10 : 20, maxHp: 20, enemyHp: 36, enemyMaxHp: 36,
    tickets: 4, handsLeft: 0, bread: 2, gauge: 0, turn: 0, intent: 'warp', phase: 'battle',
    pearls: 0, misses: 0, log: ['エンダーマンが あらわれた！ むらさきの つぶが まっている…。'],
  };
}

export function endermanAttackDamage(run: Pick<EndermanRun, 'loadout' | 'item'>, ultimate = false): number {
  return blazeAttackDamage(run.loadout, ultimate) + (run.item === 'water' ? 3 : 0) * (ultimate ? 2 : 1);
}

/** Apply water's 90% cut after material-weighted armor, rounding only once. */
export function endermanIncomingDamage(run: Pick<EndermanRun, 'loadout' | 'item' | 'intent'>, guarding = false): number {
  const raw = run.intent === 'approach' ? 16 : run.intent === 'ambush' ? 18 : 0;
  if (run.loadout.magic) return Math.ceil(incomingDamage({ ...run.loadout, ...run.loadout.magic, shield: run.item === 'shield', buddies: [] }, raw, 'physical', guarding) / (run.item === 'water' ? 10 : 1));
  const armorPoints = Math.round(blazeArmorReductionRate(run.loadout) * 2400);
  const remaining = guarding ? run.item === 'shield' ? 2 : 5 : 10;
  return Math.ceil(raw * (2400 - armorPoints) * remaining / (run.item === 'water' ? 240000 : 24000));
}

/** Pure rules: no random misses, storage, real inventory or timers. */
export function actOnEnderman(run: EndermanRun, action: EndermanAction): EndermanOutcome {
  const reject = (error: string): EndermanOutcome => ({ state: run, events: [], error });
  if (run.phase !== 'battle' || run.hp <= 0 || run.enemyHp <= 0) return reject('この たたかいは おわっているよ。');
  if (!['strike', 'ultimate', 'guard', 'eat', 'return', 'equip'].includes(action.kind)) return reject('こうどうを えらんでね。');
  if (action.kind === 'equip' && !['none', 'water', 'stone', 'shield'].includes(action.item)) return reject('そうびを えらんでね。');
  if (action.kind === 'equip' && action.item === run.item) return { state: run, events: [] };
  if (action.kind === 'ultimate' && run.gauge < 3) return reject('ひかりが 3こ ひつようだよ。');
  if (action.kind !== 'return' && run.handsLeft <= 0 && run.tickets <= 0) return reject('チケットが ないよ。');
  if (action.kind === 'eat' && (run.bread <= 0 || run.hp >= run.maxHp)) return reject('いまは パンを たべられないよ。');

  const state: EndermanRun = { ...run, loadout: { ...run.loadout, armor: { ...run.loadout.armor } }, log: [...run.log] };
  const events: EndermanEvent[] = [];
  const log = (message: string) => { state.log = [...state.log, message].slice(-10); };
  if (action.kind === 'equip') {
    if (state.handsLeft === 0) { state.tickets -= 1; state.handsLeft = ENDERMAN_ACTIONS_PER_TICKET; }
    state.handsLeft -= 1; state.turn += 1;
    state.item = action.item;
    log('もちものを かえた。こうどうを 1かい つかった。');
    return { state, events };
  }
  if (action.kind === 'return') {
    state.phase = 'returned'; state.handsLeft = 0;
    log('ぶじに かえった。つかった チケットは もどらない。');
    return { state, events };
  }
  if (action.kind === 'eat') {
    const amount = Math.min(10, state.maxHp - state.hp);
    state.hp += amount; state.bread -= 1;
    events.push({ kind: 'heal', amount }); log('パンで ハートが もどった！');
    return { state, events };
  }

  if (state.handsLeft === 0) { state.tickets -= 1; state.handsLeft = ENDERMAN_ACTIONS_PER_TICKET; }
  state.handsLeft -= 1; state.turn += 1;
  const special = action.kind === 'ultimate', guarding = action.kind === 'guard', wet = state.item === 'water';
  const dodged = !guarding && !special && state.intent === 'warp' && !wet;
  if (guarding) {
    events.push({ kind: 'guard', amount: endermanIncomingDamage(state) - endermanIncomingDamage(state, true) });
    log(state.intent === 'warp' ? 'まもって まった！ あらわれた ところに すきが！' : 'まもった！ ダメージを へらした。');
  } else {
    state.gauge = special ? 0 : Math.min(3, state.gauge + 1);
    if (dodged) {
      state.misses += 1; events.push({ kind: 'miss', amount: 0 });
      log('ワープで よけられた！ でも ひっさつの ひかりが たまった。');
    } else {
      const amount = Math.min(state.enemyHp, endermanAttackDamage(state, special));
      state.enemyHp -= amount; events.push({ kind: 'hit', amount });
      if (special) { events.push({ kind: 'pin', amount: 0 }); log('ひっさつ！ ワープごと つかまえた！'); }
      else log(`こうげき！ ${amount}ダメージ！`);
    }
  }
  if (wet && run.intent === 'warp') { events.push({ kind: 'splash', amount: 0 }); log('びくっ！ ワープが とまった！'); }
  if (state.enemyHp === 0) {
    state.phase = 'won'; state.pearls = 1; state.handsLeft = 0;
    events.push({ kind: 'kill', amount: 1 }); log('エンダーパールを 1こ てにいれた！');
    return { state, events };
  }

  // The current picture is the counter that resolves. No rerolls from eating/equipping.
  const incoming = special ? 0 : endermanIncomingDamage(run, guarding);
  if (incoming > 0) {
    state.hp = Math.max(0, state.hp - incoming);
    events.push({ kind: 'counter', amount: Math.min(run.hp, incoming) }); log('エンダーマンが とびかかってきた！');
  }
  if (special || run.intent === 'ambush' || (run.intent === 'warp' && (wet || guarding))) state.intent = 'opening';
  else if (run.intent === 'warp') state.intent = 'ambush';
  else if (run.intent === 'opening') state.intent = 'approach';
  else state.intent = 'warp';
  if (state.hp === 0) { state.phase = 'lost'; state.handsLeft = 0; state.pearls = 0; log('たおされた…。もりの ようすを おもいだしてみよう。'); }
  return { state, events };
}
