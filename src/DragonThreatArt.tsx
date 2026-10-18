import type { CSSProperties } from 'react';
import { DRAGON_THREAT_ASSETS } from './dragonThreatPresentation';
import './dragonThreatArt.css';

export type DragonThreatKind = 'claw' | 'gust' | 'breath' | 'orb' | 'storm';
export type DragonThreatPhase = 'windup' | 'strike' | 'impact';
/** Layered art and deterministic transforms only. No Canvas, RNG or game mutations. */
export function DragonThreatArt({ kind, phase, reduced, guarded = false }: { kind: DragonThreatKind; phase: DragonThreatPhase; reduced: boolean; guarded?: boolean }) {
  const heavy = !['claw', 'gust'].includes(kind);
  const texture = kind === 'breath' ? 'breath' : kind === 'storm' ? 'storm' : 'orb';
  return <div className={`dt-art dt-${kind} dt-${phase} ${reduced ? 'dt-calm' : ''} ${guarded ? 'dt-guarded' : ''}`} aria-hidden="true">
    <div className="dt-atmosphere" />
    {phase === 'windup' && <><div className="dt-mouth"><i />{heavy && <img src={DRAGON_THREAT_ASSETS.orb} alt="" />}</div><div className="dt-inward">{Array.from({ length: heavy ? 8 : 3 }, (_, i) => <i key={i} style={{ '--dt-angle': `${i * (heavy ? 45 : 120)}deg` } as CSSProperties} />)}</div></>}
    {phase !== 'windup' && <>
      {heavy ? <div className="dt-projectile" key={phase}><i className="dt-fallback" /><img src={DRAGON_THREAT_ASSETS[texture]} alt="" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />{kind === 'storm' && <img className="dt-storm-echo" src={DRAGON_THREAT_ASSETS.storm} alt="" />}</div>
        : kind === 'claw' ? <svg className="dt-claws" viewBox="0 0 500 400" fill="none"><g className="dt-claw-glow">{[0, 1, 2].map(i => <path key={i} d={`M${110 + i * 70} 70 Q${140 + i * 70} 188 ${45 + i * 110} 345`} />)}</g><g className="dt-claw-edge">{[0, 1, 2].map(i => <path key={i} d={`M${110 + i * 70} 70 Q${140 + i * 70} 188 ${45 + i * 110} 345`} />)}</g></svg>
          : <div className="dt-gust-rings">{[0, 1, 2].map(i => <i key={i} style={{ '--dt-delay': `${i * 90}ms` } as CSSProperties} />)}</div>}
      {phase === 'impact' && <><div className="dt-contact" /><div className="dt-shockwave" /><div className="dt-embers">{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ '--dt-angle': `${i * 36}deg` } as CSSProperties} />)}</div></>}
    </>}
    {guarded && <div className="dt-shield-plane"><svg viewBox="0 0 200 200"><path d="M100 8 177 36v57c0 45-34 76-77 99-43-23-77-54-77-99V36Z" /><path d="m59 96 29 28 55-59" /></svg></div>}
  </div>;
}
