import { useId, type CSSProperties } from 'react';
import type { DragonEffects } from './dragonBattleEffects';
import './dragonBattleEffects.css';

export function DragonStatusArt({ effects, pulse }: { effects?: DragonEffects; pulse?: string }) {
  if (!effects) return null;
  return <div className={`dragon-status-art status-pulse-${pulse ?? 'none'}`} aria-hidden="true">
    {effects.burn > 0 && <div className="dragon-burn-aura"><img src="/mining/dragon-burst-v1/flame.webp" alt="" /><i /><i /><i /></div>}
    {effects.stun > 0 && <svg className="dragon-stun-arcs" viewBox="0 0 400 300"><path d="m100 65-28 56h35l-34 70m211-153-35 68h38l-35 70M146 30l32 15-20 28 41 20" /></svg>}
    {effects.water > 0 && <div className="dragon-water-ward"><img src="/mining/dragon-elements-v1/water-core.webp" alt="" /><i /></div>}
    {effects.light > 0 && <div className="dragon-light-ward"><i /><i /></div>}
  </div>;
}

export function DragonStatusBadges({ effects }: { effects?: DragonEffects }) {
  if (!effects) return null;
  const states = [
    { icon: '🔥', count: effects.burn, label: 'やけど、あと', unit: 'かい' },
    { icon: '⚡', count: effects.stun, label: 'しびれ、あと', unit: 'かい' },
    { icon: '🫧', count: effects.water, label: 'まもり、あと', unit: 'かい' },
    { icon: '✦', count: effects.light, label: 'まもるひかり、', unit: 'HP' },
  ];
  return <div className="dragon-status-badges" aria-label="ひっさつの追加効果">{states.filter(state => state.count > 0).map(state => <span key={state.icon} role="img" aria-label={`${state.label}${state.count}${state.unit}`}>{state.icon}<b>{state.count}</b></span>)}</div>;
}

/** Isometric model: lit mattress, pillow, wooden frame and four grounded legs. */
function BattleBedModel() {
  const id = useId().replace(/:/g, '');
  return <svg className="bed-real-prop bed-prop-model" viewBox="0 0 300 200">
    <defs><linearGradient id={`${id}quilt`} x2=".5" y2="1"><stop stopColor="#fffef0" /><stop offset="1" stopColor="#bcbac0" /></linearGradient>
      <linearGradient id={`${id}wood`}><stop stopColor="#c79b5f" /><stop offset="1" stopColor="#62452c" /></linearGradient></defs>
    <ellipse cx="153" cy="158" rx="111" ry="23" fill="#0008" />
    <g fill={`url(#${id}wood)`} stroke="#4a3020" strokeWidth="2"><path d="m37 84 18 7v36l-18-8Zm115 55 21 8v37l-21-10Zm113-53 14-6v32l-14 9Zm-132-49 17 7v32l-17-7Z" /><path d="m34 73 139 65 106-51v18l-106 53L34 92Z" /></g>
    <path d="m35 63 101-48 140 63-103 53Z" fill={`url(#${id}quilt)`} stroke="#eae4dd" strokeWidth="2" />
    <path d="m35 63 138 68v15L35 78Z" fill="#b5b0b5" /><path d="m173 131 103-53v14l-103 54Z" fill="#85848e" />
    <path d="m48 60 87-41 41 19-86 43Z" fill="#fffdf1" stroke="#d5d0cd" strokeWidth="3" />
    <g fill="none" stroke="#a9a6ad" strokeWidth="1.5" opacity=".6"><path d="m110 89 89-44M139 103l90-45M168 117l89-46M97 83l139 4M123 70l88 40" /></g>
    <path d="m39 65 132 65 100-50" fill="none" stroke="#fff8e8" strokeWidth="3" />
  </svg>;
}

/** Existing raster fire textures, bounded particles and composite layers; no canvas. */
export function BedExplosionFx({ phase, reduced }: { phase: 'windup' | 'strike' | 'impact' | 'recover'; reduced: boolean }) {
  return <div className={`bed-cinematic bed-${phase} ${reduced ? 'bed-reduced' : ''}`} aria-hidden="true">
    <div className="bed-cinematic-vignette" />
    {(phase === 'windup' || phase === 'strike') && <div className="bed-cinematic-prop"><i className="bed-ground-glow" /><BattleBedModel />
      <img className="bed-burning-flame" src="/mining/dragon-burst-v1/flame.webp" alt="" /><i className="bed-ignition" />
      {Array.from({ length: 10 }, (_, i) => <i className="bed-ember" key={i} style={{ '--i': i } as CSSProperties} />)}
    </div>}
    {(phase === 'impact' || phase === 'recover') && <>
      <i className="bed-flash" /><div className="bed-blast-core"><img src="/mining/dragon-burst-v2/fire-core.webp" alt="" /><i /></div>
      <i className="bed-shockwave" /><i className="bed-shockwave bed-shockwave-two" />
      <svg className="bed-impact-rays" viewBox="0 0 400 300">{Array.from({ length: 12 }, (_, i) => <path key={i} d="m196 155 3-150 5 150Z" transform={`rotate(${i * 30} 200 155)`} />)}</svg>
      <div className="bed-debris">{Array.from({ length: 20 }, (_, i) => <i key={i} style={{ '--i': i, '--angle': `${i * 137.5}deg`, '--distance': `${70 + i % 5 * 27}px`, '--delay': `${i % 4 * 20}ms` } as CSSProperties} />)}</div>
      <div className="bed-smoke">{[0, 1, 2, 3, 4].map(i => <i key={i} style={{ '--i': i } as CSSProperties} />)}</div>
    </>}
  </div>;
}
