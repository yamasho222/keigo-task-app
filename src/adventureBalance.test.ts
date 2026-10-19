import { expect, it } from 'vitest';
import { transitionAdventure } from './adventureSession';
import { readAdventure } from './adventureState';
import { emptyMiningState, type MiningState } from './miningTypes';
import { campaignBedAvailable, campaignCounterDamage, campaignIntent, type CampaignAction, type CampaignTarget } from './dragonCampaignEngine';
import { dragonFocusTarget } from './dragonCampaignAdventure';
import type { AdventureRequest } from './useAdventureController';

function simulate(tier: 'mixed' | 'diamond' | 'netherite', rank: 0 | 3, score: number) {
  const base = emptyMiningState();
  let mining: MiningState = { ...base, tickets: 1000, unlockedGachas: ['wood', 'the_end'], bedCount: 3, partyIds: ['mc-sheep', 'mc-pig', 'mc-iron-golem'],
    crafted: { sword_diamond: true, ...(tier === 'netherite' ? { sword_netherite: true } : {}), enchanting_table: true },
    materials: { bread: 200, spare_bed: 3, shield: 1 }, equipped: { ...base.equipped, held: 'shield' } };
  for (const slot of ['helmet', 'chest', 'leggings', 'boots'] as const) {
    const material = tier === 'mixed' ? slot === 'chest' ? 'diamond' : 'iron' : tier;
    const id = `${slot}_${material}` as NonNullable<MiningState['equipped']['helmet']>;
    mining.crafted[id] = true; mining.equipped[slot] = id;
  }
  let day = '2026-10-18', days = 1, dailyStart = 1000;
  const command = (request: AdventureRequest) => {
    const result = transitionAdventure(mining, { ...request, revision: mining.adventure?.revision ?? -1, day, location: 'the_end' }, {
      'mc-sheep': { level: 10, xp: 0 }, 'mc-pig': { level: 10, xp: 0 }, 'mc-iron-golem': { level: 10, xp: 0 },
    });
    if (result.error) throw new Error(`${JSON.stringify(request)}: ${result.error}`);
    mining = result.state; readAdventure(mining.adventure);
    if (mining.adventure?.learning?.pending && request.kind === 'enter') command({ kind: 'lesson' });
  };
  command({ kind: 'enter' });
  mining.adventure!.attack = { kind: rank ? 'power' : 'none', rank };
  mining.adventure!.defense = { kind: rank ? 'health' : 'none', rank };
  let lastAction = '', steps = 0;
  while (mining.adventure!.dragon!.status !== 'won' && steps++ < 8000) {
    let s = mining.adventure!.dragon!;
    if (mining.adventure!.hands === 0 && dailyStart - mining.tickets >= 5 && !s.skills?.pending) {
      const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + 1); day = date.toISOString().slice(0, 10);
      days++; dailyStart = mining.tickets; command({ kind: 'enter' }); s = mining.adventure!.dragon!;
    }
    if (mining.adventure!.fallen) { command({ kind: 'retry' }); command({ kind: 'enter' }); continue; }
    if (s.foodToday < 2 && s.hp <= 10) { command({ kind: 'dragon', action: { kind: 'heal' } }); continue; }
    let target: CampaignTarget = 'body';
    if (s.landingTurns === 0) {
      if (s.phase === 'crystals') target = `crystal:${s.crystals.findIndex(hp => hp > 0)}`;
      else if (s.phase === 'wings' && s.wings.some(hp => hp > 0)) target = dragonFocusTarget(s) ?? `wing:${s.wings.findIndex(hp => hp > 0)}`;
      else if (s.orbHp > 0) target = 'orb';
    }
    if (s.selected !== target) { command({ kind: 'dragon', action: { kind: 'select', target } }); s = mining.adventure!.dragon!; }
    const special = !s.adventure?.counter && s.gauge === 3 && (target === 'orb' || s.landingTurns > 0 || campaignCounterDamage(s) > 0);
    let action: CampaignAction;
    if (special) {
      command({ kind: 'dragon', action: { kind: 'beginSkill' } });
      command({ kind: 'dragon', action: { kind: 'chooseSkill', token: mining.adventure!.dragon!.skills!.pending!.token, mode: 'repel' } });
      action = { kind: 'releaseSkill', token: mining.adventure!.dragon!.skills!.pending!.token, score };
    } else action = { kind: campaignBedAvailable(s) && (s.landingTurns > 0 || campaignCounterDamage(s) >= s.hp) ? 'bed' : ['breath', 'orbFire', 'storm'].includes(campaignIntent(s)) ? 'guard' : 'attack' };
    lastAction = action.kind; command({ kind: 'dragon', action });
  }
  const s = mining.adventure!.dragon!;
  expect(s.status, lastAction).toBe('won'); expect(mining.crafted.elytra).toBe(true);
  return { tier, rank, score, days, tickets: 1000 - mining.tickets, actions: s.turns, deaths: s.defeats };
}
it('simulates the production adapter with real inventory, shared bread and five-heart retries', () => {
  const rows = (['mixed', 'diamond', 'netherite'] as const).flatMap(tier => [0, 50, 100].map(score => simulate(tier, tier === 'mixed' ? 0 : 3, score)));
  console.info('PRODUCTION_ADVENTURE_BALANCE', JSON.stringify(rows));
  expect(rows.every(row => row.tickets > 0 && row.actions > 0)).toBe(true);
});
