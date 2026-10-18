import { useEffect, useRef } from 'react';
import type { DragonSkillKind } from './dragonSkillRules';

type ArtProps = { kind: DragonSkillKind; power: number; beat?: number; reduced: boolean; phase?: 'charge' | 'windup' | 'strike' | 'impact' | 'result'; active?: boolean };
const COLORS: Record<DragonSkillKind, [string, string, string]> = {
  burst: ['#ff571d', '#ffbf54', '#fff3cc'], gauge: ['#677bff', '#87deff', '#f1fdff'],
  repel: ['#098ad5', '#47e3e1', '#dcffff'], aim: ['#aa66ff', '#ffe3a0', '#fffce7'],
};
const TAU = Math.PI * 2;
const seed = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** Hand-painted procedural VFX: no textures/network, no battle logic, bounded DPR/particles. */
export function DragonSkillArt(props: ArtProps) {
  const canvas = useRef<HTMLCanvasElement>(null), latest = useRef(props);
  useEffect(() => { latest.current = props; }, [props]);
  useEffect(() => {
    const element = canvas.current, ctx = element?.getContext('2d');
    if (!element || !ctx) return;
    let frame = 0, width = 480, height = 360, last = 0, beat = -1, impulseAt = 0;
    const born = performance.now();
    const observer = new ResizeObserver(entries => {
      const rect = entries[0].contentRect;
      width = Math.max(1, rect.width); height = Math.max(1, rect.height);
      const ratio = Math.min(1.75, window.devicePixelRatio || 1);
      element.width = Math.round(width * ratio); element.height = Math.round(height * ratio);
    });
    observer.observe(element);
    function draw(now: number) {
      if (!ctx || !element) return;
      // 30fps is deliberate: plenty for these energy layers and kinder to phones.
      if (now - last < 32) { frame = requestAnimationFrame(draw); return; }
      last = now;
      const p = latest.current, [dark, color, white] = COLORS[p.kind], calm = p.reduced;
      if (beat !== (p.beat ?? 0)) { beat = p.beat ?? 0; impulseAt = now; }
      const t = calm ? .72 : (now - born) / 1000, power = Math.max(0, Math.min(1, p.power));
      const hit = calm ? 0 : Math.max(0, 1 - (now - impulseAt) / 360);
      const battle = p.phase === 'strike' || p.phase === 'impact';
      const finish = p.phase === 'impact' || p.phase === 'result';
      const age = calm ? .35 : (now - born) / 1000;
      ctx.setTransform(element.width / 480, 0, 0, element.height / 360, 0, 0);
      ctx.clearRect(0, 0, 480, 360);
      const cx = 240, cy = battle ? 178 : 183;

      function halo(x: number, y: number, r: number, tint: string, alpha: number) {
        const g = ctx!.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, tint); g.addColorStop(.23, color + '60'); g.addColorStop(1, dark + '00');
        ctx!.globalAlpha = alpha; ctx!.fillStyle = g; ctx!.fillRect(x - r, y - r, r * 2, r * 2); ctx!.globalAlpha = 1;
      }
      function line(points: [number, number][], stroke: string, thickness: number, alpha = 1) {
        ctx!.globalAlpha = alpha; ctx!.strokeStyle = stroke; ctx!.lineWidth = thickness;
        ctx!.lineCap = 'round'; ctx!.lineJoin = 'round'; ctx!.beginPath();
        points.forEach(([x, y], i) => i ? ctx!.lineTo(x, y) : ctx!.moveTo(x, y)); ctx!.stroke(); ctx!.globalAlpha = 1;
      }
      function ring(radius: number, angle: number, alpha: number, scaleY = .37) {
        ctx!.save(); ctx!.translate(cx, cy + 82); ctx!.rotate(angle); ctx!.scale(1, scaleY);
        ctx!.strokeStyle = color; ctx!.lineWidth = 1.2; ctx!.globalAlpha = alpha;
        ctx!.beginPath(); ctx!.ellipse(0, 0, radius, radius, 0, 0, TAU); ctx!.stroke();
        for (let i = 0; i < 24; i++) {
          const a = i / 24 * TAU + t * .15;
          ctx!.beginPath(); ctx!.moveTo(Math.cos(a) * (radius - 5), Math.sin(a) * (radius - 5));
          ctx!.lineTo(Math.cos(a) * (radius + (i % 3 ? 2 : 9)), Math.sin(a) * (radius + (i % 3 ? 2 : 9))); ctx!.stroke();
        }
        ctx!.restore();
      }
      function sword(x: number, y: number, scale: number, angle: number) {
        ctx!.save(); ctx!.globalCompositeOperation = 'source-over'; ctx!.translate(x, y); ctx!.rotate(angle); ctx!.scale(scale, scale);
        const path = new Path2D('M0 -116 L17 -82 L12 38 L39 49 L37 59 L9 54 L7 89 L0 99 L-7 89 L-9 54 L-37 59 L-39 49 L-12 38 L-17 -82 Z');
        const steel = ctx!.createLinearGradient(-20, 0, 22, 0);
        steel.addColorStop(0, '#18344e'); steel.addColorStop(.3, '#a6d5e6'); steel.addColorStop(.47, '#f2ffff'); steel.addColorStop(.5, '#5186b1'); steel.addColorStop(.76, '#c8f5fa'); steel.addColorStop(1, '#244e77');
        ctx!.shadowColor = color; ctx!.shadowBlur = 8 + power * 15; ctx!.fillStyle = steel; ctx!.fill(path); ctx!.shadowBlur = 0;
        ctx!.fillStyle = '#306080'; ctx!.fill(new Path2D('M0 -112 15 -81 10 37 0 44Z'));
        ctx!.fillStyle = '#91c1d0'; ctx!.fill(new Path2D('M0 -112 -14 -81 -10 37 0 44Z'));
        ctx!.fillStyle = '#f2ffff'; ctx!.fill(new Path2D('M0 -112 -2 -75 -2 37 0 44 2 37 2 -75Z'));
        ctx!.strokeStyle = '#ddffff'; ctx!.lineWidth = 1; ctx!.stroke(path);
        line([[0, -105], [0, 35]], white, 1.5, .9);
        for (let i = 0; i < 4; i++) line([[-7, -58 + i * 21], [-2, -63 + i * 21], [-2, -51 + i * 21]], color, .9, .8);
        const gold = ctx!.createLinearGradient(-40, 40, 38, 58); gold.addColorStop(0, '#9e6d30'); gold.addColorStop(.5, '#ffeab2'); gold.addColorStop(1, '#835220');
        ctx!.fillStyle = gold; ctx!.fill(new Path2D('M-39 49 L-17 42 L0 46 L17 42 L39 49 L37 59 L0 52 L-37 59 Z'));
        ctx!.fillStyle = '#17263c'; ctx!.fillRect(-5, 57, 10, 30);
        for (let i = 0; i < 5; i++) line([[-5, 59 + i * 6], [5, 63 + i * 6]], '#b49b6e', 1.3);
        halo(0, 44, 16, white, .8); ctx!.fillStyle = color; ctx!.fill(new Path2D('M0 35 L7 44 L0 53 L-7 44 Z'));
        ctx!.restore();
      }

      ctx.globalCompositeOperation = 'source-over';
      if (!battle) {
        const bg = ctx.createRadialGradient(cx, cy, 20, cx, cy, 295);
        bg.addColorStop(0, '#162537'); bg.addColorStop(1, '#040914'); ctx.fillStyle = bg; ctx.fillRect(0, 0, 480, 360);
        for (let i = 0; i < 45; i++) {
          ctx.fillStyle = i % 3 ? '#8aaec65a' : color + '90';
          ctx.fillRect(seed(i + 12) * 480, (seed(i + 32) * 360 - t * (i % 3 + 1) + 3600) % 360, i % 4 ? 1 : 2, i % 4 ? 1 : 2);
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      halo(cx, cy, 140 + power * 100, dark, .27 + power * .34 + hit * .18);
      if (!battle) { ring(88 + power * 58, -.07, .4 + power * .3); ring(113 + power * 60, .06, .17 + power * .25); }

      if (p.kind === 'burst') {
        // Layered fire ribbons: colored body, hot inner thread, embers and a white core.
        for (let i = 0; i < 16; i++) {
          const a = i / 16 * TAU + t * .7;
          const radius = (battle ? 45 + age * 150 : 38 + power * 92) + Math.sin(t * 4 + i) * 12;
          const pts: [number, number][] = Array.from({ length: 20 }, (_, j) => {
            const u = j / 19, swirl = a + u * (battle ? 1.3 : 2.3), r = radius * u;
            return [cx + Math.cos(swirl) * r, cy + Math.sin(swirl) * r * .9 - u * (22 + power * 35)];
          });
          line(pts, dark, 5 + power * 11, .14 + power * .17); line(pts, color, 1.2 + power * 2, .4 + power * .4);
          if (i % 3 === 0) line(pts.slice(0, 12), white, 1.5, .8);
        }
        if (!battle) sword(cx, cy + 10, .82 + power * .15, -.55);
        if (power > .35) {
          ctx.globalCompositeOperation = 'source-over';
          for (let i = 0; i < 7; i++) {
            const a = i / 7 * TAU + t * .18, r = 100 + i % 2 * 45;
            ctx.save(); ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r * .7); ctx.rotate(a + t * .25);
            ctx.fillStyle = '#263247'; ctx.strokeStyle = '#d88c5270'; ctx.lineWidth = 1;
            const rock = new Path2D('M-9 -5 -2 -10 9 -3 6 9 -6 7Z'); ctx.fill(rock); ctx.stroke(rock);
            line([[-9, -5], [0, 0], [9, -3]], '#edbd7850', 1); ctx.restore();
          }
          ctx.globalCompositeOperation = 'lighter';
        }
      } else if (p.kind === 'gauge') {
        for (let i = 0; i < 7; i++) {
          const a = i * TAU / 7 + .3, radius = 72 + power * 125;
          const pts: [number, number][] = Array.from({ length: 11 }, (_, j) => {
            const u = j / 10, wobble = j === 0 || j === 10 ? 0 : (seed(i * 31 + j + Math.floor(t * 9)) - .5) * 42;
            return [cx + Math.cos(a) * radius * u + Math.sin(a) * wobble, cy + Math.sin(a) * radius * u + Math.cos(a) * wobble];
          });
          line(pts, dark, 9, .22 + power * .2); line(pts, color, 3, .4 + power * .5); line(pts, white, .9, .8);
        }
        sword(cx + (battle ? 0 : 58), cy - (battle ? 0 : 3), battle ? 1.5 : .95 + power * .18, battle ? .6 : -.15);
        if (battle) {
          const bolt: [number, number][] = [[260, -20], [222, 66], [277, 65], [210, 178], [244, 162], [201, 370]];
          line(bolt, dark, 56, .28); line(bolt, color, 15, .85); line(bolt, white, 4, 1);
        }
      } else if (p.kind === 'repel') {
        // Translucent moving water bodies under the fine foam highlights.
        for (let i = 0; i < 4; i++) {
          ctx.save(); ctx.translate(cx, cy); ctx.rotate(i * .85 + t * .28);
          const water = ctx.createLinearGradient(-180, 0, 170, 0); water.addColorStop(0, '#046eaa00'); water.addColorStop(.35, '#1678b850'); water.addColorStop(.7, '#54e7ed88'); water.addColorStop(1, '#d1ffff00');
          ctx.fillStyle = water; ctx.beginPath();
          ctx.moveTo(-180, 0); ctx.bezierCurveTo(-55, -135 - power * 30, 125, -90, 180, 0);
          ctx.bezierCurveTo(60, -60, -50, -50, -180, 0); ctx.fill(); ctx.restore();
        }
        for (let i = 0; i < 12; i++) {
          const pts: [number, number][] = Array.from({ length: 38 }, (_, j) => {
            const a = j / 37 * TAU * 1.1 + t * (i % 2 ? 1 : -1) * .75 + i * .45;
            const r = 50 + i * 8 + power * 29;
            return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * .51 + Math.sin(a * 3 + t) * 7 + i * 2 - 20];
          });
          line(pts, dark, 8, .14); line(pts, color, i % 3 ? 1 : 3, .23 + power * .35); line(pts.slice(0, 8), white, 1, .6);
        }
        if (battle) {
          for (let i = 0; i < 5; i++) {
            const wave: [number, number][] = Array.from({ length: 30 }, (_, j) => [j / 29 * 520 - 20, 180 + Math.sin(j / 29 * 8 + t * 5 + i * .4) * (40 + i * 9)]);
            line(wave, color, 12 - i * 2, .4); line(wave, white, 1.7, .7);
          }
        }
      } else {
        // Three faceted light crystals rather than a flat target icon.
        for (let i = 0; i < 3; i++) {
          const x = 145 + i * 95, y = 96 + Math.sin(t * 1.4 + i) * 8;
          halo(x, y, 37, white, .23 + power * .3);
          ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.translate(x, y);
          ctx.fillStyle = '#e8d5a6'; ctx.fill(new Path2D('M0 -26 15 -4 0 29 -13 -3Z'));
          ctx.fillStyle = '#705b92'; ctx.fill(new Path2D('M0 -26 15 -4 0 29Z'));
          line([[0, -26], [-13, -3], [0, 29], [15, -4], [0, -26]], '#fff4ce', 1.2);
          line([[-13, -3], [15, -4]], '#fff4ce', 1); ctx.restore();
        }
        for (let i = 0; i < 5; i++) {
          ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * (i % 2 ? -.12 : .12) + i * .4);
          ctx.strokeStyle = i % 2 ? color : dark; ctx.globalAlpha = .2 + power * .25; ctx.lineWidth = i % 2 ? 1 : 3;
          ctx.beginPath(); const r = 55 + i * 21;
          for (let j = 0; j <= 6; j++) { const a = j / 6 * TAU; if (j) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
          ctx.stroke(); ctx.restore();
        }
        if (battle || hit > .15) {
          for (let i = -1; i <= 1; i++) {
            const path: [number, number][] = [[cx - 250, cy + 130 + i * 45], [cx, cy], [cx + 220, cy - 130 - i * 35]];
            line(path, dark, 28, .3); line(path, color, 8, .7); line(path, white, 2.4, .9);
          }
        }
      }
      const particles = calm ? 18 : battle ? 95 : 58;
      for (let i = 0; i < particles; i++) {
        const u = (seed(i + 90) + t * (battle ? .8 : .12 + power * .2)) % 1;
        const a = seed(i + 11) * TAU + (battle ? 0 : u * 1.5);
        const r = battle ? u * 340 : 28 + (1 - u) * (160 + power * 55);
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * .8;
        ctx.globalAlpha = (battle ? 1 - u : u) * (.3 + power * .7);
        line([[x, y], [x + Math.cos(a) * (battle ? 12 : 4), y + Math.sin(a) * 7]], i % 3 ? color : white, i % 4 ? 1.5 : 3, ctx.globalAlpha);
      }
      ctx.globalAlpha = 1;
      if (finish || hit > 0) {
        const u = finish ? Math.min(1, age / .9) : 1 - hit;
        ctx.strokeStyle = white; ctx.lineWidth = 3 * (1 - u) + 1; ctx.globalAlpha = (1 - u) * .8;
        ctx.beginPath(); ctx.ellipse(cx, cy, 25 + u * 210, 25 + u * 150, -.25, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
        halo(cx, cy, 40 + u * 100, white, (1 - u) * .65);
      }
      if (battle) halo(cx, cy, p.kind === 'aim' ? 50 : 65, white, .5);
      ctx.globalCompositeOperation = 'source-over';
      // Letterbox vignette gives the luminous middle room to breathe.
      const shade = ctx.createLinearGradient(0, 0, 0, 360); shade.addColorStop(0, '#01040b99'); shade.addColorStop(.2, '#01040b00'); shade.addColorStop(.82, '#01040b00'); shade.addColorStop(1, '#01040b99');
      ctx.fillStyle = shade; ctx.fillRect(0, 0, 480, 360);
      frame = requestAnimationFrame(draw); // Calm mode reads input changes but freezes ambient time.
    }
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, []);
  return <canvas ref={canvas} className={`ds-art ds-art-${props.kind}`} aria-hidden="true" />;
}
