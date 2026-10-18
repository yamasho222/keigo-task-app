import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import EndermanPrototype from './EndermanPrototype';
import { EndermanAfterimages, EndermanCluePicture, EndermanDemo, EndermanItemArt, EndermanTelegraph, EndermanUltimate } from './EndermanPrototypeVisuals';
import { EndermanBucket, EndermanPond } from './EndermanPond';
import { ENDERMAN_ITEM_NAMES } from './endermanPrototypeAssets';

describe('enderman child-facing interface', () => {
  const html = () => renderToStaticMarkup(createElement(EndermanPrototype)).split('<dialog')[0];
  it('keeps the same four commands, four-action tickets and visible enemy HP without command damage labels', () => {
    const view = html();
    expect(view.match(/class="bp-command /g)).toHaveLength(4);
    expect(view).toContain('こうげき'); expect(view).toContain('かいふく、パン残り2個');
    expect(view).toContain('>36<small> / 36</small>'); expect(view).toContain('次のチケット1枚で4回行動');
    expect(view).not.toContain('bp-command-power'); expect(view).not.toContain('防具軽減');
  });
  it('uses the correct enemy name and exposes equipment separately from attack', () => {
    const view = html(); expect(view).toContain('そうび、もちもの：なし');
    expect(view).toContain('alt="エンダーマン"'); expect(view).not.toContain('エンドマン');
    expect(view.match(/class="bp-heart /g)).toHaveLength(10);
  });
  it('does not spoil equipping water in the initial play surface or picture lessons', () => {
    const view = html(); expect(view).not.toContain('水を装備'); expect(view).not.toContain('もちものに水');
    for (let lesson = 0; lesson < 3; lesson++) {
      const demo = renderToStaticMarkup(createElement(EndermanDemo, { lesson }));
      expect(demo).not.toContain('/mining/Water.png'); expect(demo).toContain('/mining/Enderman.png');
    }
  });
  it('uses different shapes for warp, danger, opening and water, not color alone', () => {
    const warp = renderToStaticMarkup(createElement(EndermanTelegraph, { intent: 'warp', wet: false }));
    expect(warp).toContain('<ellipse'); expect(warp).toContain('ep-ghost-mark');
    expect(renderToStaticMarkup(createElement(EndermanTelegraph, { intent: 'ambush', wet: false }))).toContain('>!</b>');
    expect(renderToStaticMarkup(createElement(EndermanTelegraph, { intent: 'opening', wet: false }))).toContain('いまだ！');
    expect(renderToStaticMarkup(createElement(EndermanTelegraph, { intent: 'warp', wet: true }))).toContain('ep-flinch-sign');
  });
  it('represents carried items as pictures and uses a warp-binding special without a fireball', () => {
    expect(renderToStaticMarkup(createElement(EndermanItemArt, { item: 'none' }))).toContain('ep-empty-hand');
    expect(renderToStaticMarkup(createElement(EndermanItemArt, { item: 'water' }))).toContain('ep-bucket-art');
    const special = renderToStaticMarkup(createElement(EndermanUltimate, { stage: 'impact', tier: 'diamond' }));
    expect(special).toContain('ep-warp-bind'); expect(special).toContain('bp-limit-impact'); expect(special).not.toContain('bp-broken-orb');
  });
  it('supports the subtle water clue with a picture, without naming equipment or showing the water item', () => {
    const clue = renderToStaticMarkup(createElement(EndermanCluePicture));
    expect(clue).toContain('足元をさけている絵'); expect(clue).toContain('/mining/Enderman.png');
    expect(clue).not.toContain('そうび'); expect(clue).not.toContain('/mining/Water.png');
    expect(clue).toContain('ep-pond-compact');
  });
  it('uses a visible bed, reflected scenery, banks and short wavelets instead of a glowing ring', () => {
    const pond = renderToStaticMarkup(createElement(EndermanPond, { equipped: true, splashing: true }));
    for (const part of ['ep-pond-equipped', 'is-splashing', 'ep-pond-bed', 'ep-pond-reflection', 'ep-pond-wavelets', 'ep-pond-stones', 'ep-pond-reeds', 'ep-pond-spray']) expect(pond).toContain(part);
    expect(pond).not.toContain('ep-water-ring'); expect(pond).not.toMatch(/水|みず|ミズ/);
    expect(pond).toContain('aria-hidden="true"');
  });
  it('uses distinct definition ids for multiple liquid surfaces in one scene', () => {
    const scene = renderToStaticMarkup(createElement('div', null, createElement(EndermanPond), createElement(EndermanPond, { equipped: true }), createElement(EndermanCluePicture)));
    const ids = Array.from(scene.matchAll(/ id="([^"]+)"/g), match => match[1]);
    expect(ids).toHaveLength(15); expect(new Set(ids).size).toBe(ids.length);
    for (const reference of scene.matchAll(/url\(#([^)]+)\)/g)) expect(ids).toContain(reference[1]);
  });
  it('removes the literal answer from visible copy, accessible hints, gear names and forecasts', () => {
    expect(html()).not.toMatch(/水|みず|ミズ/);
    expect(Object.values(ENDERMAN_ITEM_NAMES).join('')).not.toMatch(/水|みず|ミズ/);
    for (const wet of [false, true]) for (const intent of ['warp', 'ambush', 'opening', 'approach'] as const) {
      expect(renderToStaticMarkup(createElement(EndermanTelegraph, { wet, intent }))).not.toMatch(/水|みず|ミズ/);
    }
    expect(renderToStaticMarkup(createElement(EndermanCluePicture))).not.toMatch(/水|みず|ミズ/);
    const bucket = renderToStaticMarkup(createElement(EndermanBucket));
    expect(bucket).toContain('ep-bucket-art'); expect(bucket).not.toContain('<text');
  });
  it('keeps two dry warp afterimages and none at all while equipped, including defensive animation cases', () => {
    const dry = renderToStaticMarkup(createElement(EndermanAfterimages, { wet: false, intent: 'warp', busy: false, dodged: false }));
    expect(dry.match(/class="ep-warp-ghost /g)).toHaveLength(2);
    for (const intent of ['warp', 'ambush', 'opening', 'approach'] as const) for (const busy of [false, true]) for (const dodged of [false, true]) {
      expect(renderToStaticMarkup(createElement(EndermanAfterimages, { wet: true, intent, busy, dodged }))).toBe('');
    }
    expect(renderToStaticMarkup(createElement(EndermanAfterimages, { wet: false, intent: 'opening', busy: false, dodged: false }))).toBe('');
  });
});
