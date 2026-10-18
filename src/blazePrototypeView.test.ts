import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import BlazePrototype from './BlazePrototype';
import { BattleDemo, BlazeTelegraph, BlazeUltimateFx, HitDamage, TicketMeter } from './BlazePrototypeVisuals';

describe('child-facing battle surface', () => {
  function mainMarkup() { return renderToStaticMarkup(createElement(BlazePrototype)).split('<dialog')[0]; }
  it('keeps adult debug copy and repeated forecasts out of the play surface', () => {
    const html = mainMarkup();
    for (const text of ['PLAYABLE PROTOTYPE', 'NEXT MOVE', 'YOUR MOVE', 'ダメージ', '合計軽減', '戦闘データ', 'ダイヤの剣が基準']) expect(html).not.toContain(text);
    expect(html.match(/class="bp-telegraph /g)).toHaveLength(1);
  });
  it('has four picture commands with accessible names rather than long visible instructions', () => {
    const html = mainMarkup();
    expect(html.match(/class="bp-command /g)).toHaveLength(4);
    expect(html).toContain('aria-label="こうげき"');
    expect(html).toContain('aria-label="まもる"');
    expect(html).toContain('aria-label="ひっさつ、光0個、3個で使える"');
    expect(html).toContain('aria-label="かいふく、パン残り2個"');
    expect(html).toContain('<strong>かいふく</strong>');
    expect(html).toContain('/mining/Diamond_Sword.png');
    expect(html).toContain('bp-icon-shield');
    expect(html).toContain('bp-icon-bread');
  });
  it('represents health as ten hearts and bread as two actual pictures', () => {
    const html = mainMarkup();
    expect(html.match(/class="bp-heart /g)).toHaveLength(10);
    expect(html.match(/bp-icon-bread/g)).toHaveLength(2);
    expect(html).toContain('体力 ハート10 / 10');
  });
  it('keeps unaffordable commands locked while retaining the three visible charge lights', () => {
    const html = mainMarkup();
    expect(html).toMatch(/bp-command bp-ultimate[^>]*disabled/);
    expect(html).toMatch(/bp-command bp-eat[^>]*disabled/);
    expect(html).toContain('bp-charge-lights');
    expect(html).toContain('次のチケット1枚で4回行動');
  });
  it('keeps enemy current/max HP but removes weapon power numbers from the choices', () => {
    const html = mainMarkup();
    expect(html).toContain('class="bp-enemy-hp-number">28<small> / 28</small>');
    expect(html).not.toContain('bp-command-power');
    expect(html).not.toContain('威力');
  });
  it('shows actual HP removed, including an ultimate that overkills the enemy', () => {
    expect(renderToStaticMarkup(createElement(HitDamage, { beforeHp: 28, hp: 24 }))).toContain('>−4</span>');
    const finishingHit = renderToStaticMarkup(createElement(HitDamage, { beforeHp: 10, hp: 0, special: true }));
    expect(finishingHit).toContain('is-special');
    expect(finishingHit).toContain('>−10</span>');
    expect(finishingHit).not.toContain('−12');
  });
  it('never displays a damage number when HP is unchanged or recovered', () => {
    expect(renderToStaticMarkup(createElement(HitDamage, { beforeHp: 28, hp: 28 }))).toBe('');
    expect(renderToStaticMarkup(createElement(HitDamage, { beforeHp: 10, hp: 20 }))).toBe('');
  });
  it('uses distinct shapes for small fire, gathering without a fireball, and a crowned loaded fireball', () => {
    const small = renderToStaticMarkup(createElement(BlazeTelegraph, { intent: 'ember' }));
    const charge = renderToStaticMarkup(createElement(BlazeTelegraph, { intent: 'charge' }));
    const burst = renderToStaticMarkup(createElement(BlazeTelegraph, { intent: 'burst' }));
    expect(small).toContain('class="bp-fireball"');
    expect(small).not.toContain('bp-burst-crown');
    expect(charge).not.toContain('bp-fireball');
    expect(charge).toContain('bp-gather-arrows');
    expect(burst).toContain('bp-burst-crown');
    expect(burst).toContain('bp-warning-mark');
  });
  it('shows four action marks and only three lit after the first paid action', () => {
    const html = renderToStaticMarkup(createElement(TicketMeter, { tickets: 3, hands: 3, buying: false }));
    const tokens = html.split('bp-step-tokens')[1].split('</div>')[0];
    expect(tokens.match(/<span class=/g)).toHaveLength(4);
    expect(tokens.match(/class="is-filled"/g)).toHaveLength(3);
    expect(html).toContain('支払い済みの行動あと3回');
    const demo = renderToStaticMarkup(createElement(BattleDemo, { lesson: 3 }));
    expect(demo).toContain('チケット1枚が4回');
    expect(demo.split('class="bp-demo-actions">')[1].split('</div>')[0].match(/<span>/g)).toHaveLength(4);
  });
  it('renders separate special charge, cut, impact, and shatter phases without a normal slash', () => {
    for (const [stage, marker] of [['focus', 'bp-limit-focus'], ['strike', 'bp-limit-cut'], ['impact', 'bp-limit-impact'], ['counter', 'bp-limit-shatter']] as const) {
      const html = renderToStaticMarkup(createElement(BlazeUltimateFx, { stage }));
      expect(html).toContain(marker);
      expect(html).not.toContain('bp-slash');
    }
    expect(renderToStaticMarkup(createElement(BlazeUltimateFx, { stage: 'counter', intent: 'charge' }))).not.toContain('bp-broken-orb');
  });
});
