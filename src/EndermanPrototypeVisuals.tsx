import { BattleIcon, BlazeUltimateFx, SwordArt } from './BlazePrototypeVisuals';
import type { BlazeSwordTier } from './blazePrototypeEngine';
import type { EndermanIntent, EndermanItem } from './endermanPrototypeEngine';
import type { EndermanStage } from './endermanPrototypePlayback';
import { EndermanBucket, EndermanPond } from './EndermanPond';

export function EndermanItemArt({ item }: { item: EndermanItem }) {
  return item === 'none' ? <svg className="ep-empty-hand" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><rect x="9" y="9" width="46" height="46" rx="9" strokeDasharray="5 5" /><path d="M22 33v9c0 7 22 7 22-3V27c0-4-6-4-6 0v-9c0-4-6-4-6 0v12-12c0-4-6-4-6 0v14-8c0-4-6-4-6 0v12" /></svg>
    : item === 'water' ? <EndermanBucket /> : <img className="ep-item-art" src={item === 'shield' ? '/mining/Shield.webp' : '/mining/Cobblestone.png'} alt="" />;
}

export function EndermanAfterimages({ wet, intent, busy, dodged }: { wet: boolean; intent: EndermanIntent; busy: boolean; dodged: boolean }) {
  if (wet || (!dodged && (intent !== 'warp' || busy))) return null;
  return <><img className="ep-warp-ghost ep-ghost-left" src="/mining/Enderman.png" alt="" /><img className="ep-warp-ghost ep-ghost-right" src="/mining/Enderman.png" alt="" /></>;
}

export function EndermanTelegraph({ intent, wet }: { intent: EndermanIntent; wet: boolean }) {
  const waterStopsWarp = wet && intent === 'warp';
  const label = waterStopsWarp ? '足元にひるんでいる。ワープできない' : intent === 'warp' ? 'ワープの気配。通常攻撃はよけられる' : intent === 'ambush' ? 'とびかかってくる。強い攻撃' : intent === 'opening' ? 'すきができた。今は反撃なし' : '近づいてきた。通常攻撃がくる';
  return <div className={`ep-telegraph ep-sign-${waterStopsWarp ? 'water' : intent}`} role="img" aria-label={label}>
    {waterStopsWarp ? <><svg className="ep-flinch-sign" viewBox="0 0 100 80" aria-hidden="true"><path d="m34 16 3 17-10 7 10 7-3 17m32-48-3 17 10 7-10 7 3 17M46 29v14m8-14v14" /></svg><span>びくっ！</span></>
    : intent === 'warp' ? <><svg viewBox="0 0 100 80" aria-hidden="true"><ellipse cx="50" cy="42" rx="33" ry="24" /><path d="m67 12 10 7-11 7M33 72l-10-7 11-7M26 42h10m28 0h10" /><path className="ep-ghost-mark" d="M45 31h10v23H45z" /></svg><span>ゆらゆら…</span></>
    : intent === 'ambush' ? <><b aria-hidden="true">!</b><svg viewBox="0 0 100 70" aria-hidden="true"><path d="m10 15 35 20L10 55m35-40 35 20-35 20" /></svg><span>くるぞ！</span></>
    : intent === 'opening' ? <><svg viewBox="0 0 100 80" aria-hidden="true"><path d="m50 5 8 24 25 11-25 9-8 24-8-24-25-9 25-11z" /></svg><span>いまだ！</span></>
    : <><svg viewBox="0 0 100 80" aria-hidden="true"><path d="m20 20 25 20-25 20m30-40 25 20-25 20" /></svg><span>ちかづく…</span></>}
  </div>;
}

export function EndermanUltimate({ stage, tier }: { stage?: EndermanStage; tier: BlazeSwordTier }) {
  return <><BlazeUltimateFx stage={stage} tier={tier} intent="charge" />{stage && ['focus', 'strike', 'impact'].includes(stage) && <div className={`ep-warp-bind ep-bind-${stage}`} aria-hidden="true"><i /><b /><span>✦</span></div>}</>;
}

/** A visual memory of avoiding a puddle, not an instruction to equip an item. */
export function EndermanCluePicture() {
  return <div className="ep-clue-memory" role="img" aria-label="エンダーマンが足元をさけている絵"><EndermanPond compact /><img src="/mining/Enderman.png" alt="" /><svg className="ep-clue-arrow" viewBox="0 0 110 80" aria-hidden="true"><path d="M22 45Q38 7 76 25m-7-10 10 11-14 4" /></svg></div>;
}

export function EndermanDemo({ lesson }: { lesson: number }) {
  return <div className={`ep-demo ep-demo-${lesson}`} role="img" aria-label={['ワープの気配がある時の通常攻撃は空振り。でも必殺の光はたまる', '盾で待つとエンダーマンが現れ、攻撃のチャンスになる', '光が3つの必殺は、ワープもつかまえて反撃を止める'][lesson]}>
    <img className="ep-demo-mob" src="/mining/Enderman.png" alt="" />
    {lesson === 0 ? <><img className="ep-demo-ghost" src="/mining/Enderman.png" alt="" /><SwordArt /><span className="ep-demo-light">✦</span><EndermanTelegraph intent="warp" wet={false} /></>
    : lesson === 1 ? <><BattleIcon kind="shield" /><EndermanTelegraph intent="opening" wet={false} /></>
    : <><div className="ep-demo-lights">✦ ✦ ✦</div><EndermanUltimate stage="impact" tier="diamond" /></>}
  </div>;
}
