import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { freshBattleLearning, validBattleLearning } from './battleLearning';
import { ensureAdventure, transitionAdventure } from './adventureSession';
import { readAdventure, type AdventureLocation } from './adventureState';
import { emptyMiningState, normalizeMiningState, type MiningState } from './miningTypes';
import type { AdventureRequest } from './useAdventureController';
import { BattleLessonPicture, BattleTutorial } from './BattleTutorial';
import { battleTutorialLessons } from './battleTutorialRules';
import { BattleForecast } from './BattleForecast';
import { blazeForecast, dragonForecast, endermanForecast, FORECAST_MARKS } from './battleForecastRules';
import { createBlazeRun } from './blazePrototypeEngine';
import { createDragonCampaign, campaignIntent, campaignRawDamage } from './dragonCampaignEngine';

function fixture(): MiningState { const s = emptyMiningState(); return { ...s, tickets: 12, unlockedGachas: ['fortress', 'warped_forest', 'the_end'], materials: { bread: 3, water: 1 }, crafted: { sword_diamond: true } }; }
function send(s: MiningState, request: AdventureRequest, location: AdventureLocation = 'fortress') {
  return transitionAdventure(s, { ...request, revision: s.adventure?.revision ?? -1, day: '2026-10-19', location });
}
function enter(s: MiningState, location: AdventureLocation) { const r = send(s, { kind: 'enter' }, location); expect(r.error).toBeUndefined(); return r.state; }
function ack(s: MiningState, location: AdventureLocation) { const r = send(s, { kind: 'lesson' }, location); expect(r.error).toBeUndefined(); return r.state; }

describe('first-encounter learning and safe tutorial transactions', () => {
  it('does not learn from unlocked locations, projection, crafting or preparing an adventure', () => {
    const s = ensureAdventure(fixture(), '2026-10-19'); expect(s.adventure!.learning).toEqual(freshBattleLearning());
    const entered = enter(s, 'fortress'); expect(entered.adventure!.blaze!.unlockedSkills).toEqual(['repel']);
    expect(entered.adventure!.learning!.pending).toEqual({ location: 'fortress', skills: [] });
  });
  it('learns light on the Enderman first encounter, and fire/thunder only on the dragon first encounter', () => {
    let s = ack(enter(fixture(), 'fortress'), 'fortress');
    const before = JSON.stringify(s), enderman = enter(s, 'warped_forest');
    expect(JSON.stringify(s)).toBe(before); s = enderman;
    expect(s.adventure!.learning!.pending).toEqual({ location: 'warped_forest', skills: ['aim'] });
    expect(s.adventure!.enderman!.unlockedSkills).toEqual(['repel', 'aim']);
    s = ack(s, 'warped_forest'); s = enter(s, 'the_end');
    expect(s.adventure!.learning!.pending).toEqual({ location: 'the_end', skills: ['burst', 'gauge'] });
    expect(s.adventure!.dragon!.unlockedSkills).toEqual(['repel', 'aim', 'burst', 'gauge']);
  });
  it('learning, page completion and repeated entry consume no tickets, actions, bread, HP or gauge', () => {
    let s = ensureAdventure(fixture(), '2026-10-19'); s.adventure!.hands = 2; s.adventure!.gauge = 2; s.adventure!.hp = 13;
    const before = { tickets: s.tickets, materials: s.materials, hp: s.adventure!.hp, hands: s.adventure!.hands, gauge: s.adventure!.gauge };
    s = ack(enter(s, 'warped_forest'), 'warped_forest'); s = enter(s, 'warped_forest');
    expect({ tickets: s.tickets, materials: s.materials, hp: s.adventure!.hp, hands: s.adventure!.hands, gauge: s.adventure!.gauge }).toEqual(before);
    expect(s.adventure!.learning!.pending).toBeNull(); expect(s.adventure!.enderman!.turn).toBe(0);
  });
  it('persists a pending introduction, does not duplicate it on reload, and does not offer it after acknowledgement', () => {
    let s = enter(fixture(), 'warped_forest'); s = normalizeMiningState(JSON.parse(JSON.stringify(s)));
    expect(s.adventure!.learning!.pending!.skills).toEqual(['aim']);
    s = enter(s, 'warped_forest'); expect(s.adventure!.learning!.learned).toEqual(['repel', 'aim']);
    s = ack(s, 'warped_forest'); s = normalizeMiningState(JSON.parse(JSON.stringify(s))); s = enter(s, 'warped_forest');
    expect(s.adventure!.learning!.pending).toBeNull();
  });
  it('blocks battle input, another location, and wrong-location acknowledgements during the initial lesson', () => {
    const s = enter(fixture(), 'warped_forest');
    for (const [request, location] of [[{ kind: 'enderman', action: { kind: 'strike' } }, 'warped_forest'], [{ kind: 'enter' }, 'fortress'], [{ kind: 'lesson' }, 'the_end']] as const) {
      const r = send(s, request, location); expect(r.error).toBeTruthy(); expect(r.state).toBe(s);
    }
  });
  it('grandfathers existing available skills and old HP/turns without resetting resources', () => {
    const old = ensureAdventure(fixture(), '2026-10-19'); delete old.adventure!.learning;
    old.adventure!.blaze = createBlazeRun(); old.adventure!.blaze!.enemies[0].maxHp = 28; old.adventure!.blaze!.enemies[0].hp = 11; old.adventure!.blaze!.turn = 7;
    old.adventure!.hp = 9; old.adventure!.hands = 2;
    const s = enter(old, 'fortress');
    expect(s.adventure!.learning!.learned).toEqual(['repel', 'aim', 'burst', 'gauge']);
    expect(s.adventure!.blaze!.enemies[0]).toMatchObject({ maxHp: 28, hp: 11 });
    expect(s.adventure!.blaze!.turn).toBe(7); expect(s.adventure!.hp).toBe(9); expect(s.adventure!.hands).toBe(2);
    expect(s.adventure!.learning!.pending!.skills).toEqual([]);
  });
  it('never relocks an older selected skill whose location is absent in legacy unlock arrays', () => {
    const old = ensureAdventure(fixture(), '2026-10-19'); delete old.adventure!.learning; old.unlockedGachas = ['fortress'];
    old.adventure!.blaze = { ...createBlazeRun(), skills: { version: 1, casts: 2, last: 'gauge', pending: null } };
    expect(ensureAdventure(old, '2026-10-19').adventure!.learning!.learned).toContain('gauge');
  });
  it('does not create an introduction when entering a fallen profile', () => {
    const s = ensureAdventure(fixture(), '2026-10-19'); s.adventure!.hp = 0; s.adventure!.fallen = true;
    expect(enter(s, 'warped_forest').adventure!.learning!.pending).toBeNull();
  });
  it('keeps the normal next-day recovery while a picture lesson is pending', () => {
    let s = enter(fixture(), 'warped_forest'); s.adventure!.hp = 8;
    const result = transitionAdventure(s, { kind: 'enter', revision: s.adventure!.revision, day: '2026-10-20', location: 'warped_forest' });
    expect(result.error).toBeUndefined(); s = result.state;
    expect(s.adventure!.day).toBe('2026-10-20'); expect(s.adventure!.hp).toBe(20); expect(s.adventure!.learning!.pending!.skills).toEqual(['aim']);
    expect(s.tickets).toBe(12); expect(s.adventure!.hands).toBe(0);
  });
  it('keeps previously learned skills when returning to earlier enemies', () => {
    let s = ack(enter(fixture(), 'warped_forest'), 'warped_forest'); s = ack(enter(s, 'the_end'), 'the_end');
    s = ack(enter(s, 'fortress'), 'fortress');
    expect(s.adventure!.blaze!.unlockedSkills).toEqual(['repel', 'aim', 'burst', 'gauge']);
    expect(s.adventure!.learning!.pending).toBeNull();
  });
  it.each([null, {}, { ...freshBattleLearning(), version: 2 }, { ...freshBattleLearning(), learned: ['repel', 'repel'] }, { ...freshBattleLearning(), seen: { fortress: 'yes' } }, { ...freshBattleLearning(), pending: { location: 'nowhere', skills: [] } }, { ...freshBattleLearning(), pending: { location: 'warped_forest', skills: ['aim'] } }])('rejects malformed learning records without wiping saved data: %j', learning => {
    expect(validBattleLearning(learning)).toBe(false);
    const s = ensureAdventure(fixture(), '2026-10-19'); expect(() => readAdventure({ ...s.adventure, learning })).toThrow();
  });
});

describe('simple truthful forecasts and picture tutorials', () => {
  it('uses the approved fist with zero to two exclamation marks', () => {
    expect(FORECAST_MARKS).toEqual({ attack: '👊', heavy: '👊！', extreme: '👊！！', charge: '💪', rest: '😴' });
    for (const signal of Object.keys(FORECAST_MARKS) as (keyof typeof FORECAST_MARKS)[]) {
      const html = renderToStaticMarkup(createElement(BattleForecast, { signal })); expect(html).toContain(FORECAST_MARKS[signal]); expect(html).toContain('role="img"');
    }
  });
  it('distinguishes charging from no attack and reflects stun without spending it on charging', () => {
    expect(blazeForecast('ember')).toBe('attack'); expect(blazeForecast('burst')).toBe('heavy'); expect(blazeForecast('charge', true)).toBe('charge'); expect(blazeForecast('burst', true)).toBe('rest');
    expect(endermanForecast('warp')).toBe('rest'); expect(endermanForecast('ambush')).toBe('heavy'); expect(endermanForecast('approach', true)).toBe('rest');
    expect(dragonForecast('storm')).toBe('extreme'); expect(dragonForecast('orbFire')).toBe('heavy'); expect(dragonForecast('gust')).toBe('attack');
    expect(dragonForecast('charge2', true)).toBe('charge'); expect(dragonForecast('breath', true)).toBe('rest');
  });
  it('matches every dragon phase forecast to whether its actual counter can attack', () => {
    const s = createDragonCampaign('2026-10-19');
    for (const phase of ['crystals', 'wings', 'orb', 'rage'] as const) for (let index = 0; index < 5; index++) {
      s.phase = phase; s.intentIndex = index; const intent = campaignIntent(s), mark = dragonForecast(intent);
      expect(['attack', 'heavy', 'extreme'].includes(mark)).toBe(campaignRawDamage(s, intent) > 0);
    }
    s.landingTurns = 1; expect(dragonForecast(campaignIntent(s))).toBe('rest');
  });
  it('puts newly learned effects first, explains all three effects visually, and never reveals held-water counters', () => {
    const enderman = battleTutorialLessons('warped_forest', ['repel', 'aim'], ['aim']); expect(enderman[0].skill).toBe('aim'); expect(enderman[0].fresh).toBe(true);
    const dragon = battleTutorialLessons('the_end', ['repel', 'aim', 'burst', 'gauge'], ['burst', 'gauge']); expect(dragon.slice(0, 2).map(p => p.skill)).toEqual(['burst', 'gauge']);
    for (const page of dragon.filter(p => p.skill)) {
      const html = renderToStaticMarkup(createElement(BattleLessonPicture, { page, location: 'the_end' })); expect(html).toContain(`bl-${page.skill}`); expect(html).not.toContain('<canvas');
    }
    const html = renderToStaticMarkup(createElement(BattleTutorial, { location: 'warped_forest', unlocked: ['repel', 'aim'], fresh: ['aim'], onDone() {} }));
    expect(html).toContain('おぼえた'); expect(html).toContain('bl-hearts'); expect(html).not.toContain('もちもの'); expect(html).not.toContain('EndermanPond');
  });
});
