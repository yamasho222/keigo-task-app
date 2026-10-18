import type { EndermanPort } from './adventurePorts';
import { BreadRecoveryHelp } from './EndChapterNoticePanel';
import { recoveryAvailability } from './endChapterNotices';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BLAZE_ARMOR_COST, blazeArmorReductionRate, blazeFullArmor, type BlazeArmorSlot, type BlazeArmorTier } from './blazePrototypeEngine';
import { createBlazeAudio, type BlazeAudioCue } from './blazePrototypeAudio';
import { BLAZE_SWORD_IMAGES } from './blazePrototypeAssets';
import { BattleIcon, GuardArt, Hearts, SwordArt, TicketMeter } from './BlazePrototypeVisuals';
import { BattleSpectacle } from './BattleSpectacle';
import { actOnEnderman, createEndermanRun, endermanAttackDamage, endermanIncomingDamage, type EndermanAction, type EndermanEvent, type EndermanRun, type EndermanSetup } from './endermanPrototypeEngine';
import { buildEndermanPlayback, type EndermanFrame } from './endermanPrototypePlayback';
import { EndermanAfterimages, EndermanCluePicture, EndermanDemo, EndermanItemArt, EndermanTelegraph } from './EndermanPrototypeVisuals';
import { EndermanPond } from './EndermanPond';
import { ENDERMAN_ITEMS, ENDERMAN_ITEM_NAMES, ENDERMAN_LESSONS } from './endermanPrototypeAssets';
import './blazePrototype.css';
import './endermanPrototype.css';

type Modal = 'help' | 'gear' | 'leave' | 'setup' | 'reset' | null;
type Animation = { id: number; action: EndermanAction; before: EndermanRun; events: EndermanEvent[]; frame: EndermanFrame };
const SLOT_NAMES = { helmet: 'あたま', chest: 'むね', leggings: 'あし', boots: 'くつ' };
const TIER_NAMES = { none: 'なし', iron: '鉄', gold: '金', diamond: 'ダイヤ', netherite: 'ネザライト' };
function copySetup(s: EndermanSetup): EndermanSetup { return { ...s, loadout: { ...s.loadout, armor: { ...s.loadout.armor } } }; }

export default function EndermanPrototype({ production }: { production?: EndermanPort } = {}) {
  const [localRun, setRun] = useState(createEndermanRun);
  const run = production?.run ?? localRun, current = useRef(run);
  const [setup, setSetup] = useState<EndermanSetup>(() => copySetup(run));
  const [draft, setDraft] = useState<EndermanSetup>(() => copySetup(run));
  const [modal, setModal] = useState<Modal>(production?.seenHelp ? null : 'help'), dialog = useRef<HTMLDialogElement>(null);
  const [lesson, setLesson] = useState(0), [localDefeats, setDefeats] = useState(0);
  const defeats = production?.endermanDefeats ?? localDefeats;
  const [animation, setAnimation] = useState<Animation | null>(null);
  const [busy, setBusy] = useState(false), busyRef = useRef(false);
  const [notice, setNotice] = useState(''), [sound, setSound] = useState(true);
  const [recoveryHelp, setRecoveryHelp] = useState(false);
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const timers = useRef<number[]>([]), sequence = useRef(0);
  const audio = useRef<ReturnType<typeof createBlazeAudio> | null>(null);
  const resultTitle = useRef<HTMLHeadingElement>(null), title = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => { current.current = run; }, [run]);
  useEffect(() => () => { timers.current.forEach(window.clearTimeout); audio.current?.dispose(); }, []);
  useEffect(() => {
    if (modal && !dialog.current?.open) dialog.current?.showModal();
    if (!modal && dialog.current?.open) dialog.current?.close();
  }, [modal]);
  useEffect(() => { if (run.phase !== 'battle' && !busy) resultTitle.current?.focus(); }, [run.phase, busy]);
  useEffect(() => { const old = document.title; document.title = production ? 'エンダーマン戦' : 'エンダーマン戦・試験環境'; return () => { document.title = old; }; }, []);
  function dismissModal() { if (modal === 'help') production?.onHelp(); setModal(null); }
  function commit(next: EndermanRun) {
    if (current.current.phase === 'battle' && next.phase === 'lost') setDefeats(n => n + 1);
    current.current = next; if (!production) setRun(next);
  }
  function cue(cue: BlazeAudioCue) {
    if (!sound) return;
    audio.current ??= createBlazeAudio();
    audio.current.play(cue);
  }
  function act(action: EndermanAction) {
    if (busyRef.current || modal || recoveryHelp) return;
    const before = current.current, result = production ? production.act(action) : actOnEnderman(before, action);
    if (result.error) { setNotice(result.error); return; }
    setNotice('');
    if (action.kind === 'return' || action.kind === 'equip') { commit(result.state); if (action.kind === 'return') production?.onClose(); return; }
    if (sound) { audio.current ??= createBlazeAudio(); audio.current.unlock(); }
    busyRef.current = true; setBusy(true);
    timers.current.forEach(window.clearTimeout); timers.current = [];
    const playback = buildEndermanPlayback(before, result.state, action, result.events), id = ++sequence.current;
    playback.frames.forEach(frame => {
      const show = () => {
        setAnimation({ id, action, before, events: result.events, frame });
        const counter = result.events.some(event => event.kind === 'counter');
        if (frame.stage === 'strike') cue(action.kind === 'ultimate' ? 'ultimate' : 'slash');
        if (frame.stage === 'heal') cue('heal');
        if (frame.stage === 'impact' && result.events.some(event => event.kind === 'hit')) cue('impact');
        if (frame.stage === 'impact' && result.events.some(event => event.kind === 'kill')) cue('break');
        if (frame.stage === 'counter' && counter) cue(before.intent === 'ambush' ? 'enemyUltimate' : 'enemy');
        if (frame.stage === 'counter' && action.kind === 'ultimate') cue('break');
        if (frame.stage === 'hurt' && counter) cue(action.kind === 'guard' ? 'guard' : 'impact');
      };
      if (frame.at === 0) show(); else timers.current.push(window.setTimeout(show, frame.at));
    });
    timers.current.push(window.setTimeout(() => {
      commit(result.state); setAnimation(null); busyRef.current = false; setBusy(false); timers.current = [];
      if (result.state.phase === 'won') cue('victory');
    }, playback.duration));
  }
  function reset(next: EndermanSetup = { ...setup, item: current.current.item }) {
    if (production) { run.phase === 'lost' ? production.retry() : production.next(); return; }
    audio.current?.stop();
    timers.current.forEach(window.clearTimeout); timers.current = [];
    busyRef.current = false; setBusy(false); setAnimation(null); setNotice('');
    const copied = copySetup(next); setSetup(copied); commit(createEndermanRun(copied)); setModal(null);
    timers.current.push(window.setTimeout(() => title.current?.focus(), 0));
  }
  function equip(item: EndermanSetup['item']) {
    if (busyRef.current) return;
    if (run.phase !== 'battle') {
      commit({ ...current.current, item }); setSetup(prev => ({ ...prev, item })); setModal(null); return;
    }
    const result = production ? production.act({ kind: 'equip', item }) : actOnEnderman(current.current, { kind: 'equip', item });
    if (result.error) { setNotice(result.error); return; }
    commit(result.state); setSetup(prev => ({ ...prev, item })); setNotice(''); setModal(null);
  }
  const shown = animation?.frame.shown ?? run, stage = animation?.frame.stage, action = animation?.action;
  const wet = shown.item === 'water', playing = run.phase === 'battle', dead = shown.enemyHp === 0;
  const recovery = recoveryAvailability(production?.breadStock ?? run.bread, production?.foodToday ?? 0, run.hp, run.maxHp);
  const canSpend = run.tickets > 0 || run.handsLeft > 0, disabled = busy || !playing || !canSpend;
  const special = action?.kind === 'ultimate', guarding = action?.kind === 'guard';
  const missed = animation?.events.some(event => event.kind === 'miss') ?? false;
  const splashed = animation?.events.some(event => event.kind === 'splash') ?? false;
  const impact = stage === 'impact' || stage === 'counter' || stage === 'hurt';
  const hurt = stage === 'hurt' && shown.hp < (animation?.before.hp ?? shown.hp);
  const counter = animation?.events.some(event => event.kind === 'counter') ?? false;
  const lunging = stage === 'counter' && counter;
  const attackPhase = stage === 'focus' ? 'windup' : stage === 'strike' ? 'strike' : stage === 'impact' ? 'impact' : 'recover';
  const disappearing = missed && (stage === 'strike' || impact);
  const description = stage === 'ticket' ? 'チケット1枚で4回行動。'
    : stage === 'impact' ? missed ? 'ワープ！ よけられた。でも必殺の光はたまった。' : `${animation!.before.enemyHp - shown.enemyHp}ダメージ！`
    : stage === 'guard' ? shown.item === 'shield' ? '盾をかまえた。' : '身をまもった。' : stage === 'heal' ? 'ハートが回復した。'
    : special && stage === 'counter' ? '必殺でワープと反撃を止めた！'
    : hurt ? 'とびかかってきた！ ハートが減った。'
    : playing ? !canSpend ? 'チケットがないよ。帰ろう。' : 'エンダーマンの動きを見てみよう。'
    : run.phase === 'won' ? '勝った！ エンダーパールを1個てにいれた！' : run.phase === 'lost' ? 'たおされた。また挑戦しよう。' : 'ぶじに帰った。';

  if (!import.meta.env.DEV && !production) return <p>この画面は試験環境専用です。</p>;
  return <main className="bp-root ep-root" data-bp-reduced={reduced}><div className="bp-game">
    <header className="bp-header ep-header">
      <button className="bp-icon-button" aria-label="かえる" disabled={busy || !playing} onClick={() => setModal('leave')}><BattleIcon kind="back" /></button>
      <h1 ref={title} tabIndex={-1}>ゆがんだ もり{!production && <small>おためし</small>}</h1>
      <button className={`ep-gear-button ${defeats >= 2 && !wet ? 'ep-hint-glow' : ''}`} aria-label={`そうび、もちもの：${ENDERMAN_ITEM_NAMES[run.item]}`} disabled={busy || (!!production && !playing)} onClick={() => setModal('gear')}><EndermanItemArt item={run.item} /><span>そうび</span></button>
      <button className="bp-icon-button bp-help-button" aria-label="絵であそびかたを見る" disabled={busy} onClick={() => { setLesson(0); setModal('help'); }}>?</button>
      {!production && <button className="bp-icon-button bp-parent-button" aria-label="保護者用の試験設定" disabled={busy} onClick={() => { setDraft(copySetup({ ...setup, item: run.item })); setModal('setup'); }}><BattleIcon kind="settings" /></button>}
    </header>
    <div className="bp-resources"><TicketMeter tickets={shown.tickets} hands={shown.handsLeft} buying={stage === 'ticket'} /></div>
    <section className={`bp-arena ep-arena ep-intent-${shown.intent} ${wet ? 'ep-is-wet' : ''} ${hurt ? 'is-hit' : ''} ${special ? `is-ultimate-${stage}` : ''}`} aria-label="エンダーマンとの戦場" aria-busy={busy}>
      <div className="bp-world" aria-hidden="true" /><div className="ep-moonlight" aria-hidden="true" /><div className="bp-floor" aria-hidden="true" />
      <div className="bp-enemy-health"><div className="bp-enemy-health-line"><span>エンダーマン</span><strong className="bp-enemy-hp-number">{shown.enemyHp}<small> / {shown.enemyMaxHp}</small></strong></div><div className="bp-enemy-hp" role="meter" aria-label="エンダーマンの体力" aria-valuemin={0} aria-valuemax={shown.enemyMaxHp} aria-valuenow={shown.enemyHp}><i style={{ width: `${shown.enemyHp / shown.enemyMaxHp * 100}%` }} /></div></div>
      <div className="ep-forest-hollow" role="img" aria-label="森のくぼみ。エンダーマンは近づこうとしない"><EndermanPond /></div>
      {wet && <EndermanPond equipped splashing={splashed && impact} />}
      <div className={`bp-enemy-figure ep-enemy ${dead ? 'is-dead' : ''} ${disappearing ? 'ep-dodged' : ''} ${stage === 'impact' && !missed ? 'ep-hit' : ''} ${lunging ? 'ep-lunge' : ''} ${splashed && impact ? 'ep-flinch' : ''}`}>
        <div className="bp-enemy-shadow" /><div className="ep-silhouette-light" aria-hidden="true" />
        <img className="ep-enderman-sprite" src="/mining/Enderman.png" alt="エンダーマン" />
        <EndermanAfterimages wet={wet} intent={shown.intent} busy={busy} dodged={disappearing} />
        {!dead && playing && !busy && <EndermanTelegraph intent={shown.intent} wet={wet} />}
        {missed && impact && <span className="ep-miss-mark" aria-hidden="true">ひらり！<small>✦ ＋1</small></span>}
        {splashed && stage === 'impact' && <span className="ep-splash-mark" aria-hidden="true">びくっ！</span>}
      </div>
      {animation && (action?.kind === 'strike' || special) && stage !== 'ticket' && (!missed || stage === 'strike') && <BattleSpectacle key={`attack${animation.id}`} kind={special ? 'ultimate' : 'slash'} phase={attackPhase} variant="enderman" reduced={reduced} seed={animation.id} amount={animation.before.enemyHp - shown.enemyHp} />}
      {counter && (stage === 'counter' || stage === 'hurt') && <BattleSpectacle key={`enemy${animation!.id}`} kind={shown.intent === 'ambush' ? 'enemyUltimate' : 'enemy'} phase={stage === 'counter' ? 'strike' : 'impact'} variant="enderman" shield={guarding} reduced={reduced} seed={animation!.id} />}
      {guarding && stage !== 'ticket' && <BattleSpectacle key={`guard${animation!.id}`} kind="guard" phase={stage === 'hurt' && counter ? 'impact' : 'windup'} variant="enderman" shield={run.item === 'shield'} reduced={reduced} seed={animation!.id} />}
      {special && (stage === 'counter' || stage === 'hurt') && <BattleSpectacle key={`break${animation!.id}`} kind="break" phase={stage === 'counter' ? 'impact' : 'recover'} variant="enderman" reduced={reduced} seed={animation!.id} />}
      {dead && stage === 'impact' && <BattleSpectacle key={`defeat${animation!.id}`} kind="break" phase="impact" variant="enderman" reduced={reduced} seed={animation!.id} />}
      {(stage === 'eat' || stage === 'heal') && <BattleSpectacle key={`heal${animation!.id}`} kind="heal" phase={stage === 'eat' ? 'windup' : 'impact'} variant="enderman" reduced={reduced} seed={animation!.id} />}
      {!wet && playing && !busy && shown.misses >= 2 && <p className="ep-clue">あそこには ちかづかない…？</p>}
      {playing && !canSpend && !busy && <div className="bp-empty-ticket"><BattleIcon kind="ticket" /><p>チケットが ないよ</p><button className="bp-large-button" onClick={() => setModal('leave')}><BattleIcon kind="back" />かえる</button></div>}
      {!playing && !busy && <div className={`bp-result bp-result-${run.phase}`}>
        {run.phase === 'won' && <BattleSpectacle kind="victory" phase="impact" variant="enderman" reduced={reduced} seed={run.turn} />}
        <div className="bp-result-picture" aria-hidden="true">{run.phase === 'won' ? <><span>✦</span><img src="/mining/Ender_Pearl.png" alt="" /><span>✦</span></> : <img src="/mining/Steve.png" alt="" />}</div>
        <h2 ref={resultTitle} tabIndex={-1}>{run.phase === 'won' ? 'やったー！' : run.phase === 'lost' ? 'また ちょうせん！' : 'ただいま！'}</h2>
        {run.phase === 'won' && <p>エンダーパール × 1</p>}
        {run.phase === 'lost' && !wet && <div className="ep-result-clue"><EndermanCluePicture /><p>{defeats >= 2 ? 'もっていけるものは、けんだけじゃ ないみたい。' : 'あそこには、ちかづかなかったね…。'}</p></div>}
        <div className="ep-result-buttons"><button className="bp-secondary-button" onClick={() => setModal('gear')}><EndermanItemArt item={run.item} />そうび</button><button className="bp-large-button" onClick={() => reset()}><BattleIcon kind="replay" />{production && run.phase === 'lost' ? '1まいで おきあがる（ハート5・4かい）' : 'もういちど'}</button></div>
        <a className="ep-other-battle" href="?blaze-prototype=1">ブレイズの おためしへ</a>
      </div>}
    </section>
    <section className={`bp-player-health ${hurt ? 'just-hurt' : ''} ${stage === 'heal' ? 'just-healed' : ''}`} aria-label="あなたの体力"><img className="bp-player-face" src="/mining/Steve.png" alt="あなた" /><Hearts hp={shown.hp} maxHp={shown.maxHp} previousHp={hurt ? animation!.before.hp : shown.hp} /></section>
    <section className="bp-actions" aria-label="戦いの操作">
      <button className="bp-command bp-attack" disabled={disabled} aria-label="こうげき" onClick={() => act({ kind: 'strike' })}><SwordArt tier={run.loadout.sword} /><strong>こうげき</strong><span className="bp-command-token" aria-hidden="true" /></button>
      <button className="bp-command bp-guard" disabled={disabled} aria-label="まもる" onClick={() => act({ kind: 'guard' })}><GuardArt shield={run.item === 'shield'} /><strong>まもる</strong><span className="bp-command-token" aria-hidden="true" /></button>
      <button className={`bp-command bp-ultimate ${shown.gauge >= 3 ? 'is-ready' : ''}`} disabled={disabled || run.gauge < 3} aria-label={`ひっさつ、光${shown.gauge}個、3個で使える`} onClick={() => act({ kind: 'ultimate' })}><SwordArt tier={run.loadout.sword} special /><strong>ひっさつ</strong><span className="bp-charge-lights" aria-hidden="true">{[0, 1, 2].map(i => <i key={i} className={i < shown.gauge ? 'is-filled' : ''} />)}</span><span className="bp-command-token" aria-hidden="true" /></button>
      <button className="bp-command bp-eat" disabled={busy || !playing || recovery === 'daily-limit' || recovery === 'full'} aria-label={recovery === 'needs-bread' ? 'かいふく、パンのつくりかた' : `かいふく、パン残り${shown.bread}個`} onClick={() => recovery === 'needs-bread' ? setRecoveryHelp(true) : act({ kind: 'eat' })}><span className="bp-bread-pair" aria-hidden="true">{[0, 1].map(i => <span key={i} className={i < shown.bread ? '' : 'is-eaten'}><BattleIcon kind="bread" /></span>)}</span><strong>かいふく</strong></button>
    </section>
    {notice && <p className="ep-notice" role="alert">{notice}</p>}<p className="bp-sr-only" role="status" aria-live="polite">{description}</p>
  </div>
  <dialog ref={dialog} className="bp-dialog ep-dialog" aria-labelledby="ep-dialog-title" onCancel={dismissModal} onClose={dismissModal}>
    <div className="bp-dialog-top"><h2 id="ep-dialog-title">{modal === 'help' ? 'えで みてみよう' : modal === 'gear' ? 'そうび' : modal === 'leave' ? 'ここで かえる？' : modal === 'reset' ? 'やりなおす？' : '保護者用・試験設定'}</h2><button className="bp-icon-button" aria-label="とじる" onClick={dismissModal}><BattleIcon kind="close" /></button></div>
    {modal === 'help' ? <><EndermanDemo lesson={lesson} /><h3 className="bp-lesson-title">{ENDERMAN_LESSONS[lesson]}</h3><p className="bp-lesson-caption">{['ゆらゆらしたら、ひらり！ でも ひかりは たまる。', 'まもって まてば、つぎは チャンス！', 'ひかりが 3こで、ワープも つかまえる！'][lesson]}</p><div className="bp-lesson-navigation"><button className="bp-icon-button" aria-label="前の実演" disabled={lesson === 0} onClick={() => setLesson(n => n - 1)}><BattleIcon kind="back" /></button><div className="bp-lesson-dots" role="img" aria-label={`実演${lesson + 1} / 3`}>{ENDERMAN_LESSONS.map((name, i) => <span key={name} className={i === lesson ? 'is-current' : ''} />)}</div><button className="bp-icon-button" aria-label={lesson === 2 ? '実演をおえて遊ぶ' : '次の実演'} onClick={() => lesson === 2 ? (production?.onHelp(), setModal(null)) : setLesson(n => n + 1)}><BattleIcon kind={lesson === 2 ? 'play' : 'next'} /></button></div><button className="bp-large-button" onClick={dismissModal}><BattleIcon kind="play" />あそぶ</button></>
    : modal === 'gear' ? <><div className="ep-equipped-sword"><SwordArt tier={run.loadout.sword} /><span>けん</span></div><h3>もちもの</h3><div className="ep-items">{ENDERMAN_ITEMS.filter(item => !production || production.heldItems.includes(item)).map(item => <button key={item} aria-label={ENDERMAN_ITEM_NAMES[item]} aria-pressed={run.item === item} disabled={item !== run.item && playing && !canSpend} onClick={() => equip(item)}><EndermanItemArt item={item} /><strong>{ENDERMAN_ITEM_NAMES[item]}</strong>{run.item === item && <span aria-hidden="true">✓</span>}</button>)}</div><p>つけかえは ●1こ。てきは うごかないよ。</p><p>まもるは 半分カット。たてなら 80%カット。</p>{!production && <p>おためしの どうぐだよ。ほんとうの もちものは へらないよ。</p>}{notice && <p role="alert">{notice}</p>}</>
    : modal === 'leave' ? <><div className="bp-leave-picture" aria-hidden="true"><img src="/mining/Steve.png" alt="" /><BattleIcon kind="back" /><span><BattleIcon kind="ticket" /><b>×</b></span></div><p>使ったチケットは戻らないよ。{production ? '残りの行動と、ここまでのたたかいは とっておくよ。' : run.handsLeft > 0 && `残りの${run.handsLeft}回もなくなるよ。`}まだ使っていないチケットは残るよ。</p><p>倒していないので、エンダーパールは手に入らないよ。</p><div className="bp-dialog-buttons"><button className="bp-large-button" onClick={dismissModal}>つづける</button><button className="bp-secondary-button" onClick={() => { const result = production ? production.act({ kind: 'return' }) : actOnEnderman(current.current, { kind: 'return' }); if (result.error) { setNotice(result.error); return; } commit(result.state); setModal(null); production?.onClose(); }}>かえる</button></div></>
    : modal === 'reset' ? <><p>試作だけを最初に戻します。チケット4枚・パン2個。装備とヒントの発見は引き継ぎます。本番データは変更しません。</p><div className="bp-dialog-buttons"><button className="bp-secondary-button" onClick={dismissModal}>やめる</button><button className="bp-large-button" onClick={() => reset()}>リセットする</button></div></>
    : modal === 'setup' ? <>
      <p>試験専用・保存なし。装備を適用すると最初からやり直します。</p>
      <div className="bp-parent-tools"><button className="bp-text-button" onClick={() => { audio.current?.stop(); setSound(v => !v); }}><BattleIcon kind={sound ? 'sound' : 'mute'} />音 {sound ? 'オン' : 'オフ'}</button><button className="bp-text-button" aria-pressed={reduced} onClick={() => setReduced(v => !v)}>演出を弱める {reduced ? 'オン' : 'オフ'}</button><button className="bp-text-button" onClick={() => setModal('reset')}><BattleIcon kind="replay" />リセット</button><a className="ep-other-battle" href="?blaze-prototype=1">ブレイズ試作へ</a></div>
      <fieldset className="bp-setup-swords"><legend>剣</legend>{(['diamond', 'netherite'] as const).map(sword => <button key={sword} aria-pressed={draft.loadout.sword === sword} onClick={() => setDraft(prev => ({ ...prev, loadout: { ...prev.loadout, sword } }))}><img src={BLAZE_SWORD_IMAGES[sword]} alt="" /><strong>{TIER_NAMES[sword]}</strong></button>)}</fieldset>
      <fieldset className="bp-setup-armor"><legend>防具</legend><div className="bp-armor-presets">{(['iron', 'diamond', 'netherite'] as const).map(tier => <button key={tier} onClick={() => setDraft(prev => ({ ...prev, loadout: { ...prev.loadout, armor: blazeFullArmor(tier) } }))}>全部{TIER_NAMES[tier]}</button>)}</div>{(Object.keys(SLOT_NAMES) as BlazeArmorSlot[]).map(slot => <label className="bp-armor-row" key={slot}><span>{SLOT_NAMES[slot]}（重み{BLAZE_ARMOR_COST[slot]}）</span><select aria-label={`${SLOT_NAMES[slot]}の防具`} value={draft.loadout.armor[slot]} onChange={event => setDraft(prev => ({ ...prev, loadout: { ...prev.loadout, armor: { ...prev.loadout.armor, [slot]: event.target.value as BlazeArmorTier } } }))}>{(Object.keys(TIER_NAMES) as BlazeArmorTier[]).map(tier => <option value={tier} key={tier}>{TIER_NAMES[tier]}</option>)}</select></label>)}</fieldset>
      <fieldset className="bp-setup-health"><legend>もちもの</legend>{ENDERMAN_ITEMS.map(item => <button key={item} aria-pressed={draft.item === item} onClick={() => setDraft(prev => ({ ...prev, item }))}>{ENDERMAN_ITEM_NAMES[item]}</button>)}</fieldset>
      <fieldset className="bp-setup-health"><legend>開始体力</legend>{(['full', 'half'] as const).map(startHp => <button key={startHp} aria-pressed={draft.startHp === startHp} onClick={() => setDraft(prev => ({ ...prev, startHp }))}>{startHp === 'full' ? '♥10 満タン' : '♥5 半分'}</button>)}</fieldset>
      <div className="bp-setup-preview"><span>防具軽減 <b>{(blazeArmorReductionRate(draft.loadout) * 100).toFixed(2)}%</b></span><span>攻撃 <b>{endermanAttackDamage(draft)}</b></span><span>必殺 <b>{endermanAttackDamage(draft, true)}</b></span><span>通常反撃 <b>♥{endermanIncomingDamage({ ...draft, intent: 'approach' }) / 2}</b></span><span>飛びかかり <b>♥{endermanIncomingDamage({ ...draft, intent: 'ambush' }) / 2}</b></span></div>
      <details className="bp-parent-details"><summary>現在の戦闘データ・きろく</summary><p>HP {run.hp}/{run.maxHp}、敵HP {run.enemyHp}/{run.enemyMaxHp}、チケット {run.tickets}枚、支払い済み残り {run.handsLeft}回、パン {run.bread}個、光 {run.gauge}、空振り {run.misses}回。持ち物変更は1行動、反撃・予告変更なし。パンは手数・反撃なし。まもるは50%、盾なら80%軽減。防具の後に掛け、最後に切り上げます。盾は持つだけでは軽減しません。</p><ol>{run.log.map((entry, i) => <li key={i}>{entry}</li>)}</ol></details><div className="bp-dialog-buttons"><button className="bp-secondary-button" onClick={dismissModal}>キャンセル</button><button className="bp-large-button" onClick={() => reset(draft)}>この設定で最初から</button></div>
    </> : null}
  </dialog>{recoveryHelp && <BreadRecoveryHelp onClose={() => setRecoveryHelp(false)} />}</main>;
}
