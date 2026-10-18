import { useEffect, useId, useRef, type CSSProperties } from 'react';
import { ELEMENT_ASSETS, ELEMENT_MOTES, type DragonElementKind } from './dragonElementPresentation';
import { BLAZE_SWORD_IMAGES } from './blazePrototypeAssets';
import type { SwordTier } from './campaignEquipment';
import './dragonElementArt.css';

type Props = {
  kind: DragonElementKind; power: number; reduced: boolean; active?: boolean; beat?: number;
  phase: 'charge' | 'result' | 'windup' | 'strike' | 'impact' | 'recover';
  sword?: SwordTier; shots?: readonly number[];
};
/** Texture composition only. Inputs, score, enemy turns and additional effects live elsewhere. */
export function DragonElementArt({ kind, power: rawPower, reduced, active = true, beat = 0, phase, sword, shots = [] }: Props) {
  const root = useRef<HTMLDivElement>(null), id = `element-flow-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const power = Number.isFinite(rawPower) ? Math.max(0, Math.min(1, rawPower)) : 0;
  const assets = ELEMENT_ASSETS[kind], charge = phase === 'charge' || phase === 'result';
  useEffect(() => {
    if (!beat || reduced || !active || phase !== 'charge' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animations: Animation[] = [];
    for (const element of root.current?.querySelectorAll('.de-reactive') ?? []) {
      if (typeof element.animate === 'function') animations.push(element.animate([{ scale: '.9', filter: 'brightness(1.25)' }, { scale: '1.1', filter: 'brightness(1.15)', offset: .3 }, { scale: '1', filter: 'brightness(1)' }], { duration: 380, easing: 'ease-out' }));
    }
    return () => animations.forEach(animation => animation.cancel());
  }, [beat, reduced, active, phase]);
  return <div ref={root} className={`de-art de-${kind} de-${phase} ${active ? 'de-active' : 'de-idle'} ${reduced ? 'de-reduced' : ''}`} style={{ '--de-power': power } as CSSProperties} data-renderer={`element-${kind}-v1`} aria-hidden="true">
    <svg className="de-defs" width="0" height="0" focusable="false"><defs><filter id={id} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".012 .025" numOctaves="2" seed="31" result="current">{kind === 'repel' && !reduced && active && <animate attributeName="baseFrequency" values=".012 .025;.017 .031;.012 .025" dur="3.2s" repeatCount="indefinite" />}</feTurbulence><feDisplacementMap in="SourceGraphic" in2="current" scale={reduced ? 0 : 5 + power * 7} xChannelSelector="R" yChannelSelector="G" /></filter></defs></svg>
    <div className="de-backdrop" /><div className="de-haze" /><div className="de-ground" />
    {kind === 'aim' && charge ? <div className="de-prisms">{[0, 1, 2].map(i => <div key={i} className={`de-prism ${shots[i] !== undefined ? 'de-prism-lit' : ''}`} style={{ '--de-prism': i, '--de-prism-power': shots[i] !== undefined ? .45 + shots[i] / 100 * .55 : .3 } as CSSProperties}><div className="de-reactive"><img src={assets.core} alt="" draggable={false} /><i /></div></div>)}</div>
      : (charge || phase === 'windup' || phase === 'strike') && <div className="de-core-field"><div className="de-core-float"><div className="de-reactive"><i className="de-core-glow" /><img className="de-core" src={assets.core} alt="" draggable={false} style={{ filter: kind === 'repel' && !reduced ? `url(#${id})` : undefined }} /><img className="de-core-echo" src={assets.core} alt="" draggable={false} /></div></div></div>}
    <div className="de-motes">{ELEMENT_MOTES.map((mote, i) => <i key={i} style={{ left: `${mote.x}%`, top: `${mote.y}%`, width: mote.size, height: mote.size, animationDelay: `${mote.delay}s` } as CSSProperties} />)}</div>
    {beat > 0 && phase === 'charge' && <div key={beat} className="de-input-burst"><i /><b />{kind === 'aim' && <span style={{ left: `${25 + Math.min(2, beat - 1) * 25}%` }} />}</div>}
    {sword && sword !== 'none' && (phase === 'windup' || phase === 'strike') && <div className="de-weapon" data-sword={sword}><img src={BLAZE_SWORD_IMAGES[sword]} alt="" draggable={false} /></div>}
    {(phase === 'strike' || phase === 'impact' || phase === 'recover') && <div className="de-release"><img className="de-blast de-blast-echo" src={assets.strike} alt="" draggable={false} /><img className="de-blast de-blast-main" src={assets.strike} alt="" draggable={false} /><i className="de-contact" /><i className="de-shock-ground" /></div>}
    <div className="de-vignette" />
  </div>;
}
