import type { CSSProperties } from 'react';
import { BattleGuardArt } from './BattleGuardArt';
import './battleSpectacle.css';
import './dragonBattleEffects.css';

export type BattleSpectacleProps = {
  kind: 'slash' | 'ultimate' | 'enemy' | 'enemyUltimate' | 'guard' | 'heal' | 'break' | 'bed' | 'victory';
  phase: 'windup' | 'strike' | 'impact' | 'recover';
  variant?: 'blaze' | 'enderman' | 'dragon';
  shield?: boolean;
  reduced?: boolean;
  buddies?: { id: string; image: string; level: number }[];
  seed?: number;
  /** Actual engine HP delta, not nominal weapon power. Only shown at impact. */
  amount?: number;
  critical?: boolean;
};

function particleStyle(index: number, seed: number): CSSProperties {
  // Stable on rerender/SSR; particles never consume the battle's randomness.
  const jitter = ((Math.trunc(seed) % 997) * 17 + index * 47) % 23;
  return { '--bs-angle': `${index * 30 + jitter}deg`, '--bs-distance': `${56 + index % 4 * 16}px`, '--bs-delay': `${index % 3 * 35}ms` } as CSSProperties;
}

function Sparks({ seed, confetti = false }: { seed: number; confetti?: boolean }) {
  return <div className={`bs-particles ${confetti ? 'bs-confetti' : ''}`}>
    {Array.from({ length: 12 }, (_, index) => <i className="bs-particle" key={index} style={particleStyle(index, seed)} />)}
  </div>;
}

function Rings() {
  return <div className="bs-rings"><i className="bs-ring" /><i className="bs-ring bs-ring-outer" /></div>;
}

function Blade({ className = '' }: { className?: string }) {
  return <svg className={`bs-blade ${className}`} viewBox="0 0 100 160" fill="none">
    <path className="bs-blade-edge" d="m50 5 16 26-6 76H40L34 31Z" />
    <path className="bs-blade-seam" d="M50 17v86" />
    <path className="bs-blade-hilt" d="M24 105h52v12H56v29H44v-29H24Z" />
    <path className="bs-blade-seam" d="m44 126 12 8m-12 0 12 8" />
  </svg>;
}

/** Pure presentation: parent playback owns phases, hit timing, input lock and cleanup.
 * Mount inside a positioned arena. Change key per action (not per phase).
 * No timers, rules, storage, sound or completion callback live in this layer.
 */
export function BattleSpectacle({ kind, phase, variant = 'blaze', shield = false, reduced = false, buddies = [], seed = 0, amount, critical = false }: BattleSpectacleProps) {
  const special = kind === 'ultimate';
  const incoming = kind === 'enemy' || kind === 'enemyUltimate';
  const contact = phase === 'impact';
  const showAmount = contact && Number.isFinite(amount) && amount! > 0 && ['slash', 'ultimate', 'enemy', 'enemyUltimate', 'heal', 'bed'].includes(kind);
  return <div className={`bs-scene bs-${kind} bs-${variant} bs-phase-${phase}${reduced ? ' bs-reduced' : ''}${shield ? ' bs-shielded' : ''}${critical ? ' bs-critical' : ''}`} aria-hidden="true" data-bs-kind={kind} data-bs-phase={phase}>
    {critical && contact && <div className="battle-critical-flash"><b>かいしん！</b><svg viewBox="0 0 300 230"><path d="m12 10 273 205-41-68L12 10Zm277-2L14 216l62-29L289 8Z" /></svg></div>}
    {special && <div className="bs-backdrop" />}
    {special && phase === 'windup' && <div className="bs-gather"><div className="bs-orbit bs-orbit-a" /><div className="bs-orbit bs-orbit-b" /><Blade /><Sparks seed={seed} /></div>}
    {special && phase === 'strike' && <div className="bs-combo">
      {[0, 1, 2].map(index => <div className={`bs-combo-hit bs-combo-hit-${index}`} key={index}>
        <svg className="bs-combo-trail" viewBox="0 0 300 180" fill="none"><path d="M18 148Q94 10 280 34Q145 42 68 161" /></svg><Blade />
      </div>)}
    </div>}
    {special && contact && <div className="bs-finisher"><div className="bs-falling-blade"><Blade /></div><div className="bs-impact-star" /><Rings /><Sparks seed={seed} /><div className="bs-ground-cracks" /></div>}
    {special && phase === 'recover' && <div className="bs-release"><Rings /><Sparks seed={seed} /></div>}
    {kind === 'slash' && <div className="bs-cut">
      {phase === 'strike' && <><svg className="bs-cut-trail" viewBox="0 0 320 200" fill="none"><path d="M20 160Q105 12 300 42Q115 45 58 179" /></svg><Blade /></>}
      {contact && <><div className="bs-contact-notch" /><Sparks seed={seed} /></>}
    </div>}
    {incoming && <div className="bs-incoming">
      {phase === 'windup' && <div className="bs-threat"><i className="bs-threat-chevron" /><i className="bs-threat-chevron" />{kind === 'enemyUltimate' && <i className="bs-threat-crown" />}</div>}
      {phase === 'strike' && <div className="bs-projectiles">
        {Array.from({ length: kind === 'enemyUltimate' ? 3 : 1 }, (_, index) => <div className={`bs-bolt bs-bolt-${index}`} key={index}>
          {variant === 'enderman' || (variant === 'dragon' && kind === 'enemy') ? <svg className="bs-claw" viewBox="0 0 100 120"><path d="m16 8 8 70-14 32 28-26-3-63m12-17 4 73-8 34 24-31-4-64m16 0 1 64-3 26 18-34-1-47" /></svg> : <svg className="bs-flame" viewBox="0 0 100 120"><path d="M56 5c14 29-13 34-3 52 9-7 14-15 14-25 36 31 37 75-16 82C4 116-3 72 23 43c-1 22 14 26 15 9C29 31 52 28 56 5Z" /><path className="bs-flame-core" d="M50 62c-26 22-20 41 2 42 20-1 21-21 11-31-1 15-16 16-13-11Z" /></svg>}
        </div>)}
      </div>}
      {contact && <div className="bs-enemy-contact"><div className="bs-contact-notch" /><Rings /><Sparks seed={seed} /></div>}
    </div>}
    {kind === 'guard' && <div className="bs-defense">
      <BattleGuardArt shield={shield} large />
      {contact && <div className="bs-block-contact"><Rings /><Sparks seed={seed} /><svg className="bs-deflected" viewBox="0 0 260 100" fill="none"><path d="M130 87Q102 12 10 22m0 0 14-12M130 87Q158 12 250 22m0 0-14-12" /></svg></div>}
    </div>}
    {kind === 'heal' && <div className="bs-restoration">
      {phase === 'windup' && <svg className="bs-loaf" viewBox="0 0 100 80"><path d="M12 62V36C-2 15 17 2 34 13c15-15 32-5 37 2 21-3 33 17 18 28v19c-19 13-58 13-77 0Z" /><path className="bs-loaf-score" d="m30 25-7 13m25-16-8 16m27-10-7 13" /></svg>}
      {phase !== 'windup' && <><div className="bs-healing-pool" />{[0, 1, 2].map(index => <svg className={`bs-rising-heart bs-heart-${index}`} viewBox="0 0 60 60" key={index}><path d="M30 54 7 31C-9 10 18-3 30 15 42-3 69 10 53 31Z" /></svg>)}<Sparks seed={seed} /></>}
    </div>}
    {kind === 'break' && <div className="bs-shatter"><div className="bs-broken-half bs-half-left" /><div className="bs-broken-half bs-half-right" /><Sparks seed={seed} /></div>}
    {kind === 'bed' && <div className="bs-bed-burst">
      {phase === 'windup' ? <svg className="bs-bed-picture" viewBox="0 0 200 120"><path className="bs-bed-frame" d="M14 60h172v35H14zM20 95h12v20H20zm148 0h12v20h-12z" /><path className="bs-bed-cover" d="M18 44h164v35H18z" /><path className="bs-bed-pillow" d="M24 44h45v24H24z" /></svg> : <><div className="bs-dust bs-dust-a" /><div className="bs-dust bs-dust-b" /><div className="bs-dust bs-dust-c" /><Rings /><Sparks seed={seed} /><div className="bs-ground-cracks" /></>}
    </div>}
    {kind === 'victory' && <div className="bs-victory-atmosphere"><div className="bs-victory-beam" /><div className="bs-victory-horizon" /><Sparks seed={seed} confetti /></div>}
    {special && phase === 'windup' && buddies.length > 0 && <div className="bs-buddies">{buddies.slice(0, 4).map((buddy, index) => <div className="bs-buddy" key={buddy.id} style={{ '--bs-slot': index } as CSSProperties}>
      <img className="bs-buddy-image" src={buddy.image} alt="" /><div className="bs-buddy-stars">{Array.from({ length: Math.min(3, Math.max(1, Math.floor(buddy.level) || 1)) }, (_, star) => <i className="bs-buddy-star" key={star} />)}</div>
    </div>)}</div>}
    {showAmount && <span className="bs-amount">{kind === 'heal' ? '+' : '−'}{amount}</span>}
  </div>;
}
