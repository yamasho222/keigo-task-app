import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { enableBattleSkills } from './battleSkillRules';
import { actOnBlaze, createBlazeRun, blazeFullArmor, type BlazeRun } from './blazePrototypeEngine';
import { actOnEnderman, createEndermanRun, type EndermanRun } from './endermanPrototypeEngine';
import { enableDragonSkills } from './dragonSkillRules';
import { createDragonCampaign, stepDragonCampaign, type DragonCampaign } from './dragonCampaignEngine';
import { emptyDragonEffects } from './dragonBattleEffects';
import { buildCampaignPlayback } from './dragonCampaignPlayback';
import { emptyMiningState, normalizeMiningState, type MiningState } from './miningTypes';
import { transitionAdventure, type AdventureCommand } from './adventureSession';
import { readAdventure, type AdventureLocation } from './adventureState';
import { BattleSkillActivity } from './BattleSkillActivity';
import { DragonCompanionRescue } from './DragonCompanionRescue';

function fixture(stage: AdventureLocation): MiningState {
  const s = emptyMiningState();
  return { ...s, tickets: 30, unlockedGachas: ['fortress', ...(stage !== 'fortress' ? ['warped_forest' as const] : []), ...(stage === 'the_end' ? ['the_end' as const] : [])],
    crafted: { sword_diamond: true, helmet_diamond: true, chest_diamond: true, leggings_diamond: true, boots_diamond: true },
    equipped: { ...s.equipped, helmet: 'helmet_diamond', chest: 'chest_diamond', leggings: 'leggings_diamond', boots: 'boots_diamond' },
    materials: { ancient_debris: 1, bread: 4, water: 1, shield: 1 } };
}
function command(s: MiningState, request: Omit<Extract<AdventureCommand, { kind: 'blaze' }>, 'day' | 'revision' | 'location'> | Omit<Extract<AdventureCommand, { kind: 'enderman' }>, 'day' | 'revision' | 'location'> | { kind: 'enter' | 'next' }, location: AdventureLocation = 'fortress') {
  let result = transitionAdventure(s, { ...request, revision: s.adventure?.revision ?? -1, day: '2026-10-18', location } as AdventureCommand);
  if (result.state.adventure?.learning?.pending && request.kind === 'enter') result = transitionAdventure(result.state, { kind: 'lesson', revision: result.state.adventure.revision, day: '2026-10-18', location });
  expect(result.error).toBeUndefined(); expect(() => readAdventure(result.state.adventure)).not.toThrow(); return result;
}
function dragonCast(s: DragonCampaign, mode: 'burst' | 'gauge' | 'repel' | 'aim', score = 0) {
  const begun = stepDragonCampaign(s, { kind: 'beginSkill' }); expect(begun.error).toBeUndefined();
  const picked = stepDragonCampaign(begun.state, { kind: 'chooseSkill', token: begun.state.skills!.pending!.token, mode }); expect(picked.error).toBeUndefined();
  return stepDragonCampaign(picked.state, { kind: 'releaseSkill', token: picked.state.skills!.pending!.token, score });
}
function smallCast<T extends BlazeRun | EndermanRun>(s: T, score: number, mode: 'repel' | 'aim' | 'gauge' | 'burst' = 'repel'): T {
  if ('enemies' in s) {
    let r = actOnBlaze(s, { kind: 'beginSkill' }); expect(r.error).toBeUndefined();
    if (!r.state.skills!.pending!.mode) r = actOnBlaze(r.state, { kind: 'chooseSkill', token: r.state.skills!.pending!.token, mode });
    const result = actOnBlaze(r.state, { kind: 'releaseSkill', token: r.state.skills!.pending!.token, score }); expect(result.error).toBeUndefined(); return result.state as T;
  }
  let r = actOnEnderman(s, { kind: 'beginSkill' }); expect(r.error).toBeUndefined();
  if (!r.state.skills!.pending!.mode) r = actOnEnderman(r.state, { kind: 'chooseSkill', token: r.state.skills!.pending!.token, mode });
  const result = actOnEnderman(r.state, { kind: 'releaseSkill', token: r.state.skills!.pending!.token, score }); expect(result.error).toBeUndefined(); return result.state as T;
}

describe('progressive free-choice ultimates', () => {
  it.each(['fortress', 'warped_forest', 'the_end'] as const)('does not teach new skills just because a later location is unlocked: %s', stage => {
    const s = command(fixture(stage), { kind: 'enter' }).state;
    expect(s.adventure!.blaze!.unlockedSkills).toEqual(['repel']);
    expect(normalizeMiningState(JSON.parse(JSON.stringify(s))).adventure).toEqual(s.adventure);
  });
  it('skips the picker only for a single unlocked game, without spending resources', () => {
    const initial = { ...enableBattleSkills(createBlazeRun(), ['repel']), gauge: 3 };
    const result = actOnBlaze(initial, { kind: 'beginSkill' });
    expect(result.state.skills!.pending!.mode).toBe('repel');
    expect(result.state.tickets).toBe(initial.tickets); expect(result.state.handsLeft).toBe(0); expect(result.state.turn).toBe(0);
    expect(actOnBlaze(result.state, { kind: 'cancelSkill' }).error).toBeTruthy();
  });
  it('allows every unlocked choice and repeating the same ultimate; rejects locked choices', () => {
    let initial = enableBattleSkills(createEndermanRun(), ['repel', 'aim']); initial.gauge = 3;
    const begun = actOnEnderman(initial, { kind: 'beginSkill' }).state, token = begun.skills!.pending!.token;
    expect(begun.skills!.pending!.mode).toBeNull();
    expect(actOnEnderman(begun, { kind: 'chooseSkill', token, mode: 'gauge' }).error).toBeTruthy();
    const cancelled = actOnEnderman(begun, { kind: 'cancelSkill' }).state; expect(cancelled.tickets).toBe(initial.tickets);
    initial = smallCast(initial, 0, 'aim'); initial.gauge = 3;
    const again = smallCast(initial, 0, 'aim'); expect(again.skills!.casts).toBe(2); expect(again.skills!.last).toBe('aim');
  });
  it('persists and locks a selected game across locations, day refresh and duplicate release', () => {
    let s = command(fixture('warped_forest'), { kind: 'enter' }, 'warped_forest').state;
    s.adventure!.gauge = 3;
    s = command(s, { kind: 'enderman', action: { kind: 'beginSkill' } }, 'warped_forest').state;
    const token = s.adventure!.enderman!.skills!.pending!.token;
    s = command(s, { kind: 'enderman', action: { kind: 'chooseSkill', token, mode: 'aim' } }, 'warped_forest').state;
    s = normalizeMiningState(JSON.parse(JSON.stringify(s)));
    const blocked = transitionAdventure(s, { kind: 'enter', revision: s.adventure!.revision, day: '2026-10-19', location: 'fortress' }); expect(blocked.error).toBeTruthy();
    const first = command(s, { kind: 'enderman', action: { kind: 'releaseSkill', token, score: 0 } }, 'warped_forest');
    expect(first.state.tickets).toBe(29); expect(first.state.adventure!.hands).toBe(3); expect(first.state.adventure!.foodToday).toBe(0);
    const duplicate = transitionAdventure(first.state, { kind: 'enderman', action: { kind: 'releaseSkill', token, score: 100 }, revision: first.state.adventure!.revision, day: '2026-10-18', location: 'warped_forest' });
    expect(duplicate.error).toBeTruthy(); expect(duplicate.state).toBe(first.state);
  });
  it('has large icon choices, no locked cards, and no forced automatic loop', () => {
    const s = enableBattleSkills(createEndermanRun(), ['repel', 'aim']); s.gauge = 3;
    const begun = actOnEnderman(s, { kind: 'beginSkill' }).state;
    const html = renderToStaticMarkup(createElement(BattleSkillActivity, { skills: begun.skills, unlocked: s.unlockedSkills!, liveToken: '', sound: false, reduced: true, onAction() {} }));
    expect(html).toContain('みずのひっさつ'); expect(html).toContain('ひかりのひっさつ'); expect(html).not.toContain('かみなりのひっさつ');
  });
});

describe('actual small-battle budgets', () => {
  it.each([['diamond', 0, 20], ['diamond', 50, 24], ['diamond', 100, 28], ['netherite', 0, 30], ['netherite', 50, 36], ['netherite', 100, 42]] as const)('%s score %i deals %i in four attacking actions before HP capping', (sword, score, expected) => {
    let s = enableBattleSkills(createBlazeRun({ loadout: { sword, armor: blazeFullArmor('diamond') } }), ['repel']); s.enemies[0].hp = 100; s.enemies[0].maxHp = 100;
    for (let i = 0; i < 3; i++) s = actOnBlaze(s, { kind: 'strike', target: { enemyId: 0, part: 'body' } }).state;
    s = smallCast(s, score); expect(100 - s.enemies[0].hp).toBe(expected); expect(s.tickets).toBe(3); expect(s.handsLeft).toBe(0);
  });
  it.each([['diamond', 0, 7], ['diamond', 50, 6], ['diamond', 100, 6], ['netherite', 0, 5], ['netherite', 50, 5], ['netherite', 100, 4]] as const)('water-held %s score %i beats 52 HP in %i actions, including real enemy turns', (sword, score, turns) => {
    let s = enableBattleSkills(createEndermanRun({ item: 'water', loadout: { sword, armor: blazeFullArmor('iron') } }), ['repel', 'aim']);
    for (let i = 0; i < 16 && s.phase === 'battle'; i++) s = s.gauge === 3 ? smallCast(s, score) : actOnEnderman(s, { kind: 'strike' }).state;
    expect(s.phase).toBe('won'); expect(s.turn).toBe(turns); expect(s.hp).toBeGreaterThan(0); expect(s.bread).toBe(2);
  });
  it('keeps two leftover actions on victory, pays no extra on next enemy, and grants loot once', () => {
    let s = command(fixture('fortress'), { kind: 'enter' }).state; s.adventure!.hands = 3; s.adventure!.blaze!.enemies[0].hp = 1;
    s = command(s, { kind: 'blaze', action: { kind: 'strike', target: { enemyId: 0, part: 'body' } } }).state;
    expect(s.adventure!.hands).toBe(2); expect(s.adventure!.blaze!.handsLeft).toBe(2); expect(s.materials.blaze_rod).toBe(1);
    s = command(s, { kind: 'next' }).state;
    s = command(s, { kind: 'blaze', action: { kind: 'guard' } }).state;
    expect(s.tickets).toBe(30); expect(s.adventure!.hands).toBe(1); expect(s.materials.blaze_rod).toBe(1);
  });
  it('retains unfinished legacy enemy HP, then applies new maxima to the next encounter', () => {
    let s = command(fixture('warped_forest'), { kind: 'enter' }, 'warped_forest').state;
    s.adventure!.enderman!.enemyMaxHp = 36; s.adventure!.enderman!.enemyHp = 7;
    s = normalizeMiningState(JSON.parse(JSON.stringify(s)));
    s = command(s, { kind: 'enter' }, 'warped_forest').state; expect(s.adventure!.enderman!.enemyHp).toBe(7);
    s.adventure!.enderman!.phase = 'won'; s.adventure!.enderman!.enemyHp = 0;
    s = command(s, { kind: 'next' }, 'warped_forest').state; expect(s.adventure!.enderman!.enemyHp).toBe(52);
  });
});

describe('distinct elements and the companion rescue', () => {
  function readyDragon() { const s = enableDragonSkills(createDragonCampaign('2026-10-18')); s.status = 'battle'; s.phase = 'wings'; s.crystals.fill(0); s.gauge = 3; s.equipment.buddies = []; s.finalEntryHp = 1200; return s; }
  it('thunder stops exactly the next attack, advances its telegraph, and does not waste itself on charging', () => {
    let s = dragonCast(readyDragon(), 'gauge').state; expect(s.effects!.stun).toBe(1);
    s.intentIndex = 2; // wings charge is not an attack
    s = stepDragonCampaign(s, { kind: 'guard' }).state; expect(s.effects!.stun).toBe(1);
    const next = stepDragonCampaign(s, { kind: 'guard' }); expect(next.events.some(e => e.kind === 'counter')).toBe(false); expect(next.state.effects!.stun).toBe(0); expect(next.state.intentIndex).not.toBe(s.intentIndex);
  });
  it('thunder cancels an orb attack and removes the orb rather than delaying the same attack', () => {
    const s = readyDragon(); s.phase = 'orb'; s.bodyHp = 800; s.checkpointHp = 800; s.orbHp = 8; s.orbTurns = 1; s.effects = { ...emptyDragonEffects(), stun: 1 };
    const next = stepDragonCampaign(s, { kind: 'guard' }); expect(next.state.orbHp).toBe(0); expect(next.state.orbTurns).toBe(0); expect(next.events.some(e => e.kind === 'counter')).toBe(false);
  });
  it('stopping the gust advances the orb to its final warning, without repeating the same gust', () => {
    const s = readyDragon(); s.phase = 'orb'; s.bodyHp = 800; s.checkpointHp = 800; s.orbHp = 8; s.orbTurns = 2; s.effects = { ...emptyDragonEffects(), stun: 1 };
    const next = stepDragonCampaign(s, { kind: 'guard' }); expect(next.state.orbHp).toBe(8); expect(next.state.orbTurns).toBe(1); expect(next.state.effects!.stun).toBe(0);
  });
  it('does not multiply an ultimate enchant or the hidden +6 bonus again with game score', () => {
    const loadout = { sword: 'diamond' as const, armor: blazeFullArmor('iron'), magic: { attack: { kind: 'ultimate' as const, rank: 3 as const }, defense: { kind: 'none' as const, rank: 0 as const } } };
    const s = enableBattleSkills(createEndermanRun({ loadout, item: 'water' }), ['repel', 'aim']); s.gauge = 3;
    expect(smallCast(s, 100).enemyHp).toBe(52 - (8 + 12 + 6 + 8));
  });
  it('ticks burn only on paid combat actions, including guard, not picker/eating/equipment', () => {
    const s = enableBattleSkills(createEndermanRun({ item: 'water' }), ['repel', 'aim', 'burst', 'gauge']); s.gauge = 3; s.enemyHp = 100; s.enemyMaxHp = 100;
    const burned = smallCast(s, 0, 'burst'); expect(burned.effects!.burn).toBe(3); expect(burned.enemyHp).toBe(86);
    burned.hp = 10; const eaten = actOnEnderman(burned, { kind: 'eat' }).state; expect(eaten.effects!.burn).toBe(3); expect(eaten.enemyHp).toBe(86);
    const hit = actOnEnderman(eaten, { kind: 'guard' }); expect(hit.events.find(e => e.kind === 'burn')!.amount).toBe(5); expect(hit.state.effects!.burn).toBe(2);
  });
  it('a water ultimate never grants the hidden held-water damage, dodge prevention or 90% reduction', () => {
    let s = enableBattleSkills(createEndermanRun(), ['repel', 'aim']); s.gauge = 3;
    s = smallCast(s, 0); expect(s.item).toBe('none'); expect(s.effects!.water).toBe(2);
    s.intent = 'warp'; const miss = actOnEnderman(s, { kind: 'strike' }); expect(miss.events.some(e => e.kind === 'miss')).toBe(true); expect(miss.state.effects!.water).toBe(2);
    s.intent = 'approach'; const hit = actOnEnderman(s, { kind: 'strike' }); expect(hit.state.hp).toBe(s.hp - 6); expect(hit.events.find(e => e.kind === 'hit')!.amount).toBe(4);
  });
  it('light restores four HP without eating bread, and protects full-health users from wasted healing', () => {
    const s = enableBattleSkills(createEndermanRun(), ['repel', 'aim']); s.gauge = 3; s.hp = 10;
    const healed = smallCast(s, 0, 'aim'); expect(healed.hp).toBe(14); expect(healed.bread).toBe(2);
    s.hp = 20; const shielded = smallCast(s, 0, 'aim'); expect(shielded.effects!.light).toBe(4);
  });
  it('still presents an enemy attack when the light barrier absorbs all its damage', () => {
    const blaze = createBlazeRun(); blaze.enemies[0].intent = 'ember'; blaze.effects = { ...emptyDragonEffects(), light: 4 };
    const a = actOnBlaze(blaze, { kind: 'strike', target: { enemyId: 0, part: 'body' } }); expect(a.events.find(e => e.kind === 'counter')!.amount).toBe(0); expect(a.state.hp).toBe(20);
    const enderman = createEndermanRun({ item: 'water' }); enderman.intent = 'approach'; enderman.effects = { ...emptyDragonEffects(), light: 4 };
    const b = actOnEnderman(enderman, { kind: 'strike' }); expect(b.events.find(e => e.kind === 'counter')!.amount).toBe(0); expect(b.state.hp).toBe(20);
  });
  it('presents normal companions separately with exactly one enemy counter and one paid action', () => {
    const s = readyDragon(); s.gauge = 0; s.equipment.buddies = ['a', 'b', 'c'].map(id => ({ id, image: '/stickers/mc-pig.png', level: 10 }));
    const result = stepDragonCampaign(s, { kind: 'attack' }); const playback = buildCampaignPlayback(s, result.state, { kind: 'attack' }, result.events);
    const hits = playback.frames.filter(f => f.stage === 'assistImpact'); expect(hits.map(f => f.allyHit!.id)).toEqual(['a', 'b', 'c']);
    expect(hits[0].shown.bodyHp).toBeGreaterThan(hits[1].shown.bodyHp); expect(hits[1].shown.bodyHp).toBeGreaterThan(hits[2].shown.bodyHp);
    expect(playback.frames.filter(f => f.stage === 'counter')).toHaveLength(1); expect(result.state.turns).toBe(1); expect(hits[2].shown.bodyHp).toBe(result.state.bodyHp);
  });
  it('acknowledges the first rescue exactly once with no resources or damage changed', () => {
    const s = readyDragon(); s.equipment.buddies = [{ id: 'a', image: '/stickers/mc-pig.png', level: 1 }];
    const result = stepDragonCampaign(s, { kind: 'rescue' }); expect(result.state.rescueSeen).toBe(true);
    for (const key of ['tickets', 'hands', 'hp', 'bodyHp', 'turns', 'gauge'] as const) expect(result.state[key]).toBe(s[key]);
    expect(stepDragonCampaign(result.state, { kind: 'rescue' }).state).toBe(result.state);
    const html = renderToStaticMarkup(createElement(DragonCompanionRescue, { buddies: s.equipment.buddies, reduced: true, onDone() {} }));
    expect(html).toContain('いっしょに たたかうぞ'); expect(html).toContain('/stickers/mc-pig.png'); expect(html).not.toContain('mc-sheep');
  });
});
