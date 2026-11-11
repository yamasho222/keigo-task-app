import { useEffect, useRef, useState } from 'react';
import { campaignGearImage, campaignUpgradeCost, CAMPAIGN_MATERIALS, TIER_LABELS, type CampaignEquipment, type CampaignSupplies, type AttackEnchant, type EnchantRank } from './campaignEquipment';
import { ATTACK_MAGIC, enchantPracticeDamage, type AttackMagic } from './attackEnchantPresentation';
import './attackEnchantWorkshop.css';

export function AttackMagicGlyph({ kind }: { kind: AttackMagic }) {
  return <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className="aw-glyph">
    {kind === 'power' ? <><path d="m15 42 5-22 7-5 5 3 6-5 6 4 6 2 2 15-10 16-18 1Z" fill="currentColor" opacity=".22"/><path d="m15 42 5-22 7-5 5 3 6-5 6 4 6 2 2 15-10 16-18 1Z M27 20l-2 13m10-12-2 12m9-11-2 12M16 37l13 4" stroke="currentColor" strokeWidth="3" strokeLinejoin="round"/><path d="m8 24-5-4m12-8-2-6m41 7 5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></>
      : kind === 'ultimate' ? <><path d="m32 4 7 18 20 10-20 7-7 21-8-21L5 32l19-10Z" fill="currentColor" opacity=".22"/><path d="m32 4 7 18 20 10-20 7-7 21-8-21L5 32l19-10Z" stroke="currentColor" strokeWidth="2.5"/><path d="m36 18-13 16h9l-4 14 16-20H33Z" fill="currentColor"/></>
        : <><path d="m27 5 22 15-7 29-17 10L12 40l3-23Z" fill="currentColor" opacity=".2"/><path d="m27 5 22 15-7 29-17 10L12 40l3-23Z M27 5l1 19-13-7m13 7 21-4M28 24l-7 11 15 4-11 20m11-20 6 10" stroke="currentColor" strokeWidth="2.5"/><path d="m50 41 8 4m-5-14 8-2M6 48l-4 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></>}
  </svg>;
}

function Stars({ rank }: { rank: number }) {
  return <span className="aw-stars" role="img" aria-label={`ほし${rank}こ`}>{[1, 2, 3].map(n => <span key={n} className={n <= rank ? 'is-lit' : ''}>★</span>)}</span>;
}

function Materials({ cost, supplies }: { cost: Readonly<Record<string, number>>; supplies: CampaignSupplies }) {
  return <div className="aw-materials">{Object.entries(cost).map(([id, amount]) => {
    const item = CAMPAIGN_MATERIALS[id], held = supplies.materials[id] ?? 0;
    return <div key={id} className={held < amount ? 'is-short' : ''}>
      <img src={item.image} alt=""/><span>{item.label}<strong>{amount}<small>こ</small></strong></span>
      <small>{held >= amount ? `✓ ${held}こ ある` : `あと ${amount - held}こ`}</small>
    </div>;
  })}</div>;
}

function Practice({ kind, rank, equipment, dragon }: { kind: AttackMagic; rank: EnchantRank; equipment: CampaignEquipment; dragon: boolean }) {
  const [special, setSpecial] = useState(kind === 'ultimate'), [hit, setHit] = useState(0);
  const part = kind === 'break';
  const base = enchantPracticeDamage(equipment, 'none', 0, special, dragon, part);
  const damage = enchantPracticeDamage(equipment, kind, rank, special, dragon, part);
  return <div className="aw-practice">
    <div className="aw-practice-top"><span>ためしうち</span><span>🎟️ 0 · ざいりょう 0</span></div>
    <div className="aw-arena" key={`${hit}-${special}`}>
      <div className="aw-orbit"/>
      <div className={`aw-target${hit ? ' is-hit' : ''}`}>
        {part ? <AttackMagicGlyph kind="break"/> : <svg viewBox="0 0 100 100" aria-hidden="true"><path d="M43 92V28h14v64M15 45h70" stroke="#92765a" strokeWidth="9"/><path d="M28 20h44v51H28Z" fill="#80664f" stroke="#d2b693" strokeWidth="3"/><circle cx="50" cy="44" r="17" fill="#282c38" stroke="#e5d3b3" strokeWidth="3"/><circle cx="50" cy="44" r="7" fill="#e5d3b3"/></svg>}
      </div>
      {hit > 0 && <>{equipment.sword !== 'none' && <img className="aw-sword" src={campaignGearImage(`sword_${equipment.sword}`)} alt=""/>}<i className="aw-slash"/><span className="aw-damage">{damage}<small>{damage > base ? `+${damage - base}` : 'そのまま'}</small></span></>}
      <span className="aw-arena-label">{part ? 'クリスタルを ねらう' : 'れんしゅうの まと'}</span>
    </div>
    <div className="aw-practice-controls" aria-label="ためす攻撃">
      <button type="button" aria-pressed={!special} onClick={() => { setSpecial(false); setHit(0); }}>👊 こうげき</button>
      <button type="button" aria-pressed={special} onClick={() => { setSpecial(true); setHit(0); }}>👊❗ ひっさつ</button>
      <button type="button" className="aw-try" onClick={() => setHit(n => n + 1)}>▶ ためす</button>
    </div>
    <p className="aw-comparison" role="status">{hit ? <>まほうなし <b>{base}</b><span>→</span>このまほう <strong>{damage}</strong></> : '▶ をおすと、つよさが わかるよ'}</p>
    <details className="aw-numbers"><summary>ダメージの くわしい おはなし</summary><p>{TIER_LABELS[equipment.sword]}のけん・★{rank}。{dragon ? 'エンドラ戦' : 'ブレイズ・エンダーマン戦'}の基本ダメージです。必殺は50点。仲間・水・会心・弱点・バリア・残りHPによる変化は含めません。</p></details>
  </div>;
}

type Props = {
  equipment: CampaignEquipment; supplies: CampaignSupplies; endUnlocked: boolean;
  checkApply: (kind: AttackMagic) => string | undefined; upgradeError?: string;
  onApply: (kind: AttackMagic) => void; onUpgrade: () => void;
};

function Purchase({ kind, rank, next, cost, supplies, error, onOk, onClose }: {
  kind: AttackMagic; rank: number; next: number; cost: Readonly<Record<string, number>>;
  supplies: CampaignSupplies; error?: string; onOk: () => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null), clicked = useRef(false);
  useEffect(() => { ref.current?.showModal(); }, []);
  const close = () => { ref.current?.close(); onClose(); };
  return <dialog ref={ref} className={`aw-purchase aw-${kind}`} aria-labelledby="aw-purchase-title" onCancel={event => { event.preventDefault(); close(); }}>
    <AttackMagicGlyph kind={kind}/><h3 id="aw-purchase-title">{rank === 0 ? 'まほうを つける？' : 'ほしを ふやす？'}</h3>
    <div className="aw-star-change"><Stars rank={rank}/><span>→</span><Stars rank={next}/></div>
    <p>この ざいりょうを つかうよ</p><Materials cost={cost} supplies={supplies}/>
    <small>かならず せいこう · チケットは つかわない</small>
    {error && <p role="alert">{error}</p>}
    <button type="button" className="aw-primary" disabled={!!error} onClick={() => { if (!clicked.current) { clicked.current = true; ref.current?.close(); onOk(); } }}>{rank === 0 ? '✦ まほうを つける' : '★ つよくする'}</button>
    <button type="button" className="aw-cancel" onClick={close}>もどる</button>
  </dialog>;
}

export function AttackEnchantWorkshop({ equipment, supplies, endUnlocked, checkApply, upgradeError, onApply, onUpgrade }: Props) {
  const current = equipment.attack;
  const [choice, setChoice] = useState<AttackMagic>(current.kind === 'none' ? 'power' : current.kind);
  const [purchase, setPurchase] = useState<{ rank: EnchantRank; equipped: AttackEnchant; kind: AttackMagic; upgrade: boolean } | null>(null);
  const meta = ATTACK_MAGIC.find(item => item.kind === choice)!;
  const previewRank = (current.rank || 1) as EnchantRank;
  const equipped = current.kind === choice && current.rank > 0;
  const cost = campaignUpgradeCost(current.rank);
  const applyError = checkApply(choice);
  const locked = choice === 'break' && !endUnlocked && current.kind !== 'break';
  const purchaseError = purchase && (purchase.rank !== current.rank || purchase.equipped !== current.kind)
    ? 'まほうが かわったよ。もどって たしかめよう。' : purchase?.upgrade ? upgradeError : purchase ? checkApply(purchase.kind) : undefined;
  return <section className={`aw-workshop aw-${choice}`} aria-label="けんのまほう工房">
    <header className="aw-header"><img src="/mining/Enchanted_Book.gif" alt=""/><div><small>けんを もっと つよく</small><h3>けんの まほう</h3></div><Stars rank={current.rank}/></header>
    <div className="aw-equipped">{equipment.sword === 'none' ? <span aria-hidden="true">👊</span> : <img src={campaignGearImage(`sword_${equipment.sword}`)} alt=""/>}<span>いま：{current.rank && current.kind !== 'none' ? ATTACK_MAGIC.find(item => item.kind === current.kind)?.name : 'まほう なし'}</span><small>{equipment.sword === 'none' ? 'けんを つくろう' : `${TIER_LABELS[equipment.sword]}のけん`}</small></div>
    <p className="aw-prompt">どんな つよさに する？</p>
    <div className="aw-choices" role="group" aria-label="まほうを選んで試す">{ATTACK_MAGIC.map(item => {
      const unavailable = item.kind === 'break' && !endUnlocked && current.kind !== 'break';
      return <button key={item.kind} type="button" className={`aw-choice aw-${item.kind}`} aria-pressed={choice === item.kind} onClick={() => setChoice(item.kind)}>
        <AttackMagicGlyph kind={item.kind}/><strong>{item.name}</strong><small>{unavailable ? '🔒 エンドで' : item.caption}</small>
        <span className="aw-choice-check" aria-hidden="true">{choice === item.kind ? '✓' : ''}</span>
      </button>;
    })}</div>
    <div className="aw-detail"><span className="aw-recommend">{locked ? 'ジ・エンドで つかえるよ' : meta.hint}</span><p>{meta.message}</p>
      <div className="aw-benefit"><AttackMagicGlyph kind={choice}/><strong>{choice === 'power' ? `こうげき +${previewRank}` : choice === 'ultimate' ? `ひっさつ +${previewRank * 4}` : `こわす力 +${previewRank * 2}`}</strong><Stars rank={previewRank}/></div>
      {choice === 'break' && <small>クリスタル・つばさ・大きなたまだけ。ひっさつは +{previewRank * 4}。</small>}
      {current.rank === 0 && <small>★1を つけたときの つよさ</small>}
    </div>
    <Practice key={`${choice}-${previewRank}-${equipment.sword}`} kind={choice} rank={previewRank} equipment={equipment} dragon={endUnlocked || choice === 'break'}/>
    <div className="aw-action">
      {equipped ? <><div className="aw-active">✓ このまほうが ついているよ</div>{cost ? <>
        <div className="aw-upgrade-preview"><Stars rank={current.rank}/><span>→</span><Stars rank={current.rank + 1}/><strong>{choice === 'power' ? `こうげき +${current.rank} → +${current.rank + 1}` : choice === 'ultimate' ? `ひっさつ +${current.rank * 4} → +${(current.rank + 1) * 4}` : `こわす力 +${current.rank * 2} → +${(current.rank + 1) * 2}`}</strong></div>
        <Materials cost={cost} supplies={supplies}/><button type="button" className="aw-primary" disabled={!!upgradeError} onClick={() => setPurchase({ rank: current.rank, equipped: current.kind, kind: choice, upgrade: true })}>★ ほしを ふやす</button>{upgradeError && <p className="aw-reason">{upgradeError}</p>}
      </> : <p className="aw-max">★★★ さいきょうの まほう！</p>}</>
      : <>{current.rank === 0 && cost && <Materials cost={cost} supplies={supplies}/>}<button type="button" className="aw-primary" disabled={!!applyError || locked} onClick={() => {
        if (current.rank > 0) onApply(choice);
        else setPurchase({ rank: current.rank, equipped: current.kind, kind: choice, upgrade: false });
      }}>{current.rank > 0 ? '✦ このまほうに かえる' : '✦ このまほうを つける'}</button>{(applyError || locked) && <p className="aw-reason">{locked ? 'ジ・エンドに いけるように なったら つかえるよ。' : applyError}</p>}</>}
      <p className="aw-footnote">つけるのは 1つ。つけかえは 無料。<br/>そだてた ★は、どのまほうでも つかえるよ。</p>
    </div>
    {purchase && <Purchase kind={purchase.kind} rank={purchase.rank} next={purchase.rank + 1} cost={campaignUpgradeCost(purchase.rank)!} supplies={supplies} error={purchaseError} onClose={() => setPurchase(null)} onOk={() => { if (purchase.upgrade) onUpgrade(); else onApply(purchase.kind); setPurchase(null); }}/>}
  </section>;
}
