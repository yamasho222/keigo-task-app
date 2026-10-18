import type { CSSProperties } from 'react';
import { DRAGON_TECHNIQUE_NAMES, type DragonTechnique } from './dragonCampaignAdventure';
import { SKILL_TITLES, type DragonSkillKind } from './dragonSkillRules';
import { DragonSkillArt } from './DragonSkillArt';
import { DragonBurstArt } from './DragonBurstArt';
import { burstAssetsFailed, richBurstEnabled } from './dragonBurstPresentation';
import type { SwordTier } from './campaignEquipment';
import { DragonElementArt } from './DragonElementArt';
import { elementAssetsFailed, richElementEnabled } from './dragonElementPresentation';
import './dragonAttackFx.css';

type Props = {
  stage: 'windup' | 'strike' | 'impact' | 'recover';
  technique: DragonTechnique;
  special: boolean;
  counter: boolean;
  stroke: number;
  reduced: boolean;
  buddies: { id: string; image: string; level: number }[];
  assist?: boolean;
  skill?: DragonSkillKind;
  power?: number;
  sword?: SwordTier;
  critical?: boolean;
};

/** Target-local effects. No game state, timing, input or random draws in presentation. */
export function DragonAttackFx({ stage, technique, special, counter, stroke, reduced, buddies, assist = false, skill, power = .5, sword, critical = false }: Props) {
  if (special && skill === 'burst' && !burstAssetsFailed() && richBurstEnabled(typeof window === 'undefined' ? '' : window.location.search)) return <div className={`du-cast du-burst du-burst-rich du-${stage} ${reduced ? 'du-reduced' : ''}`} aria-hidden="true">
    <DragonBurstArt key={stage} power={power} phase={stage} reduced={reduced} sword={sword} />
    <div className="du-cinematic-top" /><div className="du-cinematic-bottom" />
    {stage === 'windup' && <div className="du-title"><b>{SKILL_TITLES.burst}</b><i /></div>}
  </div>;
  if (special && skill && skill !== 'burst' && !elementAssetsFailed(skill) && richElementEnabled(typeof window === 'undefined' ? '' : window.location.search)) return <div className={`du-cast du-${skill} du-element-rich du-${stage} ${reduced ? 'du-reduced' : ''}`} aria-hidden="true">
    <DragonElementArt key={`${skill}-${stage}`} kind={skill} power={power} phase={stage} reduced={reduced} sword={sword} />
    <div className="du-cinematic-top" /><div className="du-cinematic-bottom" />
    {stage === 'windup' && <div className="du-title"><b>{SKILL_TITLES[skill]}</b><i /></div>}
  </div>;
  if (special && skill) return <div className={`du-cast du-${skill} du-${stage} ${reduced ? 'du-reduced' : ''}`} aria-hidden="true">
    <DragonSkillArt key={`${skill}-${stage}`} kind={skill} power={Math.max(.25, power)} reduced={reduced} phase={stage === 'recover' ? 'impact' : stage} />
    <div className="du-cinematic-top" /><div className="du-cinematic-bottom" />
    {stage === 'windup' && <div className="du-title"><small>LIMIT BREAK</small><b>{SKILL_TITLES[skill]}</b><i /></div>}
    {(stage === 'strike' || stage === 'impact') && <>
      {skill === 'burst' && <><i className="du-fire-column" /><i className="du-flame-cut" /><i className="du-flame-cut du-flame-echo" /></>}
      {skill === 'gauge' && <><i className="du-thunder-column" /><i className="du-thunder-ground" /></>}
      {skill === 'repel' && <><i className="du-water-wave" /><i className="du-water-wave du-wave-two" /><i className="du-water-spout" /></>}
      {skill === 'aim' && <><i className="du-light-ray" /><i className="du-light-ray du-ray-two" /><i className="du-light-lens" /></>}
      {stage === 'impact' && <><i className="du-contact-ring" /><i className="du-contact-ring du-ring-two" /><div className="du-impact-rays">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ '--du-angle': `${i * 360 / 14}deg` } as CSSProperties} />)}</div></>}
    </>}
  </div>;
  const helper = buddies.length ? buddies[stroke % buddies.length] : null;
  return <div className={`da-fx da-${stage} da-${special ? technique : counter ? 'counter' : `cut-${stroke % 3}`} ${special ? 'da-special' : ''} ${critical ? 'da-critical' : ''} ${reduced ? 'da-reduced' : ''}`} aria-hidden="true">
    {critical && (stage === 'strike' || stage === 'impact') && <><i className="da-critical-glint" /><svg className="da-critical-cross" viewBox="0 0 320 240"><path d="M28 22 289 215 260 171 46 41Z" /><path d="M292 22 32 215 62 171 274 41Z" /></svg></>}
    {!special && assist && helper && (stage === 'strike' || stage === 'impact') && <div className="da-buddy-assist"><img src={helper.image} alt="" /><svg viewBox="0 0 120 60"><path d="M5 50Q55 1 112 20m-20-9 20 9-18 15" /></svg></div>}
    {special && stage === 'windup' && <>
      <div className="da-callout">{DRAGON_TECHNIQUE_NAMES[technique]}</div>
      <div className="da-party">{buddies.slice(0, 3).map(buddy => <img key={buddy.id} src={buddy.image} alt="" />)}</div>
      <div className="da-gather" />
    </>}
    {(stage === 'strike' || stage === 'impact') && <>
      <svg className="da-trails" viewBox="0 0 320 240" fill="none">
        {(!special || technique === 'cleave') && <>
          <path className="da-cut da-cut-a" d="M22 193Q109 28 297 45Q144 76 51 210" />
          {(special || counter) && <path className="da-cut da-cut-b" d="M288 208Q209 32 24 51Q179 82 267 222" />}
        </>}
        {special && technique === 'shatter' && <>
          <path className="da-crystal" d="m160 20 55 87-55 111-55-111Z" />
          {Array.from({ length: 8 }, (_, i) => <path key={i} className="da-shard" style={{ '--da-angle': `${i * 45}deg` } as CSSProperties} d="m154 104 6-47 9 49-9 15Z" />)}
        </>}
        {special && technique === 'dive' && <>
          <path className="da-dive-trail" d="m100 3 56 147m2-147 9 155m51-155-42 151" />
          <path className="da-sword" d="m160 18 15 23-7 101h24v9h-24l-8 25-8-25h-24v-9h24l-7-101Z" />
          <ellipse className="da-shockwave" cx="160" cy="187" rx="115" ry="24" />
        </>}
        {special && technique === 'reflect' && <>
          <path className="da-return" d="M36 212Q270 236 169 45m0 0-29 48m29-48 45 27" />
          <circle className="da-return-ball" cx="168" cy="83" r="32" />
        </>}
        {special && technique === 'seal' && <>
          <ellipse className="da-seal-ring" cx="160" cy="125" rx="120" ry="48" />
          <ellipse className="da-seal-ring da-seal-cross" cx="160" cy="125" rx="120" ry="48" />
          <path className="da-seal-crosscut" d="m66 36 191 180M254 36 64 216" />
        </>}
      </svg>
      {stage === 'impact' && <div className="da-impact"><i />{Array.from({ length: special ? 10 : 5 }, (_, i) => <b key={i} style={{ '--da-angle': `${i * (special ? 36 : 72)}deg` } as CSSProperties} />)}</div>}
      {counter && !special && <div className="da-counter-ring" />}
    </>}
  </div>;
}

/** A separate beat after the player's hit. No new turn or damage calculation here. */
export function DragonAllyFx({ buddies, stroke, special, impact, reduced }: { buddies: Props['buddies']; stroke: number; special: boolean; impact: boolean; reduced: boolean }) {
  const party = special ? buddies.slice(0, 3) : buddies.length ? [buddies[stroke % buddies.length]] : [];
  return <div className={`da-ally ${impact ? 'da-ally-impact' : ''} ${reduced ? 'da-reduced' : ''}`} aria-hidden="true">
    <div className="da-ally-band" /><b>なかまの ついげき！</b>
    <div className="da-ally-portraits">{party.map((buddy, i) => <img key={buddy.id} src={buddy.image} alt="" style={{ '--da-delay': `${i * 60}ms` } as CSSProperties} />)}</div>
    <svg className="da-ally-slash" viewBox="0 0 480 320"><path d="M24 268Q165 18 452 67Q228 75 67 288Z" /><path d="M49 274Q239 59 444 72" /></svg>
    {impact && <i className="da-ally-contact" />}
  </div>;
}

