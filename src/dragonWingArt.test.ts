import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DragonWingArt } from './DragonWingArt';

type Props = Parameters<typeof DragonWingArt>[0];
const render = (props: Partial<Props> = {}) => renderToStaticMarkup(createElement(DragonWingArt, { side: 0, hp: 48, ...props }));
const count = (html: string, className: string) => [...html.matchAll(new RegExp(`class="${className}"`, 'g'))].length;

describe('DragonWingArt decorative SSR', () => {
  it.each([0, 1] as const)('reflects side %s without introducing controls or an image dependency', side => {
    const html = render({ side });
    expect(html).toContain(`data-dw-side="${side}"`);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('focusable="false"');
    expect(html.includes('translate(440 0) scale(-1 1)')).toBe(side === 1);
    expect(html).not.toMatch(/<(?:button|image|img|foreignObject|text)\b|\b(?:tabindex|onclick|role)=/i);
    expect(count(html, 'dw-finger dw-finger-0')).toBe(1);
    expect(html).toContain('dw-thickness');
    expect(html).toContain('dw-seams');
  });

  it.each([
    [48, 'intact', 0, 0], [37, 'intact', 0, 0], [36, 'cracked', 2, 1],
    [25, 'cracked', 2, 1], [24, 'torn', 4, 3], [13, 'torn', 4, 3],
    [12, 'ragged', 5, 5], [1, 'ragged', 5, 5], [0, 'broken', 5, 8],
  ])('HP %s has %s damage with visible cracks and debris', (hp, stage, cracks, chips) => {
    const html = render({ hp: hp as number });
    expect(html).toContain(`data-dw-damage="${stage}"`);
    expect(count(html, 'dw-crack')).toBe(cracks);
    expect(count(html, 'dw-chip-drift')).toBe(chips);
    expect(html.includes('class="dw-fractures"')).toBe(hp === 0);
  });

  it('cuts actual transparent holes in the sails, and severs the broken skeleton', () => {
    const intact = render();
    const torn = render({ hp: 24 });
    const broken = render({ hp: 0 });
    const masks = (html: string) => [...html.matchAll(/<mask\b[^>]*>([\s\S]*?)<\/mask>/g)].map(match => match[1]);
    expect(masks(intact)).toHaveLength(2);
    expect(masks(intact).every(mask => !mask.includes('fill="black"'))).toBe(true);
    expect(masks(torn)[0].match(/fill="black"/g)).toHaveLength(4);
    expect(masks(torn)[1]).not.toContain('fill="black"');
    expect(masks(broken)[0].match(/fill="black"/g)).toHaveLength(8);
    expect(masks(broken)[1]).toContain('fill="black"');
  });

  it('scales thresholds with maxHp and clamps invalid HP to a deterministic drawing', () => {
    expect(render({ hp: 100, maxHp: 200 })).toContain('data-dw-damage="torn"');
    expect(render({ hp: 500 })).toContain('data-dw-hp-ratio="1"');
    for (const hp of [-1, NaN, Infinity, -Infinity]) {
      const html = render({ hp });
      expect(html).toContain('data-dw-hp-ratio="0"');
      expect(html).toContain('data-dw-damage="broken"');
      expect(html).not.toMatch(/NaN|Infinity/);
    }
    for (const maxHp of [0, -1, NaN, Infinity]) {
      expect(render({ hp: 24, maxHp })).toContain('data-dw-hp-ratio="0.5"');
    }
  });

  it.each([0, 1] as const)('zooms the same damaged art for side %s with a mirrored crop', side => {
    const wide = render({ side, hp: 12 });
    const close = render({ side, hp: 12, closeup: true });
    expect(wide).toContain('viewBox="0 0 440 300"');
    expect(close).toContain(`viewBox="${side === 0 ? 58 : 38} 58 344 228"`);
    expect(close).toContain('dw-closeup');
    // The view changes, not the anatomy: no alternate flat attack placeholder.
    const paths = (html: string) => [...html.matchAll(/\bd="([^"]*)"/g)].map(match => match[1]);
    expect(paths(close)).toEqual(paths(wide));
    expect(count(close, 'dw-crack')).toBe(5);
    expect(close).toContain('dw-joint');
  });

  it('exposes independent focused, selected and reduced styles without hiding damage', () => {
    const html = render({ hp: 12, focused: true, selected: true, reduced: true });
    expect(html).toContain('dw-focused dw-selected');
    expect(html).toContain('dw-reduced');
    expect(count(html, 'dw-crack')).toBe(5);
    expect(count(html, 'dw-chip-drift')).toBe(5);
    expect(render()).not.toMatch(/dw-focused|dw-selected|dw-closeup|dw-reduced/);
  });

  it('gives every gradient, pattern and mask a unique useId reference across instances', () => {
    const html = renderToStaticMarkup(createElement(Fragment, null,
      ...[0, 1, 2, 3].map(index => createElement(DragonWingArt, {
        key: index, side: (index % 2) as 0 | 1, hp: index * 12, closeup: index > 1,
      })),
    ));
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    expect(ids).toHaveLength(24);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(id => /^dw-[\w-]+$/.test(id))).toBe(true);
    const wings = html.match(/<svg\b[\s\S]*?<\/svg>/g) ?? [];
    expect(wings).toHaveLength(4);
    for (const wing of wings) {
      const localIds = new Set([...wing.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
      const references = [...wing.matchAll(/url\(#([^)]*)\)/g)].map(match => match[1]);
      expect(references.length).toBeGreaterThan(10);
      expect(references.every(reference => localIds.has(reference))).toBe(true);
    }
  });
});
