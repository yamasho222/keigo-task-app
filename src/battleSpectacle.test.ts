import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BattleSpectacle, type BattleSpectacleProps } from './BattleSpectacle';
import { actOnBlaze, createBlazeRun, type BlazeAction } from './blazePrototypeEngine';
import { actOnEnderman, createEndermanRun } from './endermanPrototypeEngine';
import { buildBlazePlayback } from './blazePrototypePlayback';
import { buildEndermanPlayback } from './endermanPrototypePlayback';

const render = (props: BattleSpectacleProps) => renderToStaticMarkup(createElement(BattleSpectacle, props));
const kinds: BattleSpectacleProps['kind'][] = ['slash', 'ultimate', 'enemy', 'enemyUltimate', 'guard', 'heal', 'break', 'bed', 'victory'];
const phases: BattleSpectacleProps['phase'][] = ['windup', 'strike', 'impact', 'recover'];

describe('arena spectacle contract', () => {
  it('supports every dragon/blaze/enderman phase with decorative, non-interactive art', () => {
    for (const variant of ['blaze', 'enderman', 'dragon'] as const) for (const kind of kinds) for (const phase of phases) {
      const html = render({ kind, phase, variant });
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain(`data-bs-kind="${kind}" data-bs-phase="${phase}"`);
      expect(html).not.toMatch(/<(button|input|a |text\b)|tabindex|onanimationend/i);
      for (const match of html.matchAll(/class="([^"]+)"/g)) expect(match[1].split(' ').filter(Boolean).every(name => name.startsWith('bs-'))).toBe(true);
    }
  });

  it('separates darkened focus, three cuts and the final plunging strike', () => {
    const focus = render({ kind: 'ultimate', phase: 'windup' });
    const combo = render({ kind: 'ultimate', phase: 'strike' });
    const finish = render({ kind: 'ultimate', phase: 'impact' });
    expect(focus).toContain('bs-backdrop'); expect(focus).toContain('bs-orbit');
    expect(combo.match(/class="bs-combo-hit bs-combo-hit-/g)).toHaveLength(3);
    expect(finish).toContain('bs-falling-blade'); expect(finish).toContain('bs-ground-cracks');
    for (const html of [focus, combo, finish]) expect(html).not.toContain('bs-cut-trail');
    expect(render({ kind: 'slash', phase: 'strike' })).not.toContain('bs-backdrop');
  });

  it('distinguishes enemy big attacks by three projectiles, and enderman claws by shape', () => {
    const small = render({ kind: 'enemy', phase: 'strike' });
    const big = render({ kind: 'enemyUltimate', phase: 'strike' });
    expect(small.match(/class="bs-bolt bs-bolt-/g)).toHaveLength(1);
    expect(big.match(/class="bs-bolt bs-bolt-/g)).toHaveLength(3);
    const claws = render({ kind: 'enemyUltimate', phase: 'strike', variant: 'enderman' });
    expect(claws).toContain('bs-claw'); expect(claws).not.toContain('bs-flame');
    expect(render({ kind: 'enemy', phase: 'strike', variant: 'dragon' })).toContain('bs-claw');
    expect(render({ kind: 'enemyUltimate', phase: 'strike', variant: 'dragon' })).toContain('bs-flame');
  });

  it('only displays an actual finite, positive amount at impact', () => {
    for (const phase of ['windup', 'strike', 'recover'] as const) expect(render({ kind: 'ultimate', phase, amount: 8 })).not.toContain('bs-amount');
    for (const amount of [undefined, 0, -1, NaN, Infinity]) expect(render({ kind: 'slash', phase: 'impact', amount })).not.toContain('bs-amount');
    for (const kind of ['guard', 'break', 'victory'] as const) expect(render({ kind, phase: 'impact', amount: 8 })).not.toContain('bs-amount');
    expect(render({ kind: 'bed', phase: 'impact', amount: 20 })).toContain('>−20</span>');
    expect(render({ kind: 'slash', phase: 'impact', amount: 4 })).toContain('>−4</span>');
    expect(render({ kind: 'heal', phase: 'impact', amount: 7 })).toContain('>+7</span>');
  });

  it('uses old engine playback to place an overkill number only after HP changes', () => {
    const before = createBlazeRun(); before.enemies[0].hp = 2; before.gauge = 3;
    const original = structuredClone(before), action: BlazeAction = { kind: 'ultimate', enemyId: 0 };
    const result = actOnBlaze(before, action), final = structuredClone(result.state);
    const playback = buildBlazePlayback(before, result.state, action, result.events);
    for (const frame of playback.frames.filter(frame => frame.stage !== 'ticket')) {
      const phase = frame.stage === 'focus' ? 'windup' : frame.stage === 'strike' ? 'strike' : 'impact';
      const html = render({ kind: 'ultimate', phase, amount: before.enemies[0].hp - frame.shown.enemies[0].hp });
      expect(html.includes('bs-amount')).toBe(frame.stage === 'impact');
      if (frame.stage === 'impact') expect(html).toContain('>−2</span>');
    }
    expect(playback.frames.some(frame => frame.stage === 'counter')).toBe(false);
    expect(before).toEqual(original); expect(result.state).toEqual(final);
  });

  it('never displays damage for an engine-confirmed enderman miss', () => {
    const before = createEndermanRun(), action = { kind: 'strike' } as const;
    const result = actOnEnderman(before, action);
    expect(result.events.some(event => event.kind === 'miss')).toBe(true);
    for (const frame of buildEndermanPlayback(before, result.state, action, result.events).frames) {
      const html = render({ kind: 'slash', phase: frame.stage === 'impact' ? 'impact' : 'strike', amount: before.enemyHp - frame.shown.enemyHp });
      expect(html).not.toContain('bs-amount');
    }
  });

  it('keeps shielding a picture and only adds collision debris at contact', () => {
    expect(render({ kind: 'guard', phase: 'windup', shield: true })).not.toContain('bs-block-contact');
    expect(render({ kind: 'guard', phase: 'impact', shield: true })).toContain('bs-deflected');
    expect(render({ kind: 'guard', phase: 'impact', shield: false })).not.toContain('bs-shielded');
    expect(render({ kind: 'enemy', phase: 'strike', shield: true })).toContain('bs-shielded');
  });

  it('has deterministic bounded decoration and does not mutate buddy data', () => {
    const buddies = Array.from({ length: 7 }, (_, i) => ({ id: `buddy-${i}`, image: `/mining/buddy-${i}.png`, level: 99 }));
    const original = structuredClone(buddies), props: BattleSpectacleProps = { kind: 'ultimate', phase: 'windup', seed: 37, buddies };
    const html = render(props);
    expect(render(props)).toBe(html);
    expect(render({ ...props, seed: 38 })).not.toBe(html);
    expect(html.match(/class="bs-buddy-image"/g)).toHaveLength(4);
    expect(html.match(/class="bs-buddy-star"/g)).toHaveLength(12);
    expect(buddies).toEqual(original);
  });

  it('keeps manual/OS motion reduction local, stops all animation and preserves static phase art', () => {
    const css = readFileSync(new URL('./battleSpectacle.css', import.meta.url), 'utf8');
    expect(css).toContain('position:absolute; inset:0');
    expect(css).toContain('pointer-events:none');
    expect(css).toContain('@media (prefers-reduced-motion:reduce)');
    expect(css).toContain('.bs-reduced *');
    expect(css).toContain('animation:none !important; transition:none !important');
    expect(css).not.toMatch(/infinite|steps\(|brightness\(/);
    expect(render({ kind: 'ultimate', phase: 'impact', reduced: true, amount: 5 })).toContain('bs-reduced');
    expect(render({ kind: 'ultimate', phase: 'impact', reduced: true, amount: 5 })).toContain('>−5</span>');
  });
});
