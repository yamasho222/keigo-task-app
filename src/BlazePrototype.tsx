import type { BlazePort } from './adventurePorts';
import { BreadRecoveryHelp } from './EndChapterNoticePanel';
import { recoveryAvailability } from './endChapterNotices';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { actOnBlaze, createBlazeRun, BLAZE_ACTIONS_PER_TICKET, BLAZE_ARMOR_COST, blazeFullArmor, blazeAttackDamage, blazeIncomingDamage, blazeArmorReductionRate, type BlazeAction, type BlazeLoadout, type BlazeArmorSlot, type BlazeArmorTier, type BlazeRun, type BlazeEvent } from './blazePrototypeEngine';
import { createBlazeAudio, type BlazeAudioCue } from './blazePrototypeAudio';
import { buildBlazePlayback, type BlazePlaybackFrame } from './blazePrototypePlayback';
import { BattleIcon, BattleDemo, BlazeGathering, BlazeTelegraph, GuardArt, Hearts, SwordArt, TicketMeter } from './BlazePrototypeVisuals';
import { BattleSpectacle } from './BattleSpectacle';
import { BLAZE_LESSONS, BLAZE_SWORD_IMAGES } from './blazePrototypeAssets';
import './blazePrototype.css';

type Modal = 'help' | 'gear' | 'leave' | 'setup' | 'reset' | null;
type Setup = { loadout: BlazeLoadout; startHp: 'full' | 'half'; item: 'none' | 'shield' };
type Animation = { id: number; action: BlazeAction; before: BlazeRun; frame: BlazePlaybackFrame; events: BlazeEvent[] };
const SLOTS: BlazeArmorSlot[] = ['helmet', 'chest', 'leggings', 'boots'];
const SLOT_NAMES = { helmet: 'あたま', chest: 'むね', leggings: 'あし', boots: 'くつ' };
const TIER_NAMES = { none: 'なし', iron: '鉄', gold: '金', diamond: 'ダイヤ', netherite: 'ネザライト' };
function cloneSetup(s: Setup): Setup { return { ...s, loadout: { sword: s.loadout.sword, armor: { ...s.loadout.armor } } }; }
function armorImage(slot: BlazeArmorSlot, tier: BlazeArmorTier) {
  if (tier === 'none') return undefined;
  if (tier === 'netherite' && (slot === 'chest' || slot === 'leggings')) return `/mining/netherite_${slot === 'chest' ? 'chestplate' : 'leggings'}.png`;
  const prefix = { iron: 'Iron', gold: 'Golden', diamond: 'Diamond', netherite: 'Netherite' }[tier];
  return `/mining/${prefix}_${{ helmet: 'Helmet', chest: 'Chestplate', leggings: 'Leggings', boots: 'Boots' }[slot]}.webp`;
}
function percent(n: number) { return (n * 100).toLocaleString('ja-JP', { maximumFractionDigits: 2 }); }

export default function BlazePrototype({ production }: { production?: BlazePort } = {}) {
  const [localRun, setRun] = useState(() => createBlazeRun());
  const run = production?.run ?? localRun;
  const [setup, setSetup] = useState<Setup>(() => ({ loadout: createBlazeRun().loadout, startHp: 'full', item: 'none' }));
  const [draft, setDraft] = useState(() => cloneSetup(setup));
  const current = useRef(run);
  const [animation, setAnimation] = useState<Animation | null>(null);
  const [busy, setBusy] = useState(false), busyRef = useRef(false);
  const timers = useRef<number[]>([]), sequence = useRef(0);
  const [sound, setSound] = useState(true), audio = useRef<ReturnType<typeof createBlazeAudio> | null>(null);
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // Disposable prototype: show a skippable picture lesson on a fresh visit, without storage.
  const [modal, setModal] = useState<Modal>(production?.seenHelp ? null : 'help'), dialog = useRef<HTMLDialogElement>(null);
  const [lesson, setLesson] = useState(0);
  const resultHeading = useRef<HTMLHeadingElement>(null), titleHeading = useRef<HTMLHeadingElement>(null);
  const [notice, setNotice] = useState('');
  const [recoveryHelp, setRecoveryHelp] = useState(false);
  useLayoutEffect(() => { current.current = run; }, [run]);
  useEffect(() => () => { timers.current.forEach(window.clearTimeout); audio.current?.dispose(); }, []);
  useEffect(() => {
    if (modal && !dialog.current?.open) dialog.current?.showModal();
    if (!modal && dialog.current?.open) dialog.current?.close();
  }, [modal]);
  useEffect(() => { if (run.phase !== 'battle' && !busy) resultHeading.current?.focus(); }, [run.phase, busy]);
  useEffect(() => { const original = document.title; document.title = production ? 'ブレイズ戦' : 'ブレイズ戦・試験環境'; return () => { document.title = original; }; }, []);
  function dismissModal() { if (modal === 'help') production?.onHelp(); setModal(null); }
  function commit(next: BlazeRun) { current.current = next; if (!production) setRun(next); }
  function playCue(cue: BlazeAudioCue) {
    if (!sound) return;
    audio.current ??= createBlazeAudio();
    audio.current.play(cue);
  }
  function act(action: BlazeAction) {
    if (busyRef.current || modal || recoveryHelp) return;
    const before = current.current;
    const result = production ? production.act(action) : actOnBlaze(before, action);
    if (result.error) { setNotice(result.error); return; }
    setNotice('');
    if (action.kind === 'return') { commit(result.state); return; }
    if (sound) { audio.current ??= createBlazeAudio(); audio.current.unlock(); }
    busyRef.current = true; setBusy(true);
    timers.current.forEach(window.clearTimeout); timers.current = [];
    const playback = buildBlazePlayback(before, result.state, action, result.events);
    const id = ++sequence.current;
    playback.frames.forEach(frame => {
      const show = () => {
        setAnimation({ id, action, before, frame, events: result.events });
        const counter = result.events.some(event => event.kind === 'counter');
        if (frame.stage === 'strike') playCue(action.kind === 'ultimate' ? 'ultimate' : 'slash');
        if (frame.stage === 'heal') playCue('heal');
        if (frame.stage === 'impact' && result.events.some(event => event.kind === 'slash' || event.kind === 'ultimate')) playCue('impact');
        if (frame.stage === 'impact' && result.events.some(event => event.kind === 'kill')) playCue('break');
        if (frame.stage === 'counter' && counter) playCue(before.enemies[0].intent === 'burst' ? 'enemyUltimate' : 'enemy');
        if (frame.stage === 'counter' && action.kind === 'ultimate' && before.enemies[0].intent !== 'charge') playCue('break');
        if (frame.stage === 'hurt' && counter) playCue(action.kind === 'guard' ? 'guard' : 'impact');
      };
      if (frame.at === 0) show();
      else timers.current.push(window.setTimeout(show, frame.at));
    });
    timers.current.push(window.setTimeout(() => {
      commit(result.state); setAnimation(null); busyRef.current = false; setBusy(false); timers.current = [];
      if (result.state.phase === 'won') playCue('victory');
    }, playback.duration));
  }
  function reset(next: Setup = setup) {
    if (production) { run.phase === 'lost' ? production.retry() : production.next(); return; }
    audio.current?.stop();
    timers.current.forEach(window.clearTimeout); timers.current = [];
    busyRef.current = false; setBusy(false); setAnimation(null); setNotice('');
    const snapshot = cloneSetup(next); setSetup(snapshot); commit(createBlazeRun(snapshot)); setModal(null);
    timers.current.push(window.setTimeout(() => titleHeading.current?.focus(), 0));
  }
  function openSetup() { if (!busyRef.current) { setDraft(cloneSetup(setup)); setModal('setup'); } }
  function leave() {
    if (production) { const result = production.act({ kind: 'return' }); if (result.error) { setNotice(result.error); return; } production.onClose(); } else commit(actOnBlaze(current.current, { kind: 'return' }).state); setModal(null);
  }
  function equip(item: Setup['item']) {
    if (busyRef.current) return;
    const before = current.current;
    const result = before.phase === 'battle' ? production ? production.act({ kind: 'equip', item }) : actOnBlaze(before, { kind: 'equip', item }) : { state: { ...before, item } };
    if ('error' in result && result.error) { setNotice(result.error); return; }
    commit(result.state); setSetup(prev => ({ ...prev, item })); setNotice(''); setModal(null);
  }

  const shown = animation?.frame.shown ?? run;
  const stage = animation?.frame.stage;
  const action = animation?.action;
  const enemy = shown.enemies[0], dead = enemy.hp <= 0, playing = run.phase === 'battle';
  const canSpend = run.tickets > 0 || run.handsLeft > 0;
  const recovery = recoveryAvailability(production?.breadStock ?? run.bread, production?.foodToday ?? 0, run.hp, run.maxHp);
  const disabled = busy || !playing || !canSpend;
  const guarding = action?.kind === 'guard';
  const ultimate = action?.kind === 'ultimate';
  const damageDealt = Math.max(0, (animation?.before.enemies[0].hp ?? enemy.hp) - enemy.hp);
  const counter = animation?.events.some(event => event.kind === 'counter') ?? false;
  const receivesFire = counter && (stage === 'counter' || stage === 'hurt');
  const hurt = stage === 'hurt' && shown.hp < (animation?.before.hp ?? shown.hp);
  const guardedFire = guarding && receivesFire;
  const attackPhase = stage === 'focus' ? 'windup' : stage === 'strike' ? 'strike' : stage === 'impact' ? 'impact' : 'recover';
  const speaking = stage === 'ticket' ? `チケット1枚で、${BLAZE_ACTIONS_PER_TICKET}回行動できるよ。`
    : stage === 'focus' ? '剣に力をためている！'
    : stage === 'strike' ? ultimate ? 'ひっさつ！' : 'こうげき！'
    : stage === 'impact' ? `${damageDealt}ダメージ！ 敵の体力が減った！`
    : stage === 'guard' ? shown.item === 'shield' ? '盾をかまえた！' : '身をまもった！'
    : stage === 'eat' ? 'パンをたべた！'
    : stage === 'heal' ? 'ハートが回復した！'
    : guardedFire ? 'まもった！ ダメージをへらした。'
    : hurt ? '火球に当たって、ハートが減った。'
    : stage === 'counter' && ultimate ? '必殺で反撃をとめた！'
    : stage === 'counter' ? 'ブレイズが火をためている。'
    : playing ? !canSpend ? 'チケットがないよ。帰ろう。' : enemy.intent === 'charge' ? '火をためている。次は大きな火球。' : enemy.intent === 'burst' ? '大きな火球がくる。' : '小さな火球がくる。'
    : run.phase === 'won' ? 'ブレイズをたおした！ ブレイズロッドを1本てにいれた！' : run.phase === 'lost' ? 'たおされてしまった。' : 'ぶじに帰った。';

  if (!import.meta.env.DEV && !production) return <p>この画面は試験環境専用です。</p>;
  return <main className="bp-root" data-bp-reduced={reduced}><div className="bp-game">
    <header className="bp-header">
      <button className="bp-icon-button" aria-label="かえる" disabled={busy || !playing} onClick={() => setModal('leave')}><BattleIcon kind="back" /></button>
      <h1 ref={titleHeading} tabIndex={-1}>ネザーようさい {!production && <small>おためし</small>}</h1>
      <button className="bp-gear-button" aria-label={`そうび、もちもの：${run.item === 'shield' ? 'たて' : 'なし'}`} disabled={busy || (!!production && !playing)} onClick={() => { setNotice(''); setModal('gear'); }}><GuardArt shield={run.item === 'shield'} /><span>そうび</span></button>
      <button className="bp-icon-button bp-help-button" aria-label="絵であそびかたを見る" disabled={busy} onClick={() => { setLesson(0); setModal('help'); }}>?</button>
      {!production && <button className="bp-icon-button bp-parent-button" aria-label="保護者用の試験設定" disabled={busy} onClick={openSetup}><BattleIcon kind="settings" /></button>}
    </header>
    <div className="bp-resources"><TicketMeter tickets={shown.tickets} hands={shown.handsLeft} buying={stage === 'ticket'} /></div>

    <section className={`bp-arena bp-intent-${enemy.intent} ${hurt ? 'is-hit' : ''} ${ultimate ? `is-ultimate-${stage}` : ''}`} aria-label="ブレイズとの戦場" aria-busy={busy}>
      <div className="bp-world" aria-hidden="true" /><div className="bp-floor" aria-hidden="true" />
      <div className="bp-enemy-health"><div className="bp-enemy-health-line"><span>ブレイズ</span><strong className="bp-enemy-hp-number">{enemy.hp}<small> / {enemy.maxHp}</small></strong></div><div className="bp-enemy-hp" role="meter" aria-label="ブレイズの体力" aria-valuemin={0} aria-valuemax={enemy.maxHp} aria-valuenow={enemy.hp}><i style={{ width: `${enemy.hp / enemy.maxHp * 100}%` }} /></div></div>
      <div className={`bp-enemy-figure ${dead ? 'is-dead' : ''} ${stage === 'impact' ? 'just-struck' : ''}`}>
        <div className="bp-enemy-shadow" /><div className="bp-enemy-aura" />
        {!dead && enemy.intent === 'charge' && (!busy || (stage === 'counter' && !ultimate)) && <BlazeGathering />}
        <img className="bp-blaze-sprite" src="/mining/Blaze.webp" alt="ブレイズ" />
        {!dead && playing && (!busy || (stage === 'counter' && enemy.intent === 'charge' && !ultimate)) && <BlazeTelegraph intent={enemy.intent} />}
      </div>
      {animation && (action?.kind === 'strike' || ultimate) && stage !== 'ticket' && <BattleSpectacle key={`attack${animation.id}`} kind={ultimate ? 'ultimate' : 'slash'} phase={attackPhase} reduced={reduced} seed={animation.id} amount={damageDealt} />}
      {receivesFire && <BattleSpectacle key={`enemy${animation!.id}`} kind={enemy.intent === 'burst' ? 'enemyUltimate' : 'enemy'} phase={stage === 'counter' ? 'strike' : 'impact'} shield={guarding} reduced={reduced} seed={animation!.id} />}
      {guarding && stage !== 'ticket' && <BattleSpectacle key={`guard${animation!.id}`} kind="guard" phase={stage === 'hurt' && counter ? 'impact' : 'windup'} shield={run.item === 'shield'} reduced={reduced} seed={animation!.id} />}
      {ultimate && (stage === 'counter' || stage === 'hurt') && enemy.intent !== 'charge' && <BattleSpectacle key={`break${animation!.id}`} kind="break" phase={stage === 'counter' ? 'impact' : 'recover'} reduced={reduced} seed={animation!.id} />}
      {dead && stage === 'impact' && <BattleSpectacle key={`defeat${animation!.id}`} kind="break" phase="impact" reduced={reduced} seed={animation!.id} />}
      {(stage === 'eat' || stage === 'heal') && <BattleSpectacle key={`heal${animation!.id}`} kind="heal" phase={stage === 'eat' ? 'windup' : 'impact'} reduced={reduced} seed={animation!.id} />}
      {playing && !canSpend && !busy && <div className="bp-empty-ticket"><span aria-hidden="true"><BattleIcon kind="ticket" /><b>×</b></span><p>チケットが ないよ</p><button className="bp-large-button" onClick={() => setModal('leave')}><BattleIcon kind="back" />かえる</button></div>}
      {!playing && !busy && <div className={`bp-result bp-result-${run.phase}`}>
        {run.phase === 'won' && <BattleSpectacle kind="victory" phase="impact" reduced={reduced} seed={run.turn} />}
        <div className="bp-result-picture" aria-hidden="true">{run.phase === 'won' ? <><span>✦</span><img src="/mining/Blaze_Rod.webp" alt="" /><span>✦</span></> : <img src="/mining/Steve.png" alt="" />}</div>
        <h2 ref={resultHeading} tabIndex={-1}>{run.phase === 'won' ? 'やったー！' : run.phase === 'lost' ? 'また ちょうせん！' : 'ただいま！'}</h2>
        {run.phase === 'won' && <p>ブレイズロッド × 1</p>}
        <button className="bp-large-button" onClick={() => reset()}><BattleIcon kind="replay" />{production && run.phase === 'lost' ? '1まいで おきあがる（ハート5・4かい）' : 'もういちど'}</button>
      </div>}
    </section>

    <section className={`bp-player-health ${hurt ? 'just-hurt' : ''} ${stage === 'heal' ? 'just-healed' : ''}`} aria-label="あなたの体力">
      <img className="bp-player-face" src="/mining/Steve.png" alt="あなた" />
      <Hearts hp={shown.hp} maxHp={shown.maxHp} previousHp={hurt ? animation!.before.hp : shown.hp} />
    </section>
    <section className="bp-actions" aria-label="戦いの操作">
      <button className="bp-command bp-attack" disabled={disabled} aria-label="こうげき" onClick={() => act({ kind: 'strike', target: { enemyId: 0, part: 'body' } })}><SwordArt tier={run.loadout.sword} /><strong>こうげき</strong><span className="bp-command-token" aria-hidden="true" /></button>
      <button className="bp-command bp-guard" disabled={disabled} aria-label="まもる" onClick={() => act({ kind: 'guard' })}><GuardArt shield={run.item === 'shield'} /><strong>まもる</strong><span className="bp-command-token" aria-hidden="true" /></button>
      <button className={`bp-command bp-ultimate ${shown.gauge >= 3 ? 'is-ready' : ''}`} disabled={disabled || run.gauge < 3} aria-label={`ひっさつ、光${shown.gauge}個、3個で使える`} onClick={() => act({ kind: 'ultimate', enemyId: 0 })}><SwordArt tier={run.loadout.sword} special /><strong>ひっさつ</strong><span className="bp-charge-lights" aria-hidden="true">{[0, 1, 2].map(i => <i key={i} className={`${i < shown.gauge ? 'is-filled' : ''} ${stage === 'impact' && shown.gauge > animation!.before.gauge && i === shown.gauge - 1 ? 'just-charged' : ''}`} />)}</span><span className="bp-command-token" aria-hidden="true" /></button>
      <button className="bp-command bp-eat" disabled={busy || !playing || recovery === 'daily-limit' || recovery === 'full'} aria-label={recovery === 'needs-bread' ? 'かいふく、パンのつくりかた' : `かいふく、パン残り${shown.bread}個`} onClick={() => recovery === 'needs-bread' ? setRecoveryHelp(true) : act({ kind: 'eat' })}><span className="bp-bread-pair" aria-hidden="true">{[0, 1].map(i => <span key={i} className={i < shown.bread ? '' : 'is-eaten'}><BattleIcon kind="bread" /></span>)}</span><strong>かいふく</strong></button>
    </section>
    <p className="bp-sr-only" role="status" aria-live="polite">{notice || speaking}</p>
  </div>

  <dialog className={`bp-dialog ${modal === 'help' ? 'bp-help-dialog' : ''} ${modal === 'setup' ? 'bp-setup-dialog' : ''}`} ref={dialog} onCancel={dismissModal} onClose={dismissModal} aria-labelledby="bp-dialog-title">
    {modal === 'help' ? <>
      <div className="bp-dialog-top"><h2 id="bp-dialog-title">えで みてみよう</h2><button className="bp-icon-button" aria-label="説明をとじて遊ぶ" onClick={dismissModal}><BattleIcon kind="close" /></button></div>
      <BattleDemo lesson={lesson} />
      <h3 className="bp-lesson-title">{BLAZE_LESSONS[lesson]}</h3>
      <p className="bp-lesson-caption">{['けんで たたく！', 'ひのたまを ふせぐ！', 'たべると ハートが もどる！', `1まいで ${BLAZE_ACTIONS_PER_TICKET}かい。まもるも おなじ。`, 'ひかりが 3こで、つかえる！', 'ためたら、つぎは おおきな ひのたま！'][lesson]}</p>
      <div className="bp-lesson-navigation"><button className="bp-icon-button" aria-label="前の実演" disabled={lesson === 0} onClick={() => setLesson(value => value - 1)}><BattleIcon kind="back" /></button><div className="bp-lesson-dots" role="img" aria-label={`実演${lesson + 1} / ${BLAZE_LESSONS.length}`}>{BLAZE_LESSONS.map((name, i) => <span key={name} className={i === lesson ? 'is-current' : ''} />)}</div><button className="bp-icon-button" aria-label={lesson === BLAZE_LESSONS.length - 1 ? '実演をおえて遊ぶ' : '次の実演'} onClick={() => lesson === BLAZE_LESSONS.length - 1 ? (production?.onHelp(), setModal(null)) : setLesson(value => value + 1)}><BattleIcon kind={lesson === BLAZE_LESSONS.length - 1 ? 'play' : 'next'} /></button></div>
      <button className="bp-large-button" onClick={dismissModal}><BattleIcon kind="play" />あそぶ</button>
    </> : modal === 'gear' ? <>
      <div className="bp-dialog-top"><h2 id="bp-dialog-title">もちもの</h2><button className="bp-icon-button" aria-label="そうびをとじる" onClick={dismissModal}><BattleIcon kind="close" /></button></div>
      <div className="bp-held-choices">{(['none', 'shield'] as const).filter(item => !production || production.heldItems.includes(item)).map(item => <button key={item} aria-pressed={run.item === item} disabled={run.item !== item && playing && !canSpend} onClick={() => equip(item)}><GuardArt shield={item === 'shield'} /><strong>{item === 'shield' ? 'たて' : 'なし'}</strong><small>まもる −{item === 'shield' ? 80 : 50}%</small></button>)}</div>
      <p>つけかえは ●1こ。てきは うごかないよ。</p>{!production && <p>おためしの もちものだよ。</p>}{notice && <p role="alert">{notice}</p>}
    </> : modal === 'setup' ? <>
      <div className="bp-dialog-top"><h2 id="bp-dialog-title">保護者用・試験設定</h2><button className="bp-icon-button" aria-label="設定をキャンセル" onClick={dismissModal}><BattleIcon kind="close" /></button></div>
      <p>試験用データです。本番の装備・チケット・保存データには影響しません。設定の適用で戦いを最初からやり直します。</p>
      <p><a href="?enderman-prototype=1" style={{ color: '#b9efdf' }}>エンダーマンの試作へ（今の戦いは保存されません）</a></p>
      <div className="bp-parent-tools"><button className="bp-text-button" onClick={() => { audio.current?.stop(); setSound(value => !value); }}><BattleIcon kind={sound ? 'sound' : 'mute'} />音 {sound ? 'オン' : 'オフ'}</button><button className="bp-text-button" aria-pressed={reduced} onClick={() => setReduced(value => !value)}>演出を弱める {reduced ? 'オン' : 'オフ'}</button><button className="bp-text-button" onClick={() => setModal('reset')}><BattleIcon kind="replay" />同じ設定でリセット</button></div>
      <fieldset className="bp-setup-swords"><legend>剣</legend>{(['diamond', 'netherite'] as const).map(tier => <button key={tier} aria-pressed={draft.loadout.sword === tier} onClick={() => setDraft(prev => ({ ...prev, loadout: { ...prev.loadout, sword: tier } }))}><img src={BLAZE_SWORD_IMAGES[tier]} alt="" /><strong>{TIER_NAMES[tier]}の剣</strong><small>攻撃 {blazeAttackDamage({ ...draft.loadout, sword: tier })} / 必殺 {blazeAttackDamage({ ...draft.loadout, sword: tier }, true)}</small></button>)}</fieldset>
      <fieldset className="bp-setup-armor"><legend>防具</legend><div className="bp-armor-presets">{(['iron', 'diamond', 'netherite'] as const).map(tier => <button key={tier} onClick={() => setDraft(prev => ({ ...prev, loadout: { ...prev.loadout, armor: blazeFullArmor(tier) } }))}>全部{TIER_NAMES[tier]}</button>)}</div>{SLOTS.map(slot => { const tier = draft.loadout.armor[slot]; const rate = blazeArmorReductionRate({ sword: draft.loadout.sword, armor: { ...blazeFullArmor('none'), [slot]: tier } }); return <label className="bp-armor-row" key={slot}><span className="bp-armor-piece">{armorImage(slot, tier) ? <img src={armorImage(slot, tier)} alt="" /> : <BattleIcon kind="shield" />}<span><b>{SLOT_NAMES[slot]}</b><small>素材{BLAZE_ARMOR_COST[slot]}個ぶんの重み</small></span></span><select aria-label={`${SLOT_NAMES[slot]}の防具`} value={tier} onChange={event => setDraft(prev => ({ ...prev, loadout: { ...prev.loadout, armor: { ...prev.loadout.armor, [slot]: event.target.value as BlazeArmorTier } } }))}>{(['none', 'iron', 'gold', 'diamond', 'netherite'] as const).map(value => <option key={value} value={value}>{TIER_NAMES[value]}</option>)}</select><span className="bp-piece-cut">−{percent(rate)}%</span></label>; })}<p className="bp-armor-explanation">元の素材数〔頭5・胸8・脚7・靴4〕で重み付け。合計軽減後にHP単位で切り上げます。</p></fieldset>
      <div className="bp-setup-preview"><span>合計軽減 <b>{percent(blazeArmorReductionRate(draft.loadout))}%</b></span><span>小さな火球 <b>♥{blazeIncomingDamage(draft.loadout, 'ember') / 2}</b></span><span>大きな火球 <b>♥{blazeIncomingDamage(draft.loadout, 'burst') / 2}</b></span></div>
      <fieldset className="bp-setup-health"><legend>開始する体力</legend>{(['full', 'half'] as const).map(value => <button key={value} aria-pressed={draft.startHp === value} onClick={() => setDraft(prev => ({ ...prev, startHp: value }))}>{value === 'full' ? '♥10 満タン' : '♥5 半分'}</button>)}</fieldset>
      <fieldset className="bp-setup-health"><legend>持ち物（まもる：なし50%・盾80%軽減）</legend>{(['none', 'shield'] as const).map(item => <button key={item} aria-pressed={draft.item === item} onClick={() => setDraft(prev => ({ ...prev, item }))}>{item === 'shield' ? 'たて' : 'なし'}</button>)}</fieldset>
      <details className="bp-parent-details"><summary>現在の戦闘データ・きろく</summary><p>現在HP {run.hp}/{run.maxHp}、敵HP {run.enemies[0].hp}/{run.enemies[0].maxHp}、チケット {run.tickets}枚、支払い済み残り {run.handsLeft}回、パン {run.bread}個。<br />現在装備の攻撃 {blazeAttackDamage(run.loadout)} / 必殺 {blazeAttackDamage(run.loadout, true)}。<br />次の反撃 ♥{blazeIncomingDamage(run.loadout, run.enemies[0].intent) / 2}。パンは最大♥5回復、手数・反撃なし。</p><ol>{run.log.map((entry, i) => <li key={`${i}-${entry}`}>{entry}</li>)}</ol></details>
      <div className="bp-dialog-buttons"><button className="bp-secondary-button" onClick={dismissModal}>キャンセル</button><button className="bp-large-button" onClick={() => reset(draft)}>この設定で最初から</button></div>
    </> : modal === 'leave' ? <>
      <h2 id="bp-dialog-title">ここで かえる？</h2>
      <div className="bp-leave-picture" aria-hidden="true"><img src="/mining/Steve.png" alt="" /><BattleIcon kind="back" /><span><BattleIcon kind="ticket" /><b>×</b></span></div>
      <p>使ったチケットは戻らないよ。{production ? '残りの行動と、ここまでのたたかいは とっておくよ。' : run.handsLeft > 0 && `残りの${run.handsLeft}回もなくなるよ。`}まだ使っていないチケットは残るよ。</p>
      <p>ブレイズを倒していないので、ロッドは手に入らないよ。</p>
      <div className="bp-dialog-buttons"><button className="bp-large-button" onClick={dismissModal}><SwordArt tier={run.loadout.sword} />つづける</button><button className="bp-secondary-button" onClick={leave}><BattleIcon kind="back" />かえる</button></div>
    </> : modal === 'reset' && !production ? <>
      <h2 id="bp-dialog-title">同じ設定でやり直す？</h2><p>チケット4枚・パン2個と、確定済みの装備・開始体力に戻します。本番データは変更しません。</p><div className="bp-dialog-buttons"><button className="bp-secondary-button" onClick={dismissModal}>やめる</button><button className="bp-large-button" onClick={() => reset()}>リセットする</button></div>
    </> : null}
  </dialog>{recoveryHelp && <BreadRecoveryHelp onClose={() => setRecoveryHelp(false)} />}</main>;
}
