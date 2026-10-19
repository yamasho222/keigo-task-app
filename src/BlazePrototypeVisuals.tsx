import type { BlazeIntent, BlazeSwordTier } from './blazePrototypeEngine';
import type { CSSProperties } from 'react';
import type { BlazePlaybackStage } from './blazePrototypePlayback';
import { BLAZE_ACTIONS_PER_TICKET } from './blazePrototypeEngine';
import { BLAZE_SWORD_IMAGES } from './blazePrototypeAssets';
import { DragonElementArt } from './DragonElementArt';
import { BattleForecast } from './BattleForecast';
import { BattleGuardArt } from './BattleGuardArt';
import { blazeForecast } from './battleForecastRules';

export type BattleIconKind = 'shield' | 'bread' | 'ticket' | 'back' | 'next' | 'close' | 'sound' | 'mute' | 'settings' | 'replay' | 'play';
export function GuardArt({ shield = false }: { shield?: boolean }) {
  return <BattleGuardArt shield={shield} />;
}
export function BattleIcon({ kind }: { kind: BattleIconKind }) {
  return <svg className={`bp-icon bp-icon-${kind}`} viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
    {kind === 'shield' ? <><path fill="#8ddaf5" stroke="#d7f6ff" d="m32 5 23 9v18c0 16-23 27-23 27S9 48 9 32V14Z" /><path fill="#2a779e" stroke="none" d="M32 12v39c7-5 16-13 16-21V19Z" /><path stroke="#fff" d="m21 31 8 8 15-17" /></>
    : kind === 'bread' ? <><path fill="#d79143" stroke="#ffe2a0" d="M8 48V29C-1 18 9 8 21 12c7-8 23-6 27 2 12-1 19 13 8 20v14c-10 8-38 8-48 0Z" /><path stroke="#754321" strokeWidth="5" d="m23 20-5 10m19-12-5 12m17-6-4 9" /><path stroke="#f7bc68" d="M15 43c8 4 24 4 33 0" /></>
    : kind === 'ticket' ? <><path fill="#f1be57" stroke="#ffe5a3" d="M5 14h54v12c-9 0-9 12 0 12v12H5V38c9 0 9-12 0-12Z" /><path stroke="#9b6325" strokeWidth="3" strokeDasharray="3 6" d="M43 16v32" /><path fill="#fff0bc" stroke="none" d="m25 21 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z" /></>
    : kind === 'back' ? <path d="M40 12 20 32l20 20M21 32h34" />
    : kind === 'next' ? <path d="m24 12 20 20-20 20" />
    : kind === 'close' ? <path d="m17 17 30 30m0-30L17 47" />
    : kind === 'play' ? <path fill="currentColor" stroke="none" d="M21 10v44l33-22Z" />
    : kind === 'replay' ? <><path d="M13 28a21 21 0 1 1 3 20M13 12v17h17" /></>
    : kind === 'settings' ? <><path d="m25 7-2 8-8 4-8-1-3 12 7 5 2 8-3 7 10 7 7-5h10l7 5 10-7-3-7 2-8 7-5-3-12-8 1-8-4-2-8Z" /><circle cx="32" cy="32" r="9" /></>
    : <><path d="M7 24h12L34 12v40L19 40H7Z" />{kind === 'sound' ? <path d="M43 23a14 14 0 0 1 0 18m8-26a25 25 0 0 1 0 34" /> : <path d="m44 25 13 14m0-14L44 39" />}</>}
  </svg>;
}

export function SwordArt({ tier = 'diamond', special = false }: { tier?: BlazeSwordTier; special?: boolean }) {
  return <span className={`bp-sword-art ${special ? 'is-special' : ''}`} aria-hidden="true">{tier === 'none' ? <span>✊</span> : <img src={BLAZE_SWORD_IMAGES[tier]} alt="" />}{special && <svg viewBox="0 0 80 80" className="bp-sword-lightning"><path d="m22 5-8 19h12l-8 19M66 30l-9 17h11L58 69" /><path d="M49 3v12M43 9h12" /></svg>}</span>;
}

/** Show HP actually removed, not the weapon's nominal power on an overkill. */
export function HitDamage({ beforeHp, hp, special = false }: { beforeHp: number; hp: number; special?: boolean }) {
  const amount = Math.max(0, beforeHp - hp);
  if (amount === 0) return null;
  return <span className={`bp-dealt-damage ${special ? 'is-special' : ''}`} aria-hidden="true">−{amount}</span>;
}

export function Hearts({ hp, previousHp = hp, maxHp = 20 }: { hp: number; previousHp?: number; maxHp?: number }) {
  return <div className="bp-hearts" role="img" aria-label={`体力 ハート${hp / 2} / ${maxHp / 2}`}>
    {Array.from({ length: Math.ceil(maxHp / 2) }, (_, i) => <span key={i} className={`bp-heart ${hp >= (i + 1) * 2 ? 'is-full' : hp === i * 2 + 1 ? 'is-half' : ''} ${previousHp > hp && previousHp > i * 2 && hp < (i + 1) * 2 ? 'just-lost' : ''}`} />)}
  </div>;
}

export function TicketMeter({ tickets, hands, buying }: { tickets: number; hands: number; buying: boolean }) {
  return <div className={`bp-ticket-meter ${buying ? 'is-buying' : ''}`} aria-label={`チケット${tickets}枚、${hands > 0 ? `支払い済みの行動あと${hands}回` : tickets > 0 ? `次のチケット1枚で${BLAZE_ACTIONS_PER_TICKET}回行動` : '行動できません'}`}>
    <div className="bp-ticket-stack" aria-hidden="true">{[0, 1, 2, 3].map(i => <span key={i} className={i < tickets ? '' : 'is-used'}><BattleIcon kind="ticket" /></span>)}</div>
    <span className="bp-ticket-link" aria-hidden="true">›</span>
    <div className={`bp-step-tokens ${hands === 0 && tickets > 0 ? 'is-next' : ''}`} aria-hidden="true">{Array.from({ length: BLAZE_ACTIONS_PER_TICKET }, (_, i) => <span key={i} className={i < hands ? 'is-filled' : ''}><i /></span>)}</div>
    {buying && <span className="bp-ticket-fly" aria-hidden="true"><BattleIcon kind="ticket" /></span>}
  </div>;
}

export function BlazeTelegraph({ intent, stunned = false }: { intent: BlazeIntent; stunned?: boolean }) {
  return <div className={`bp-telegraph bp-telegraph-${intent}`} role="img" aria-label={intent === 'charge' ? '火をためている。今は反撃なし。次は大きな火球' : stunned ? 'しびれている。今回は攻撃なし' : intent === 'burst' ? '大きな火球がくる' : '小さな火球がくる'}>
    <div className="bp-fire-picture" aria-hidden="true">{intent === 'charge' ? <div className="bp-charge-vortex"><svg className="bp-gather-arrows" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 12 22 22m-14 0h14V20M88 12 66 34m0-14v14h14M50 90V62m-10 12 10-12 10 12" /></svg>{Array.from({ length: 6 }, (_, i) => <i key={i} style={{ '--ray': i * 60 } as CSSProperties} />)}</div> : <>{intent === 'burst' && <span className="bp-burst-crown" />}<span className="bp-fireball"><svg viewBox="0 0 64 64"><path fill="#ffdf73" d="M35 3c5 18-12 19-5 32 2-9 11-10 14-20 19 20 15 43-12 45C6 62 0 38 17 23c-3 14 8 15 8 5 0-12 12-13 10-25Z" /><path fill="#fff8ce" d="M33 30c-12 9-15 25 1 25 13 0 12-12 7-17-1 8-8 6-8-8Z" /></svg></span>{intent === 'burst' && <b className="bp-warning-mark">!</b>}</>}</div>
    <BattleForecast signal={blazeForecast(intent, stunned)} />
  </div>;
}

export function BlazeGathering() {
  return <div className="bp-gather-cloud" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--ray': i * 45 } as CSSProperties} />)}</div>;
}

/** Dedicated special phases: not a scaled-up normal slash. Also reused by the picture lesson. */
export function BlazeUltimateFx({ stage, tier = 'diamond', intent = 'burst', demonstration = false }: { stage?: BlazePlaybackStage; tier?: BlazeSwordTier; intent?: BlazeIntent; demonstration?: boolean }) {
  const charge = demonstration || stage === 'focus';
  const cut = demonstration || stage === 'strike';
  const impact = demonstration || stage === 'impact';
  const shatter = demonstration || stage === 'counter' || stage === 'hurt';
  return <div className={`bp-ultimate-fx ${demonstration ? 'is-demo' : ''}`} data-stage={stage} aria-hidden="true">
    {charge && <div className="bp-limit-focus"><span className="bp-limit-halo" /><SwordArt tier={tier} special /><div className="bp-limit-rays">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--ray': i * 45 } as CSSProperties} />)}</div></div>}
    {cut && <div className="bp-limit-cut"><i /><b /><span /><div className="bp-limit-sword"><SwordArt tier={tier} special /></div></div>}
    {impact && <div className="bp-limit-impact"><i /><b />{Array.from({ length: 8 }, (_, i) => <span key={i} style={{ '--ray': i * 45 } as CSSProperties} />)}</div>}
    {shatter && <div className={`bp-limit-shatter ${intent === 'charge' ? 'was-charging' : ''}`}>{intent !== 'charge' && <span className="bp-broken-orb"><i /><b /></span>}{Array.from({ length: 6 }, (_, i) => <i className="bp-limit-shard" key={i} style={{ '--ray': i * 60 } as CSSProperties} />)}</div>}
    <span className="bp-limit-label">ひっさつ</span>
  </div>;
}

export function BattleDemo({ lesson }: { lesson: number }) {
  return <div key={lesson} className={`bp-demo bp-demo-${lesson}`} aria-label={['剣で攻撃すると敵の体力が減り、必殺の光がたまる実演', 'まもると火球のダメージが減る実演。完全ガードではない', 'パンを1個食べてハートが回復する実演', `チケット1枚が${BLAZE_ACTIONS_PER_TICKET}回の行動になる実演。攻撃・守る・必殺に共通`, '光が3個たまると水の必殺で玉を打ち返し、続く2回の攻撃のダメージを半分にする実演', '火を集めた次は大きな火球。敵の様子が変わる実演'][lesson]} role="img">
    {lesson === 0 ? <><div className="bp-demo-enemy"><div className="bp-demo-hp"><i /></div><img src="/mining/Blaze.webp" alt="" /></div><div className="bp-demo-sword"><SwordArt /></div><span className="bp-demo-charge-dot" /></>
    : lesson === 1 ? <><Hearts hp={13} previousHp={20} /><span className="bp-demo-fire"><BlazeTelegraph intent="burst" /></span><div className="bp-demo-shield"><GuardArt /></div></>
    : lesson === 2 ? <><div className="bp-demo-bread"><BattleIcon kind="bread" /></div><div className="bp-demo-recovery"><Hearts hp={10} /><div><Hearts hp={20} /></div></div></>
    : lesson === 3 ? <><div className="bp-demo-ticket"><BattleIcon kind="ticket" /></div><span className="bp-demo-arrow">›</span><div className="bp-demo-actions">{Array.from({ length: BLAZE_ACTIONS_PER_TICKET }, (_, i) => <span key={i} />)}</div><div className="bp-demo-paid"><SwordArt /><GuardArt /><SwordArt special /></div></>
    : lesson === 4 ? <><DragonElementArt kind="repel" power={.8} phase="charge" reduced={false} /><div className="bp-demo-charge"><i /><i /><i /></div></>
    : <><img className="bp-demo-blaze" src="/mining/Blaze.webp" alt="" /><div className="bp-demo-forecast-charge"><BlazeTelegraph intent="charge" /></div><div className="bp-demo-forecast-burst"><BlazeTelegraph intent="burst" /></div></>}
  </div>;
}
