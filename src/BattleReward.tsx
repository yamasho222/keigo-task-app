import type { RefObject } from 'react';
import { BattleSpectacle } from './BattleSpectacle';
import './battleReward.css';

/** Presentation only. Rewards have already been committed by the battle engine. */
export function BattleReward({ enemy, item, image, headingRef, variant = 'blaze', reduced = false }: {
  enemy: string; item: string; image: string;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  variant?: 'blaze' | 'enderman' | 'dragon'; reduced?: boolean;
}) {
  return <div className={`br-reward br-${variant}${reduced ? ' br-reduced' : ''}`}>
    <BattleSpectacle kind="victory" phase="impact" variant={variant} reduced={reduced} />
    <div className="br-content">
      <span className="br-defeated">{enemy}を たおした！</span>
      <div className="br-display"><div className="br-pedestal" aria-hidden="true" /><img className="br-item" src={image} alt={item} /></div>
      <h2 ref={headingRef} tabIndex={-1}>{variant === 'dragon' ? 'だいしょうり！' : 'やったー！'}</h2>
      <p className="br-item-name">{item}<strong>× 1</strong></p>
    </div>
  </div>;
}
