import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { emptyDragonEffects, rollAllyAttack, validDragonEffects } from './dragonBattleEffects';
import { campaignCounterDamage, createDragonCampaign, isDragonCampaign, stepDragonCampaign, type DragonCampaign } from './dragonCampaignEngine';
import { enableDragonSkills, skillAt } from './dragonSkillRules';
import { buildCampaignPlayback } from './dragonCampaignPlayback';
import { BattleItemsDialog } from './BattleItemsDialog';
import { BedExplosionFx } from './DragonBattleEffectsArt';
import { actOnBlaze, createBlazeRun } from './blazePrototypeEngine';
import { actOnEnderman, createEndermanRun } from './endermanPrototypeEngine';
import { nextDragonCritical } from './dragonCriticalRules';
import { emptyMiningState, normalizeMiningState } from './miningTypes';
import { transitionAdventure, type AdventureCommand } from './adventureSession';

function battle(casts = 0): DragonCampaign {
  const s = enableDragonSkills(createDragonCampaign('2026-10-18'));
  s.status = 'battle'; s.phase = 'wings'; s.crystals.fill(0); s.finalEntryHp = 1200;
  s.equipment.buddies = []; s.gauge = 3; s.skills!.casts = casts;
  s.supplies.materials.bread = 3; s.supplies.materials.spare_bed = 3;
  return s;
}
function cast(s: DragonCampaign) {
  const begun = stepDragonCampaign(s, { kind: 'beginSkill' }).state;
  const before = stepDragonCampaign(begun, { kind: 'chooseSkill', token: begun.skills!.pending!.token, mode: skillAt(s.skills!.casts) }).state;
  const action = { kind: 'releaseSkill' as const, token: before.skills!.pending!.token, score: 100 };
  const result = stepDragonCampaign(before, action);
  expect(result.error).toBeUndefined(); expect(isDragonCampaign(result.state)).toBe(true);
  return { ...result, before, action };
}

describe('individual, persisted ally attacks', () => {
  it.each([[1, 1], [4, 1], [5, 1.2], [8, 1.2], [9, 1.3], [10, 1.3]])('level %i has expected damage %f over 100,000 draws', (level, expected) => {
    let seed = 32123, total = 0; const histogram = [0, 0, 0, 0];
    for (let i = 0; i < 100000; i++) {
      const result = rollAllyAttack([{ id: 'one', level, image: '/stickers/mc-pig.png' }], seed);
      seed = result.seed; total += result.total; histogram[result.total]++;
    }
    expect(total / 100000).toBeCloseTo(expected, 2);
    if (level >= 9) { expect(histogram[1] / 100000).toBeCloseTo(.75, 2); expect(histogram[2] / 100000).toBeCloseTo(.2, 2); expect(histogram[3] / 100000).toBeCloseTo(.05, 2); }
    else if (level >= 5) { expect(histogram[1] / 100000).toBeCloseTo(.8, 2); expect(histogram[2] / 100000).toBeCloseTo(.2, 2); }
  });
  it('rolls every unique party member independently and keeps ultimate bonuses fixed', () => {
    const s = battle(); s.equipment.buddies = ['a', 'b', 'c'].map(id => ({ id, level: 10, image: '/stickers/mc-pig.png' }));
    const first = stepDragonCampaign(s, { kind: 'attack' });
    const helper = first.events.find(event => event.kind === 'companion')!;
    expect(helper.allies).toHaveLength(3); expect(helper.amount).toBeGreaterThanOrEqual(3); expect(helper.amount).toBeLessThanOrEqual(9);
    expect(helper.allies!.reduce((sum, hit) => sum + hit.amount, 0)).toBe(helper.amount);
    expect(stepDragonCampaign(JSON.parse(JSON.stringify(s)), { kind: 'attack' })).toEqual(first);
    expect(first.state.allySeed).not.toBeUndefined();
    const ultimate = cast(s); expect(ultimate.events.find(event => event.kind === 'companion')?.amount).toBe(9);
    expect(ultimate.state.allySeed).toBe(s.allySeed);
  });
  it('does not advance the ally stream from equipment, selection, recovery or invalid actions', () => {
    const s = battle(); s.allySeed = 7733; s.hp = 10;
    for (const action of [{ kind: 'select', target: 'wing:0' }, { kind: 'heal' }, { kind: 'hold', item: 'none' }, { kind: 'attack', invalid: true }] as const) {
      if (action.kind === 'attack') s.tickets = 0;
      const result = stepDragonCampaign(s, action); expect(result.state.allySeed).toBe(7733);
    }
  });
});

describe('real ultimate status effects', () => {
  it('burns for 5 on three subsequent paid combat turns, not on menus or healing', () => {
    const result = cast(battle(0)); let s = result.state;
    expect(s.effects?.burn).toBe(3); expect(result.events.some(event => event.kind === 'burn')).toBe(false);
    s.hp = 10; s = stepDragonCampaign(s, { kind: 'heal' }).state; expect(s.effects?.burn).toBe(3);
    const beforeMenu = s.effects; s = stepDragonCampaign(s, { kind: 'select', target: 'wing:0' }).state; expect(s.effects).toEqual(beforeMenu);
    for (let i = 0; i < 3; i++) {
      const next = stepDragonCampaign(s, { kind: 'guard' });
      expect(next.events.find(event => event.kind === 'burn')?.amount).toBe(5); expect(next.state.effects?.burn).toBe(2 - i);
      expect(isDragonCampaign(next.state)).toBe(true); s = JSON.parse(JSON.stringify(next.state));
    }
    expect(stepDragonCampaign(s, { kind: 'guard' }).events.some(event => event.kind === 'burn')).toBe(false);
  });
  it('stuns one actual attack, advances the telegraph and cancels a firing orb', () => {
    let s = cast(battle(1)).state;
    expect(s.effects?.stun).toBe(1); const intent = s.intentIndex;
    const result = stepDragonCampaign(s, { kind: 'guard' });
    expect(result.events.some(event => event.kind === 'counter')).toBe(false); expect(result.state.intentIndex).not.toBe(intent);
    expect(result.state.effects?.stun).toBe(0); s = result.state;
    s.intentIndex = 0;
    expect(stepDragonCampaign(s, { kind: 'guard' }).events.some(event => event.kind === 'counter')).toBe(true);
    const orb = battle(); orb.phase = 'orb'; orb.bodyHp = 800; orb.checkpointHp = 800; orb.orbHp = 8; orb.orbTurns = 1;
    orb.effects = { ...emptyDragonEffects(), stun: 1 }; orb.selected = 'body';
    const stopped = stepDragonCampaign(orb, { kind: 'guard' }); expect(stopped.state.orbTurns).toBe(0); expect(stopped.state.orbHp).toBe(0);
  });
  it('halves two actual incoming attacks; safe/charge turns do not waste the ward', () => {
    let s = cast(battle(2)).state; expect(s.effects?.water).toBe(2);
    const baseline = { ...s, effects: emptyDragonEffects() };
    const plain = stepDragonCampaign(baseline, { kind: 'attack' });
    const guarded = stepDragonCampaign(s, { kind: 'attack' });
    expect(guarded.events.find(event => event.kind === 'counter')?.amount).toBe(Math.ceil(plain.events.find(event => event.kind === 'counter')!.amount / 2));
    expect(guarded.state.effects?.water).toBe(1); s = guarded.state;
    const charge = stepDragonCampaign(s, { kind: 'attack' }); expect(charge.state.effects?.water).toBe(1);
    const next = stepDragonCampaign(charge.state, { kind: 'guard' }); expect(next.state.effects?.water).toBe(0);
  });
  it('agrees with incoming-damage prediction when armor, shield, water and light overlap', () => {
    for (const guarding of [false, true]) for (const water of [0, 1, 2]) for (const light of [0, 1, 4]) {
      const s = battle(); s.intentIndex = 3; s.effects = { ...emptyDragonEffects(), water, light };
      const expected = campaignCounterDamage(s, guarding);
      const result = stepDragonCampaign(s, { kind: guarding ? 'guard' : 'attack' });
      expect(result.events.find(event => event.kind === 'counter')?.amount ?? 0).toBe(expected);
      expect(s.hp - result.state.hp).toBe(expected);
    }
  });
  it('heals 4 HP, stores unused recovery as at most 4 shield HP, and never resurrects overkill', () => {
    const hurt = battle(3); hurt.hp = 14;
    expect(cast(hurt).state.hp).toBe(18); expect(cast(hurt).state.effects?.light).toBe(0);
    const full = cast(battle(3)); expect(full.state.hp).toBe(20); expect(full.state.effects?.light).toBe(4);
    const normal = stepDragonCampaign({ ...full.state, effects: emptyDragonEffects() }, { kind: 'attack' });
    const protectedHit = stepDragonCampaign(full.state, { kind: 'attack' });
    expect(protectedHit.state.hp - normal.state.hp).toBe(Math.min(4, normal.events.find(event => event.kind === 'counter')!.amount));
    const lethal = battle(); lethal.hp = 1; lethal.intentIndex = 3; lethal.effects = { ...emptyDragonEffects(), light: 4 };
    const defeated = stepDragonCampaign(lethal, { kind: 'attack' }); expect(defeated.state.status).toBe('lost'); expect(defeated.state.effects).toEqual(emptyDragonEffects());
  });
  it('shows burn damage after the sword/ally hit, before any counter or victory', () => {
    const s = battle(); s.effects = { ...emptyDragonEffects(), burn: 1 };
    const result = stepDragonCampaign(s, { kind: 'attack' });
    const frames = buildCampaignPlayback(s, result.state, { kind: 'attack' }, result.events).frames;
    const impact = frames.find(frame => frame.stage === 'impact')!, effect = frames.find(frame => frame.stage === 'effect')!;
    expect(effect.shown.bodyHp).toBe(impact.shown.bodyHp - 5); expect(effect.at).toBeGreaterThan(impact.at);
    expect(frames.find(frame => frame.stage === 'counter')!.at).toBeGreaterThan(effect.at);
  });
  it('rejects corrupt effect saves and preserves valid old saves / automatic skill rotation', () => {
    const s = battle(); expect(isDragonCampaign(s)).toBe(true);
    for (const effects of [null, { ...emptyDragonEffects(), burn: 4 }, { ...emptyDragonEffects(), stun: -1 }, { ...emptyDragonEffects(), water: .5 }, { ...emptyDragonEffects(), light: 5 }]) expect(isDragonCampaign({ ...s, effects })).toBe(false);
    expect(validDragonEffects(emptyDragonEffects())).toBe(true);
    for (let i = 0; i < 4; i++) { const result = cast(battle(i)); expect(result.state.skills?.casts).toBe(i + 1); expect(result.state.skills?.last).toBe(skillAt(i)); }
  });
});

describe('universal 10% criticals and hidden items', () => {
  it('adds one sword hit for Blaze and Enderman, never turns a warp miss into a hit', () => {
    let seed = 0; while (!nextDragonCritical({ version: 1, seed }).hit) seed++;
    const critical = { version: 1 as const, seed };
    const blaze = { ...createBlazeRun(), critical }; const hit = actOnBlaze(blaze, { kind: 'strike', target: { enemyId: 0, part: 'body' } });
    expect(hit.events.find(event => event.kind === 'slash')?.amount).toBe(8); expect(hit.events.some(event => event.kind === 'critical')).toBe(true);
    const enderman = { ...createEndermanRun(), critical, intent: 'approach' as const };
    expect(actOnEnderman(enderman, { kind: 'strike' }).events.find(event => event.kind === 'hit')?.amount).toBe(8);
    const miss = actOnEnderman({ ...enderman, intent: 'warp' }, { kind: 'strike' }); expect(miss.events.some(event => event.kind === 'critical')).toBe(false); expect(miss.state.enemyHp).toBe(52);
    const water = actOnEnderman({ ...enderman, item: 'water' }, { kind: 'strike' }); expect(water.events.find(event => event.kind === 'hit')?.amount).toBe(11);
  });
  it('shares persisted critical draws across locations and round-trips through real save normalization', () => {
    let mining = emptyMiningState(); mining.unlockedGachas.push('fortress', 'warped_forest', 'the_end'); mining.tickets = 10;
    mining = transitionAdventure(mining, { kind: 'enter', revision: -1, day: '2026-10-18', location: 'fortress' }).state;
    mining = transitionAdventure(mining, { kind: 'lesson', revision: mining.adventure!.revision, day: '2026-10-18', location: 'fortress' }).state;
    const result = transitionAdventure(mining, { kind: 'blaze', action: { kind: 'strike', target: { enemyId: 0, part: 'body' } }, revision: mining.adventure!.revision, day: '2026-10-18', location: 'fortress' });
    expect(result.error).toBeUndefined(); mining = normalizeMiningState(JSON.parse(JSON.stringify(result.state)));
    const entered = transitionAdventure(mining, { kind: 'enter', revision: mining.adventure!.revision, day: '2026-10-18', location: 'warped_forest' });
    expect(entered.state.adventure?.enderman?.critical).toEqual(mining.adventure?.critical);
  });
  it('only lists owned items inside the drawer, with a recoverable bed confirmation', () => {
    const html = renderToStaticMarkup(createElement(BattleItemsDialog, { held: 'none', items: [{ id: 'spare_bed', count: 3 }], onClose() {}, onHold() {}, onBed() {}, bedAvailable: true, bedsLeft: 3 }));
    expect(html).toContain('もちもの'); expect(html).toContain('White_Bed.png'); expect(html).not.toContain('Water.png'); expect(html).not.toContain('Shield.webp');
    const closed = renderToStaticMarkup(createElement(BattleItemsDialog, { held: 'none', items: [], onClose() {}, onHold() {} })); expect(closed).not.toContain('White_Bed.png');
  });
  it('keeps the new shortcut DEV-only and free of real profile or trial-storage connections', () => {
    const main = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8');
    expect(main).toMatch(/import\.meta\.env\.DEV && new URLSearchParams\(window.location.search\).get\("battle-effects"\) === "1"/);
    const source = readFileSync(new URL('./BattleEffectsLab.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/localStorage|sessionStorage|from ['"].*(CloudAppShell|firebase|appStateStorage)/);
  });
  it('consumes exactly one bed and action, preserves the cap of three and has staged non-Canvas artwork', () => {
    const s = battle(); s.landingTurns = 2;
    const result = stepDragonCampaign(s, { kind: 'bed' }); expect(result.error).toBeUndefined(); expect(result.state.bedsUsed).toBe(1); expect(result.state.supplies.materials.spare_bed).toBe(2); expect(result.state.hands).toBe(3);
    expect(stepDragonCampaign({ ...s, bedsUsed: 3 }, { kind: 'bed' }).state).toEqual({ ...s, bedsUsed: 3 });
    for (const phase of ['windup', 'strike', 'impact', 'recover'] as const) {
      const html = renderToStaticMarkup(createElement(BedExplosionFx, { phase, reduced: false })); expect(html).not.toContain('<canvas'); expect(html).toContain('aria-hidden="true"');
      if (phase === 'windup' || phase === 'strike') expect(html).toContain('bed-prop-model'); else { expect(html).toContain('fire-core.webp'); expect(html).toContain('bed-shockwave'); expect(html).toContain('bed-smoke'); }
    }
  });
  it('commits held items and bed inventory through the real adapter, rejecting replayed consumption', () => {
    const base = emptyMiningState(); base.unlockedGachas.push('the_end'); base.tickets = 10;
    base.materials = { shield: 1, water: 1, spare_bed: 3 }; base.crafted.sword_diamond = true;
    let mining = transitionAdventure(base, { kind: 'enter', revision: -1, day: '2026-10-18', location: 'the_end' }).state;
    mining = transitionAdventure(mining, { kind: 'lesson', revision: mining.adventure!.revision, day: '2026-10-18', location: 'the_end' }).state;
    const run = (action: Extract<AdventureCommand, { kind: 'dragon' }>['action']) => {
      const result = transitionAdventure(mining, { kind: 'dragon', action, revision: mining.adventure!.revision, day: '2026-10-18', location: 'the_end' });
      expect(result.error).toBeUndefined(); mining = result.state; return result;
    };
    run({ kind: 'hold', item: 'water' }); expect(mining.equipped.held).toBe('water'); expect(mining.adventure?.hands).toBe(3); expect(mining.materials.water).toBe(1);
    run({ kind: 'hold', item: 'shield' }); expect(mining.equipped.held).toBe('shield'); expect(mining.adventure?.dragon?.equipment.shield).toBe(true); expect(mining.adventure?.hands).toBe(2);
    const before = JSON.stringify(mining); const entered = transitionAdventure(mining, { kind: 'enter', revision: mining.adventure!.revision, day: '2026-10-18', location: 'the_end' });
    expect(entered.state.adventure?.dragon?.equipment.shield).toBe(true); expect(JSON.stringify(mining)).toBe(before);
    mining.adventure!.dragon!.landingTurns = 2;
    const revision = mining.adventure!.revision;
    run({ kind: 'bed' }); expect(mining.materials.spare_bed).toBe(2); expect(mining.adventure?.hands).toBe(1); expect(mining.tickets).toBe(9);
    const replay = transitionAdventure(mining, { kind: 'dragon', action: { kind: 'bed' }, revision, day: '2026-10-18', location: 'the_end' });
    expect(replay.error).toBeTruthy(); expect(replay.state).toBe(mining);
    expect(normalizeMiningState(JSON.parse(JSON.stringify(mining))).adventure).toEqual(mining.adventure);
  });
  it('applies light healing to shared HP without eating bread or using the daily recovery allowance', () => {
    const base = emptyMiningState(); base.unlockedGachas.push('the_end'); base.tickets = 10; base.materials.bread = 4;
    let mining = transitionAdventure(base, { kind: 'enter', revision: -1, day: '2026-10-18', location: 'the_end' }).state;
    mining = transitionAdventure(mining, { kind: 'lesson', revision: mining.adventure!.revision, day: '2026-10-18', location: 'the_end' }).state;
    mining.adventure!.hp = 10; mining.adventure!.gauge = 3; mining.adventure!.dragon!.skills!.casts = 3;
    const start = transitionAdventure(mining, { kind: 'dragon', action: { kind: 'beginSkill' }, revision: mining.adventure!.revision, day: '2026-10-18', location: 'the_end' });
    mining = start.state;
    mining = transitionAdventure(mining, { kind: 'dragon', action: { kind: 'chooseSkill', token: mining.adventure!.dragon!.skills!.pending!.token, mode: 'aim' }, revision: mining.adventure!.revision, day: '2026-10-18', location: 'the_end' }).state;
    const action = { kind: 'releaseSkill' as const, token: mining.adventure!.dragon!.skills!.pending!.token, score: 0 };
    const result = transitionAdventure(mining, { kind: 'dragon', action, revision: mining.adventure!.revision, day: '2026-10-18', location: 'the_end' });
    expect(result.error).toBeUndefined(); expect(result.state.adventure?.hp).toBe(14); expect(result.state.adventure?.foodToday).toBe(0); expect(result.state.materials.bread).toBe(4);
  });
});
