import { isDragonCampaign, validCampaignDay, type DragonCampaign } from './dragonCampaignEngine';
import type { BlazeRun } from './blazePrototypeEngine';
import type { EndermanRun } from './endermanPrototypeEngine';
import type { AttackEnchant, DefenseEnchant, EnchantRank } from './campaignEquipment';

export type AdventureLocation = 'fortress' | 'warped_forest' | 'the_end';
export type AdventureState = {
  version: 1; revision: number; day: string; hp: number; hands: number; gauge: number;
  foodToday: number; fallen: boolean; seed: number; endermanDefeats: number;
  lessons: Partial<Record<AdventureLocation, boolean>>;
  attack: { kind: AttackEnchant; rank: EnchantRank };
  defense: { kind: DefenseEnchant; rank: EnchantRank };
  blaze?: BlazeRun; enderman?: EndermanRun; dragon?: DragonCampaign;
};
const int = (n: unknown, max: number) => Number.isSafeInteger(n) && Number(n) >= 0 && Number(n) <= max;
export function readAdventure(raw: unknown): AdventureState | undefined {
  if (raw === undefined) return undefined;
  const fail = () => { throw new Error('ぼうけんの記録を確認できません。上書きせず、更新を確認してください。'); };
  if (!raw || typeof raw !== 'object') return fail();
  const s = raw as AdventureState;
  if (s.version !== 1 || !int(s.revision, 1e9) || !validCampaignDay(s.day) || !int(s.hp, 26)
    || !int(s.hands, 4) || !int(s.gauge, 3) || !int(s.foodToday, 2) || !int(s.seed, 0xffffffff)
    || !int(s.endermanDefeats, 1e6) || typeof s.fallen !== 'boolean' || s.fallen !== (s.hp === 0)
    || !s.lessons || typeof s.lessons !== 'object' || Array.isArray(s.lessons) || Object.entries(s.lessons).some(([key, value]) => !['fortress', 'warped_forest', 'the_end'].includes(key) || typeof value !== 'boolean')
    || !s.attack || !['none', 'power', 'ultimate', 'break'].includes(s.attack.kind) || !int(s.attack.rank, 3)
    || !s.defense || !['none', 'protection', 'health', 'fire'].includes(s.defense.kind) || !int(s.defense.rank, 3)) return fail();
  const common = (run: BlazeRun | EndermanRun) => run && int(run.hp, 26) && int(run.maxHp, 26) && run.maxHp >= 20
    && int(run.tickets, 1e9) && int(run.gauge, 3) && int(run.bread, 1e6) && int(run.turn, 1e9)
    && ['battle', 'won', 'lost', 'returned'].includes(run.phase) && int(run.handsLeft, 4)
    && Array.isArray(run.log) && run.log.length <= 12 && run.log.every(line => typeof line === 'string' && line.length <= 500);
  if (s.blaze && (!common(s.blaze) || !Array.isArray(s.blaze.enemies) || s.blaze.enemies.length !== 1
    || !['none', 'shield'].includes(s.blaze.item) || !int(s.blaze.pendingRods, 1e9) || !int(s.blaze.securedRods, 1e9)
    || s.blaze.enemies.some(enemy => !enemy || enemy.id !== 0 || !int(enemy.hp, 28) || enemy.maxHp !== 28 || !['ember', 'charge', 'burst'].includes(enemy.intent) || !int(enemy.step, 1e9)))) return fail();
  if (s.enderman && (!common(s.enderman) || !int(s.enderman.enemyHp, 36) || s.enderman.enemyMaxHp !== 36
    || !['none', 'water', 'stone', 'shield'].includes(s.enderman.item) || !int(s.enderman.pearls, 1e9)
    || !['warp', 'ambush', 'approach', 'opening'].includes(s.enderman.intent) || !int(s.enderman.misses, 1e9))) return fail();
  if (s.dragon && !isDragonCampaign(s.dragon)) return fail();
  return structuredClone(s);
}
