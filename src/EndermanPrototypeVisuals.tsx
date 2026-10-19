import { BlazeUltimateFx, GuardArt, SwordArt } from './BlazePrototypeVisuals';
import type { BlazeSwordTier } from './blazePrototypeEngine';
import type { EndermanIntent, EndermanItem } from './endermanPrototypeEngine';
import type { EndermanStage } from './endermanPrototypePlayback';
import { EndermanBucket, EndermanPond } from './EndermanPond';
import { BattleForecast } from './BattleForecast';
import { endermanForecast } from './battleForecastRules';

export function EndermanItemArt({ item }: { item: EndermanItem }) {
  return item === 'none' ? <svg className="ep-empty-hand" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><rect x="9" y="9" width="46" height="46" rx="9" strokeDasharray="5 5" /><path d="M22 33v9c0 7 22 7 22-3V27c0-4-6-4-6 0v-9c0-4-6-4-6 0v12-12c0-4-6-4-6 0v14-8c0-4-6-4-6 0v12" /></svg>
    : item === 'water' ? <EndermanBucket /> : <img className="ep-item-art" src={item === 'shield' ? '/mining/Shield.webp' : '/mining/Cobblestone.png'} alt="" />;
}

export function EndermanAfterimages({ wet, intent, busy, dodged }: { wet: boolean; intent: EndermanIntent; busy: boolean; dodged: boolean }) {
  if (wet || (!dodged && (intent !== 'warp' || busy))) return null;
  return <><img className="ep-warp-ghost ep-ghost-left" src="/mining/Enderman.png" alt="" /><img className="ep-warp-ghost ep-ghost-right" src="/mining/Enderman.png" alt="" /></>;
}

export function EndermanTelegraph({ intent, wet, stunned = false }: { intent: EndermanIntent; wet: boolean; stunned?: boolean }) {
  const waterStopsWarp = wet && intent === 'warp';
  const label = stunned && (intent === 'ambush' || intent === 'approach') ? 'しびれている。今回は攻撃なし' : waterStopsWarp ? '足元にひるんでいる。ワープできない' : intent === 'warp' ? 'ワープの気配。通常攻撃はよけられる' : intent === 'ambush' ? 'とびかかってくる。強い攻撃' : intent === 'opening' ? 'すきができた。今は反撃なし' : '近づいてきた。通常攻撃がくる';
  return <div className={`ep-telegraph ep-sign-${waterStopsWarp ? 'water' : intent}`} role="img" aria-label={label}>
    <BattleForecast signal={endermanForecast(intent, stunned)} detail={label} />
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
  return <div className={`ep-demo ep-demo-${lesson}`} role="img" aria-label={['ワープの気配がある時の通常攻撃は空振り。でも必殺の光はたまる', '盾で待つとエンダーマンが現れ、攻撃のチャンスになる', '光が3つの必殺はワープにも命中する。追加効果は選んだ技ごとに異なる'][lesson]}>
    <img className="ep-demo-mob" src="/mining/Enderman.png" alt="" />
    {lesson === 0 ? <><img className="ep-demo-ghost" src="/mining/Enderman.png" alt="" /><SwordArt /><span className="ep-demo-light">✦</span><EndermanTelegraph intent="warp" wet={false} /></>
    : lesson === 1 ? <><GuardArt /><EndermanTelegraph intent="opening" wet={false} /></>
    : <><div className="ep-demo-lights">✦ ✦ ✦</div><EndermanUltimate stage="impact" tier="diamond" /></>}
  </div>;
}
