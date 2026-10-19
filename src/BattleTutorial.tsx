import { useEffect, useId, useRef, useState } from 'react';
import type { AdventureLocation } from './adventureState';
import type { DragonSkillKind } from './dragonSkillRules';
import { SkillGlyph } from './DragonSkillGame';
import { BattleIcon, GuardArt, SwordArt } from './BlazePrototypeVisuals';
import { BattleForecast } from './BattleForecast';
import { battleTutorialLessons, type BattleLesson } from './battleTutorialRules';
import './battleTutorial.css';

export function BattleLessonPicture({ page, location }: { page: BattleLesson; location: AdventureLocation }) {
  const dragonKey = `lesson-key-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const enemy = location === 'the_end' ? '/mining/Ender_Dragon.gif' : location === 'warped_forest' ? '/mining/Enderman.png' : '/mining/Blaze.webp';
  return <div className={`bl-picture bl-${page.skill ?? page.signal ?? page.id}`} role="img" aria-label={page.caption}>
    <div className="bl-halo" />
    {page.skill && <div className="bl-skill-symbol"><SkillGlyph kind={page.skill} /></div>}
    {page.signal && <div className="bl-signal"><BattleForecast signal={page.signal} /></div>}
    {(page.skill === 'burst' || page.skill === 'gauge' || page.signal || page.id === 'warp' || page.id === 'dragon' || page.id === 'attack' || page.id === 'guard') && (location === 'the_end' ? <svg className="bl-enemy" viewBox="0 0 200 160" aria-hidden="true"><defs><filter id={dragonKey} colorInterpolationFilters="sRGB"><feColorMatrix result="keyed" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -.2126 -.7152 -.0722 0 1" /><feComposite in="keyed" in2="SourceGraphic" operator="in" /></filter></defs><image className="bl-motion" href={enemy} width="200" height="160" filter={`url(#${dragonKey})`} /><image className="bl-still" href="/mining/Ender_Dragon_Campaign_v1.png" width="200" height="160" /></svg> : <img className="bl-enemy" src={enemy} alt="" />)}
    {page.skill === 'aim' && <><div className="bl-heal-example"><div className="bl-hearts" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map(i => <span key={i} className={i < 2 ? 'bl-heart-old' : i < 4 ? 'bl-heart-new' : 'bl-heart-empty'}>♥</span>)}</div><b>＋4 HP</b></div><div className="bl-reserve-example"><div className="bl-hearts" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map(i => <span key={i} className="bl-heart-old">♥</span>)}</div><div className="bl-light-reserve"><BattleIcon kind="shield" /><span>＋4</span></div></div></>}
    {page.skill === 'burst' && <div className="bl-burn-hits">{[0, 1, 2].map(i => <span key={i} style={{ animationDelay: `${i * 1.1}s` }}>🔥<b>−5</b></span>)}</div>}
    {page.skill === 'gauge' && <><span className="bl-stopped">！<i>×</i></span><b className="bl-once">１</b></>}
    {page.skill === 'repel' && <div className="bl-water-ward"><BattleIcon kind="shield" /><span>½</span><i>● ●</i></div>}
    {page.id === 'warp' && <><img className="bl-ghost bl-ghost-left" src={enemy} alt="" /><img className="bl-ghost bl-ghost-right" src={enemy} alt="" /><div className="bl-sword"><SwordArt /></div></>}
    {page.id === 'attack' && <><div className="bl-sword"><SwordArt /></div><div className="bl-gauge-pips">✦ ✦ ✦</div></>}
    {page.id === 'guard' && <div className="bl-guard-figure"><GuardArt /><span>♥ ♥ ♡</span></div>}
    {page.id === 'food' && <div className="bl-food-figure"><BattleIcon kind="bread" /><span>♥ ♥</span></div>}
    {page.id === 'ticket' && <div className="bl-ticket-figure"><BattleIcon kind="ticket" /><span>➜</span><b>● ●<br />● ●</b></div>}
    {page.id === 'dragon' && <div className="bl-targets"><span>◎</span><span>◎</span><span>◎</span></div>}
    {page.signal === 'charge' && <div className="bl-gather" aria-hidden="true">✦</div>}
    {page.signal === 'rest' && <span className="bl-rest-breath" aria-hidden="true">…</span>}
  </div>;
}

export function BattleTutorial({ location, unlocked, fresh = [], replay = false, onDone }: { location: AdventureLocation; unlocked: readonly DragonSkillKind[]; fresh?: readonly DragonSkillKind[]; replay?: boolean; onDone: () => void }) {
  const pages = battleTutorialLessons(location, unlocked, fresh), [index, setIndex] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null), heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => { heading.current?.focus(); }, [index]);
  const page = pages[Math.min(index, pages.length - 1)], last = index >= pages.length - 1;
  return <dialog className="bl-dialog" ref={dialog} aria-label={replay ? 'えで あそびかたを みる' : 'はじめての たたかい'} onCancel={e => { e.preventDefault(); onDone(); }}>
    <header><small>{page.fresh ? 'あたらしい ひっさつ！' : 'えで みてみよう'}</small><button type="button" aria-label="説明をとじて遊ぶ" onClick={onDone}>×</button></header>
    <h2 tabIndex={-1} ref={heading}>{page.fresh ? `${page.title}を おぼえた！` : page.title}</h2>
    <BattleLessonPicture key={page.id} page={page} location={location} />
    <p>{page.caption}</p>
    <nav aria-label="説明のページ"><button type="button" aria-label="前の説明" disabled={index === 0} onClick={() => setIndex(value => value - 1)}>◀</button><span aria-label={`説明${index + 1}/${pages.length}`}>{pages.map((p, i) => <i key={p.id} className={i === index ? 'is-current' : ''} />)}</span><button type="button" aria-label={last ? '説明をおえて遊ぶ' : '次の説明'} onClick={() => last ? onDone() : setIndex(value => value + 1)}>{last ? '▶ あそぶ' : '▶'}</button></nav>
  </dialog>;
}
