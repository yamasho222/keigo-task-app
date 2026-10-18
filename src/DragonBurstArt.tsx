import { useEffect, useId, useRef, type CSSProperties } from 'react';
import { BURST_ASSETS, BURST_EMBERS, BURST_INFLOW, BURST_SPARKS, BURST_WEAPON_IMAGES, burstVisualPower } from './dragonBurstPresentation';
import type { SwordTier } from './campaignEquipment';
import './dragonBurstArt.css';

export type BurstTapPoint = { x: number; y: number };
type Props = {
  power: number; reduced: boolean; active?: boolean; beat?: number; point?: BurstTapPoint; sword?: SwordTier;
  phase: 'charge' | 'result' | 'windup' | 'strike' | 'impact' | 'recover';
};

/** Layered raster + DOM animation. Never starts a clock or dispatches a battle action. */
export function DragonBurstArt({ power: rawPower, reduced, active = true, beat = 0, point = { x: 50, y: 43 }, phase, sword }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const flowId = `burst-flow-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const { power, tier } = burstVisualPower(rawPower);
  useEffect(() => {
    if (!beat || reduced || !active || phase !== 'charge' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animations: Animation[] = [];
    const animate = (selector: string, frames: Keyframe[], duration: number) => {
      const element = root.current?.querySelector(selector);
      if (element && typeof element.animate === 'function') animations.push(element.animate(frames, { duration, easing: 'cubic-bezier(.16,.75,.3,1)' }));
    };
    animate('.db-nucleus-kick', [{ transform: 'scale(.9)' }, { transform: 'scale(1.1)', offset: .3 }, { transform: 'scale(1)' }], 260);
    animate('.db-tap-halo', [{ opacity: .8, transform: 'scale(.45)' }, { opacity: 0, transform: 'scale(1.7)' }], 360);
    animate('.db-charge-light', [{ opacity: .8 }, { opacity: .12 }], 240);
    return () => animations.forEach(animation => animation.cancel());
  }, [beat, reduced, active, phase]);
  return <div ref={root} className={`db-art db-energy db-${phase} db-tier-${tier} ${active ? 'db-active' : 'db-idle'} ${reduced ? 'db-reduced' : ''}`}
    style={{ '--db-power': power, '--db-spin-duration': `${24 - power * 16}s` } as CSSProperties} aria-hidden="true" data-renderer="energy-v2">
    <svg className="db-flow-defs" width="0" height="0" focusable="false"><defs><filter id={flowId} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".014 .028" numOctaves="2" seed="17" result="flow">{!reduced && active && <animate attributeName="baseFrequency" values=".014 .028;.018 .035;.014 .028" dur="2.8s" repeatCount="indefinite" />}</feTurbulence><feDisplacementMap in="SourceGraphic" in2="flow" scale={reduced ? 0 : 6 + power * 8} xChannelSelector="R" yChannelSelector="G" /></filter></defs></svg>
    <div className="db-depth" /><div className="db-smoke db-smoke-left" /><div className="db-smoke db-smoke-right" />
    <div className="db-floor" /><div className="db-charge-light" />
    <div className="db-heat"><img className="db-flame db-flame-back" src={BURST_ASSETS.flame} alt="" draggable={false} /><img className="db-flame db-flame-front" src={BURST_ASSETS.flame} alt="" draggable={false} /></div>
    {(phase === 'charge' || phase === 'result' || phase === 'windup' || phase === 'strike') && <div className="db-core-shell"><div className="db-core-float"><div className="db-nucleus-kick"><div className="db-core-glow" /><img className="db-nucleus" src={BURST_ASSETS.core} alt="" draggable={false} /><img className="db-nucleus-sheen" src={BURST_ASSETS.core} alt="" draggable={false} style={{ filter: reduced ? undefined : `url(#${flowId})` }} /><div className="db-core-center" /></div></div></div>}
    {sword && sword !== 'none' && (phase === 'windup' || phase === 'strike') && <div className="db-equipped-weapon" data-sword={sword}><img src={BURST_WEAPON_IMAGES[sword]} alt="" draggable={false} /><i /></div>}
    {phase === 'charge' && active && beat > 0 && <div key={`inflow-${beat}`} className="db-inflow">{BURST_INFLOW.map((spark, i) => <i key={i} style={{ '--db-in-x': `${spark.x}cqw`, '--db-in-y': `${spark.y}cqh`, animationDelay: `${spark.delay}ms` } as CSSProperties} />)}</div>}
    <div className="db-embers">{BURST_EMBERS.map((ember, i) => <i key={i} style={{ left: `${ember.x}%`, width: ember.size, height: ember.size * 2.2, '--db-delay': `${ember.delay}s`, '--db-duration': `${ember.duration}s`, '--db-drift': `${ember.drift}px` } as CSSProperties} />)}</div>
    <div className="db-debris">{[0, 1, 2, 3, 4, 5].map(i => <i key={i} style={{ left: `${13 + i * 14}%`, bottom: `${12 + i % 3 * 5}%`, '--db-rock': i, '--db-delay': `${-i * .37}s` } as CSSProperties} />)}</div>
    {phase === 'charge' && beat > 0 && <div key={beat} className="db-tap-fx" style={{ left: `${point.x}%`, top: `${point.y}%` }}><i className="db-tap-halo" /><b className="db-tap-core" />{BURST_SPARKS.map((spark, i) => <i key={i} className="db-tap-spark" style={{ '--db-spark-x': `${spark.x}px`, '--db-spark-y': `${spark.y}px`, '--db-spark-angle': `${i * 36}deg` } as CSSProperties} />)}<i className="db-absorb" style={{ '--db-absorb-x': `${50 - point.x}cqw`, '--db-absorb-y': `${43 - point.y}cqh` } as CSSProperties} /></div>}
    {(phase === 'strike' || phase === 'impact' || phase === 'recover') && <div className="db-strike-layers"><img className="db-slash db-slash-trail" src={BURST_ASSETS.slash} alt="" draggable={false} /><img className="db-slash db-slash-main" src={BURST_ASSETS.slash} alt="" draggable={false} /><div className="db-contact-glow" /><div className="db-ground-wave" /></div>}
    <div className="db-vignette" />
  </div>;
}
