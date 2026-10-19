import type { DragonPort } from './adventurePorts';
import { BattleForecast } from './BattleForecast';
import { dragonForecast } from './battleForecastRules';
import { BattleSkillActivity } from './BattleSkillActivity';
import { DragonCompanionRescue } from './DragonCompanionRescue';
import { BattleBagIcon, BattleItemsDialog, type HeldBattleItem } from './BattleItemsDialog';
import { BedExplosionFx, DragonStatusArt, DragonStatusBadges } from './DragonBattleEffectsArt';
import { BreadRecoveryHelp } from './EndChapterNoticePanel';
import { recoveryAvailability } from './endChapterNotices';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BattleSpectacle } from './BattleSpectacle';
import { BattleReward } from './BattleReward';
import { DragonAllyFx, DragonAttackFx } from './DragonAttackFx';
import { DragonThreatArt } from './DragonThreatArt';
import { DRAGON_THREAT_ASSETS } from './dragonThreatPresentation';
import { DragonCombatPreview } from './DragonCombatPreview';
import { enableDragonCritical } from './dragonCriticalRules';
import { DragonSkillGame, SkillGlyph } from './DragonSkillGame';
import { DragonWingArt } from './DragonWingArt';
import { DragonSkillPreview } from './DragonSkillPreview';
import { SKILL_KINDS, SKILL_NAMES, SKILL_TITLES, enableDragonSkills, isUltimateAction, playableSkill, skillBonus, type DragonSkillKind } from './dragonSkillRules';
import { createDragonSkillAudio } from './dragonSkillAudio';
import { dragonAdventureCue, dragonFocusTarget, dragonTechnique, enableDragonAdventure } from './dragonCampaignAdventure';
import { CampaignPreparation } from './CampaignPreparation';
import { armorRate, maxHp, type CampaignEquipment } from './campaignEquipment';
import { BattleIcon, GuardArt, SwordArt } from './BlazePrototypeVisuals';
import { createBlazeAudio } from './blazePrototypeAudio';
import {
  campaignBodyMaxHp, brokenCrystals, brokenWings, campaignBedAvailable, campaignCounterDamage, campaignIntent, campaignTargetHp,
  createDragonCampaign, crystalMaxHp, refreshCampaignDay, stepDragonCampaign,
  type CampaignAction, type CampaignEvent, type CampaignTarget, type DragonCampaign,
} from './dragonCampaignEngine';
import { buildCampaignPlayback, type CampaignFrame } from './dragonCampaignPlayback';
import { dragonArmorFixture, dragonCampaignFixture, recoverDragonTestHp, type DragonFixture } from './dragonCampaignFixtures';
import { DRAGON_LAB_KEY, DRAGON_LAB_LOCK, loadDragonCampaign, loadDragonSnapshot, saveDragonCampaign, type CampaignLoad } from './dragonCampaignStorage';
import './blazePrototype.css';
import './dragonCampaign.css';

type Animation = { id: number; action: CampaignAction; before: DragonCampaign; after: DragonCampaign; events: CampaignEvent[]; frame: CampaignFrame };
const CRYSTAL_POS = [[6, 58], [80, 58], [6, 29], [80, 29], [28, 6], [58, 6], [28, 74], [58, 74]];
const PHASE_NAMES = { crystals: 'ひかりの とう', wings: 'つばさを くずせ', orb: 'たまを はねかえせ', rage: 'さいごの たたかい' };
const FIXTURES: [DragonFixture, string][] = [['start', 'はじめから'], ['inner', '内側のバリア'], ['wings', '最終① 翼'], ['wingUltimate', '翼＋必殺ミニゲーム'], ['orb', '最終② 玉'], ['rage', '最終③ 大技'], ['ultimate', '仲間の必殺'], ['victory', '討伐直前'], ['lost', '敗北後']];
function targetPosition(target: CampaignTarget) {
  if (target.startsWith('crystal:')) { const point = CRYSTAL_POS[Number(target.split(':')[1])]; return { left: `${point[0] + 7}%`, top: `${point[1] + 8}%` }; }
  if (target.startsWith('wing:')) return { left: target === 'wing:0' ? '12%' : '88%', top: '52%' };
  return { left: '50%', top: target === 'orb' ? '61%' : '49%' };
}
function today() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function initialLoad(): CampaignLoad {
  if (typeof window === 'undefined') return { state: null };
  try {
    const loaded = loadDragonCampaign(window.localStorage);
    return loaded.state ? { ...loaded, state: enableDragonCritical(enableDragonSkills(enableDragonAdventure(loaded.state))) } : loaded;
  } catch { return { state: null, error: '試験記録の保存先を開けません。' }; }
}
function HpBar({ hp, total, label, small = false }: { hp: number; total: number; label: string; small?: boolean }) {
  return <div className={`dc-hp ${small ? 'dc-hp-small' : ''}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={hp}>
    <i style={{ width: `${Math.max(0, hp / total * 100)}%` }} /><span>{hp}<small> / {total}</small></span>
  </div>;
}
function ChapterSymbol({ phase }: { phase: keyof typeof PHASE_NAMES }) {
  return <svg className={`dc-chapter-symbol dc-symbol-${phase}`} viewBox="0 0 60 60" aria-hidden="true">
    {phase === 'crystals' ? <><path d="m30 3 19 26-19 28L11 29Z" /><path className="dc-symbol-line" d="M30 3v54M11 29h38" /></>
      : phase === 'wings' ? <path d="m5 52 12-44 39 20-18 7-3 20-14-17Z" />
        : phase === 'orb' ? <><circle cx="30" cy="30" r="20" /><path className="dc-symbol-line" d="M7 46Q36 65 53 24m-11 6 11-6 1 12" /></>
          : <path d="m35 2-24 33h17l-5 23 27-36H32Z" />}
  </svg>;
}
export default function DragonCampaignLab({ production }: { production?: DragonPort } = {}) {
  const [boot] = useState<CampaignLoad>(() => production ? { state: production.run } : initialLoad());
  const [localRun, setRun] = useState<DragonCampaign>(() => boot.state ?? enableDragonCritical(enableDragonSkills(enableDragonAdventure(createDragonCampaign(today())))));
  const run = production?.run ?? localRun;
  const current = useRef(run), diskRevision = useRef<number | null>(boot.state?.revision ?? null);
  const [notice, setNotice] = useState(boot.error ?? '');
  const [recoveryHelp, setRecoveryHelp] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [blocked, setBlocked] = useState(!!boot.error);
  const [animation, setAnimation] = useState<Animation | null>(null);
  const [busy, setBusy] = useState(false), busyRef = useRef(false), timers = useRef<number[]>([]), sequence = useRef(0);
  const [sound, setSound] = useState(true), [reduced, setReduced] = useState(false);
  const [systemReduced, setSystemReduced] = useState(false);
  const [phonePreview, setPhonePreview] = useState(false);
  const [fixture, setFixture] = useState<DragonFixture>('start'), [confirmFixture, setConfirmFixture] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false), leaveDialog = useRef<HTMLDialogElement>(null);
  const [draftEquipment, setDraftEquipment] = useState<CampaignEquipment | null>(null);
  const [liveSkill, setLiveSkill] = useState('');
  const [practice, setPractice] = useState<{ kind: DragonSkillKind; id: number } | null>(null);
  const [practiceCast, setPracticeCast] = useState<{ kind: DragonSkillKind; score: number } | null>(null);
  const [combatPreview, setCombatPreview] = useState(false);
  const audio = useRef<ReturnType<typeof createBlazeAudio> | null>(null), resultHeading = useRef<HTMLHeadingElement>(null);
  const skillAudio = useRef<ReturnType<typeof createDragonSkillAudio> | null>(null);
  const calm = reduced || systemReduced;
  useLayoutEffect(() => { current.current = run; }, [run]);
  useEffect(() => {
    // Decode ahead of time, never delay or change a committed turn for artwork.
    Object.values(DRAGON_THREAT_ASSETS).forEach(src => { const img = new Image(); img.src = src; void img.decode().catch(() => undefined); });
    const oldTitle = document.title; document.title = production ? 'エンドラ最終決戦' : 'エンドラ最終決戦｜試験環境';
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReduced(query.matches); update(); query.addEventListener('change', update);
    return () => { document.title = oldTitle; query.removeEventListener('change', update); timers.current.forEach(window.clearTimeout); audio.current?.dispose(); skillAudio.current?.dispose(); };
  }, []);
  useEffect(() => {
    if (production) return;
    const changed = (event: StorageEvent) => {
      if (event.key === DRAGON_LAB_KEY) { setBlocked(true); setNotice('別のタブで試験記録が変わりました。「記録を読み直す」で続けてください。'); }
    };
    window.addEventListener('storage', changed); return () => window.removeEventListener('storage', changed);
  }, []);
  useEffect(() => {
    if (production) return;
    let cancelled = false;
    const recoverDay = () => {
      if (blocked || cancelled || document.visibilityState === 'hidden' || !navigator.locks) return;
      void navigator.locks.request(DRAGON_LAB_LOCK, () => {
        if (cancelled || busyRef.current) return;
        const previous = current.current;
        const next = refreshCampaignDay(previous, today());
        if (next === previous) return;
        try {
          const saved = saveDragonCampaign(window.localStorage, next, diskRevision.current);
          if (saved.error) { setBlocked(true); setNotice(saved.error); return; }
          diskRevision.current = next.revision; current.current = next; setRun(next);
          setNotice('あたらしい日。ハートが もどった！');
        } catch { setBlocked(true); setNotice('翌日の回復を保存できませんでした。記録を読み直してください。'); }
      }).catch(() => { if (!cancelled) setNotice('翌日の回復を確認できませんでした。記録を読み直してください。'); });
    };
    recoverDay();
    window.addEventListener('focus', recoverDay); document.addEventListener('visibilitychange', recoverDay);
    return () => { cancelled = true; window.removeEventListener('focus', recoverDay); document.removeEventListener('visibilitychange', recoverDay); };
  }, [blocked, run.day]);
  useEffect(() => {
    if (leaveOpen && !leaveDialog.current?.open) leaveDialog.current?.showModal();
    if (!leaveOpen && leaveDialog.current?.open) leaveDialog.current?.close();
  }, [leaveOpen]);
  useEffect(() => { if (!busy && ['won', 'lost'].includes(run.status)) resultHeading.current?.focus(); }, [run.status, busy]);

  function cue(kind: Parameters<ReturnType<typeof createBlazeAudio>['play']>[0]) {
    if (!sound) return;
    audio.current ??= createBlazeAudio(); audio.current.play(kind);
  }
  function commit(next: DragonCampaign) { current.current = next; if (!production) setRun(next); }
  async function persist(next: DragonCampaign, replace = false) {
    if (production) return true;
    try {
      const result = saveDragonCampaign(window.localStorage, next, diskRevision.current, replace);
      if (result.error) { setNotice(result.error); setBlocked(true); return false; }
      diskRevision.current = next.revision; return true;
    } catch { setNotice('保存できませんでした。行動は確定していません。'); setBlocked(true); return false; }
  }
  async function locked<T>(work: () => Promise<T>): Promise<T> {
    if (production) return work();
    if (navigator.locks) return navigator.locks.request(DRAGON_LAB_LOCK, work);
    // Keep memory-only refusal rather than risk a concurrent write on unsupported browsers.
    throw new Error('このブラウザーは安全な同時保存に対応していません。新しいブラウザーで試してください。');
  }
  async function act(action: CampaignAction) {
    if (busyRef.current || blocked) return;
    if (recoveryHelp) return;
    if (sound) { audio.current ??= createBlazeAudio(); audio.current.unlock(); if (action.kind === 'beginSkill') { skillAudio.current ??= createDragonSkillAudio(); skillAudio.current.unlock(); } }
    busyRef.current = true; setBusy(true);
    let animating = false;
    try {
      await locked(async () => {
        const before = production ? current.current : enableDragonCritical(refreshCampaignDay(current.current, today()));
        const result = production ? production.act(action) : stepDragonCampaign(before, action);
        if (result.error) { setNotice(result.error); return; }
        if (result.state === current.current) return;
        if (!await persist(result.state)) return;
        if (['beginSkill', 'chooseSkill'].includes(action.kind) && result.state.skills?.pending?.mode) setLiveSkill(`${result.state.skills.pending.token}:${result.state.skills.pending.mode}`);
        if (action.kind === 'equip') setDraftEquipment(null);
        setNotice(['craft', 'upgrade', 'harvest', 'equip'].includes(action.kind) ? result.state.log.at(-1) ?? '' : ''); commit(result.state);
        if (action.kind === 'pause') production?.onClose();
        const playback = buildCampaignPlayback(before, result.state, action, result.events, calm);
        if (!playback.frames.length) return;
        animating = true;
        const id = ++sequence.current;
        playback.frames.forEach(frame => {
          const show = () => {
            setAnimation({ id, action, before, after: result.state, events: result.events, frame });
            if (frame.stage === 'strike' && action.kind !== 'guard') {
              if (isUltimateAction(action) && before.skills?.pending?.mode && sound) { skillAudio.current ??= createDragonSkillAudio(); skillAudio.current.release(playableSkill(before.skills.pending.mode)); }
              else cue(isUltimateAction(action) ? 'ultimate' : action.kind === 'bed' ? 'enemy' : 'slash');
            }
            if (frame.stage === 'impact' && action.kind !== 'guard') cue(action.kind === 'bed' ? 'bed' : result.events.some(e => e.kind === 'critical') ? 'critical' : result.events.some(e => e.kind === 'partBreak') ? 'break' : 'impact');
            if (frame.stage === 'effect') cue(result.events.some(e => e.kind === 'heal') ? 'heal' : result.events.some(e => e.kind === 'burn') ? 'enemy' : 'guard');
            if (frame.stage === 'counter') cue(['breath', 'orbFire', 'storm'].includes(campaignIntent(before)) ? 'enemyUltimate' : 'enemy');
            if (frame.stage === 'recover') cue('heal');
            if (frame.stage === 'reflected') cue('impact');
            if (frame.stage === 'assist') cue('slash');
            if (frame.stage === 'assistImpact') cue('impact');
            if (frame.stage === 'hurt' && action.kind === 'guard') cue('guard');
            if (frame.stage === 'hurt' && action.kind !== 'guard') cue('impact');
            if (frame.stage === 'victory') cue('victory');
          };
          if (frame.at === 0) show(); else timers.current.push(window.setTimeout(show, frame.at));
        });
        timers.current.push(window.setTimeout(() => { setAnimation(null); setBusy(false); busyRef.current = false; timers.current = []; }, playback.duration));
      });
    } catch (error) { setNotice(error instanceof Error ? error.message : '行動を保存できませんでした。'); }
    finally { if (!animating) { setBusy(false); busyRef.current = false; } }
  }
  async function replaceTestState(next: DragonCampaign) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try {
      await locked(async () => {
        next = enableDragonCritical(enableDragonSkills(enableDragonAdventure(next)));
        if (!await persist(next, true)) return;
        setBlocked(false); setDraftEquipment(null); commit(next); setNotice('試験記録だけを切り替えました。実セーブ・クラウドは変更していません。');
        setConfirmFixture(false);
      });
    } catch (error) { setNotice(String(error)); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function recoverTestHp() {
    if (!import.meta.env.DEV || busyRef.current || blocked) return;
    busyRef.current = true; setBusy(true);
    try {
      await locked(async () => {
        const next = recoverDragonTestHp(current.current);
        if (next === current.current || !await persist(next)) return;
        commit(next); setNotice('試験用：自分のHPだけ全回復しました。敵・チケット・パン・日付はそのままです。');
      });
    } catch { setNotice('全回復を保存できませんでした。記録を読み直してください。'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  function reloadTestState() {
    if (busyRef.current) return;
    const loaded = initialLoad();
    if (!loaded.state) { setNotice(loaded.error ?? '保存された試験記録はまだありません。'); return; }
    setLiveSkill(''); diskRevision.current = loaded.state.revision; setDraftEquipment(null); commit(loaded.state); setBlocked(false); setNotice('試験記録を読み直しました。');
  }

  const shown = animation?.frame.shown ?? run, stage = animation?.frame.stage;
  const shownIntent = campaignIntent(shown), phaseIndex = ['crystals', 'wings', 'orb', 'rage'].indexOf(shown.phase);
  const target: CampaignTarget = animation?.action.kind === 'bed' ? 'body' : animation?.before.selected ?? shown.selected, selectedHp = campaignTargetHp(shown, shown.selected);
  const hits = animation?.events.filter(event => ['hit', 'bed', 'orbReflect'].includes(event.kind)) ?? [];
  const helperHit = animation?.events.find(event => event.kind === 'companion' && event.amount > 0);
  const allyActing = stage === 'assist' || stage === 'assistImpact';
  const activeAlly = animation?.frame.allyHit;
  const visibleHits = stage === 'assistImpact' && helperHit ? [{ ...helperHit, amount: activeAlly?.amount ?? helperHit.amount }] : hits.filter(hit => hit.kind === 'orbReflect' ? stage === 'reflected' : stage === 'impact').map(hit => ({ ...hit, amount: hit.amount - (helperHit && hit.target === helperHit.target ? helperHit.amount : 0) }));
  const dealt = hits.reduce((sum, event) => sum + event.amount, 0), taken = animation?.events.find(event => event.kind === 'counter')?.amount ?? 0;
  const hitVisible = !!stage && ['impact', 'assistImpact', 'reflected', 'counter', 'hurt'].includes(stage);
  const wingCloseup = !!animation && target.startsWith('wing:') && ['windup', 'strike', 'impact', 'assist', 'assistImpact'].includes(stage ?? '');
  const impactPosition = (hitTarget: CampaignTarget) => wingCloseup && hitTarget.startsWith('wing:') ? { left: '50%', top: '50%' } : targetPosition(hitTarget);
  const special = !!animation && isUltimateAction(animation.action), guarding = animation?.action.kind === 'guard';
  const castKind = animation?.before.skills?.pending?.mode ? playableSkill(animation.before.skills.pending.mode) : undefined;
  const critical = !!animation?.events.some(event => event.kind === 'critical');
  const enemyAttacking = stage === 'enemyWindup' || stage === 'counter' || stage === 'hurt';
  const enemyBig = enemyAttacking && ['breath', 'orbFire', 'storm'].includes(shownIntent);
  const effectPhase = stage === 'windup' || stage === 'ticket' ? 'windup' : stage === 'strike' || stage === 'counter' || (guarding && stage === 'impact') ? 'strike' : stage === 'recover' ? 'recover' : 'impact';
  const ownFx = animation?.action.kind === 'heal' ? 'heal' : guarding ? 'guard' : animation?.action.kind === 'bed' ? 'bed' : special ? 'ultimate' : 'slash';
  const focusTarget = dragonFocusTarget(shown);
  const technique = dragonTechnique(animation?.before ?? shown, target);
  const counterStrike = !!animation?.before.adventure?.counter && animation.action.kind === 'attack';
  const adventureCue = dragonAdventureCue(shown);
  const rescueActive = run.status === 'battle' && !run.rescueSeen && run.equipment.buddies.length > 0 && !run.skills?.pending;
  const canPay = run.hands > 0 || run.tickets > 0, commandDisabled = busy || blocked || !canPay || rescueActive;
  const recovery = recoveryAvailability(run.supplies.materials.bread ?? 0, run.foodToday, run.hp, maxHp(run.equipment));
  const lastMessage = stage === 'windup' && special ? castKind ? SKILL_TITLES[castKind] : 'ちからを あつめる！'
    : stage === 'effect' ? animation?.events.some(event => event.kind === 'burn') ? 'やけど！ 5ダメージ！' : `ひっさつの ちから！ ${animation?.events.find(event => event.kind === 'effect')?.message ?? ''}`
    : stage === 'assist' ? 'なかまが つづく！' : stage === 'assistImpact' ? `なかまの ついげき！ ${helperHit?.amount ?? 0} ダメージ！`
    : stage === 'enemyWindup' || stage === 'counter' ? guarding ? 'うけとめろ！' : enemyBig ? 'おおわざ！' : 'エンドラの こうげき！'
      : stage === 'impact' ? guarding ? 'まもる！' : `${critical ? 'かいしん！ ' : ''}${dealt - (helperHit?.amount ?? 0)} ダメージ！`
        : stage === 'recover' ? 'ハートが もどった！' : shown.log.at(-1) ?? '';

  if (!import.meta.env.DEV && !production) return <p>試験環境専用です。</p>;
  return <main className={`dc-root ${calm ? 'dc-reduced' : ''}`}>
    <div className={`dc-game ${phonePreview ? 'dc-phone-preview' : ''}`}>
      <header className="dc-header">
        <button type="button" className="dc-icon-button" aria-label="かえる・準備に戻る" disabled={busy || run.status !== 'battle'} onClick={() => setLeaveOpen(true)}><BattleIcon kind="back" /></button>
        <div><small>{production ? 'THE END' : 'THE END · 試験専用'}</small><h1>エンドラ 最終決戦</h1></div>
        {production?.onShowTutorial && <button type="button" className="dc-icon-button" aria-label="絵であそびかたを見る" disabled={busy || rescueActive} onClick={production.onShowTutorial}>?</button>}
        <button type="button" className="dc-icon-button" aria-label={sound ? '音を消す' : '音を出す'} aria-pressed={sound} onClick={() => { if (sound) { audio.current?.stop(); skillAudio.current?.stop(); } setSound(value => !value); }}><BattleIcon kind={sound ? 'sound' : 'mute'} /></button>
      </header>
      <nav className="dc-chapters" aria-label="討伐の進み具合">{Object.entries(PHASE_NAMES).map(([key, label], i) => <span key={key} className={i === phaseIndex ? 'is-current' : i < phaseIndex ? 'is-done' : ''} aria-current={i === phaseIndex ? 'step' : undefined}><i aria-hidden="true">{i < phaseIndex ? '✓' : <ChapterSymbol phase={key as keyof typeof PHASE_NAMES} />}</i><small>{label}</small></span>)}</nav>
      <div className="dc-ticket-row"><span className="dc-ticket-count"><BattleIcon kind="ticket" /><b>{shown.tickets}</b></span><span className="dc-hands" aria-label={`支払い済みの行動あと${shown.hands}回`}>{[0, 1, 2, 3].map(i => <i key={i} className={i < shown.hands ? 'is-filled' : shown.hands === 0 && shown.tickets > 0 ? 'is-ready' : ''} />)}</span><small>{shown.hands > 0 ? `あと ${shown.hands} かい` : '1まい → 4かい'}</small><button type="button" disabled={busy || run.status !== 'battle'} onClick={() => setItemsOpen(true)}><BattleBagIcon />もちもの</button></div>
      <div className="dc-boss-health"><span>エンダードラゴン</span><HpBar hp={shown.bodyHp} total={campaignBodyMaxHp(shown)} label="エンダードラゴンの体力" /></div>

      {run.status !== 'battle' && !animation ? <>
        {run.status === 'won' ? <section className="dc-result dc-win"><BattleReward enemy="エンドラ" item="エリトラ" image="/mining/Elytra.png" variant="dragon" reduced={calm} headingRef={resultHeading} />{production && <button type="button" className="dc-quiet-button" onClick={production.onClose}>ぼうけんへ</button>}</section>
          : <>
            {run.status === 'lost' && <section className="dc-result dc-lost"><h2 ref={resultHeading} tabIndex={-1}>たおされた…</h2><p>こわしたところは のこっているよ</p><button className="dc-retry" type="button" disabled={busy || blocked || run.tickets < 1} onClick={() => production ? production.retry() : void act({ kind: 'retry' })}><BattleIcon kind="ticket" />1まいで おきあがる<span>そのまま 4かい うごける</span></button></section>}
            {run.status === 'paused' && <p className="dc-paused-note">ここまで きろくずみ · のこり {run.hands} かいも そのまま</p>}
            {draftEquipment && <div className="dc-equip-confirm" role="status"><p>そうびを まとめて かえる？<small>まだ確定していません。全部まとめて1行動。敵は動きません。</small></p><button type="button" disabled={busy || blocked || !canPay} onClick={() => void act({ kind: 'equip', equipment: draftEquipment })}>1行動で かえる</button><button type="button" disabled={busy} onClick={() => setDraftEquipment(null)}>もとに もどす</button></div>}
            {!production && <fieldset className="dc-prep-lock" disabled={busy || blocked} aria-busy={busy}><CampaignPreparation equipment={draftEquipment ?? run.equipment} supplies={run.supplies} canChangeType={run.safePreparation} tickets={run.tickets} normalAllyBonus={run.skills ? run.equipment.buddies.length : 0}
              onEquip={equipment => { if (run.safePreparation) void act({ kind: 'equip', equipment }); else setDraftEquipment(equipment); }} onCraft={recipeId => void act({ kind: 'craft', recipeId })}
              onUpgrade={category => { if (draftEquipment) setNotice('さきに そうびの へんこうを きめよう。'); else void act({ kind: 'upgrade', category }); }} onHarvest={place => void act({ kind: 'harvest', place })}
              onResume={() => { if (draftEquipment) setNotice('さきに そうびの へんこうを きめよう。'); else if (run.status === 'lost') setNotice('おきあがるボタンから もういちど たたかおう。'); else void act({ kind: 'resume' }); }} notice={notice} /></fieldset>}
            {production && <button type="button" className="dc-quiet-button" onClick={production.onClose}>そうび・クラフトへ</button>}
          </>}
      </> : <>
        <section className={`dc-arena dc-phase-${shown.phase} dc-intent-${shownIntent} ${enemyAttacking ? `dc-enemy-${stage === 'enemyWindup' ? 'windup' : stage === 'counter' ? 'strike' : 'impact'}` : ''} ${critical && stage === 'impact' ? 'dc-critical' : ''} ${stage === 'hurt' ? 'dc-hurt' : ''} ${special ? 'dc-special' : ''}`} aria-label="エンドラとの戦場" aria-busy={busy}>
          <div className="dc-stars" aria-hidden="true" /><div className="dc-moon" aria-hidden="true" /><div className="dc-end-island" aria-hidden="true" />
          {shown.phase === 'crystals' && <svg className={`dc-beams ${shown.bodyAttempts >= 3 ? 'dc-beams-hint' : ''} ${hitVisible && target === 'body' ? 'dc-beams-active' : ''}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{CRYSTAL_POS.map(([x, y], i) => shown.crystals[i] > 0 && <line key={i} x1={x + 7} y1={y + 7} x2="50" y2="47" />)}</svg>}
          {!busy && <div className="dc-forecast"><BattleForecast signal={dragonForecast(shownIntent, (shown.effects?.stun ?? 0) > 0)} detail={shown.orbHp > 0 ? `玉はあと${shown.orbTurns}回の行動で進む` : undefined} /></div>}
          {!calm && <span className="dc-flight-backlight" aria-hidden="true" />}
          <button className={`dc-dragon ${shown.selected === 'body' ? 'is-selected' : ''} ${hitVisible && (target === 'body' || stage === 'reflected') ? 'dc-struck' : ''} ${shown.landingTurns > 0 || brokenWings(shown) === 2 ? 'dc-landed' : ''} ${enemyAttacking ? 'dc-attacking' : ''} ${stage === 'victory' ? 'dc-boss-falling' : ''} ${shown.adventure && ['charge1', 'charge2'].includes(shownIntent) ? `dc-pressure-${shown.adventure.pressure}` : ''}`} disabled={busy || blocked} type="button" aria-label="エンダードラゴン本体をねらう" aria-pressed={shown.selected === 'body'} onClick={() => void act({ kind: 'select', target: 'body' })}>
            <span className="dc-dragon-aura" aria-hidden="true" /><img className={calm ? 'dc-dragon-still' : 'dc-dragon-flapping'} src={calm ? '/mining/Ender_Dragon_Campaign_v1.png' : '/mining/Ender_Dragon.gif'} alt="エンダードラゴン" draggable={false} /><i className="dc-target-mark" aria-hidden="true" />
          </button>
          {!calm && shown.selected === 'body' && <i className="dc-flight-mark" aria-hidden="true" />}
          {shown.phase === 'crystals' && shown.crystals.map((hp, i) => <button key={i} type="button" className={`dc-crystal ${hp === 0 ? 'dc-destroyed' : ''} ${shown.selected === `crystal:${i}` ? 'is-selected' : ''} ${i >= 4 && shown.barrierTurns === 0 ? 'dc-barrier' : ''} ${hitVisible && target === `crystal:${i}` ? 'dc-struck' : ''}`} style={{ left: `${CRYSTAL_POS[i][0]}%`, top: `${CRYSTAL_POS[i][1]}%` }} disabled={busy || blocked || hp <= 0} aria-label={`クリスタル${i + 1}、体力${hp}/${crystalMaxHp(i)}${i >= 4 && shown.barrierTurns === 0 ? '、バリアあり' : ''}`} aria-pressed={shown.selected === `crystal:${i}`} onClick={() => void act({ kind: 'select', target: `crystal:${i}` })}><span className="dc-tower" aria-hidden="true" /><img src="/mining/End_Crystal.jpg" alt="" draggable={false} /><span className="dc-crystal-shell" aria-hidden="true" />{hp > 0 ? <HpBar small hp={hp} total={crystalMaxHp(i)} label={`クリスタル${i + 1}の体力`} /> : <span className="dc-broken-mark">✓</span>}</button>)}
          {shown.phase === 'wings' && shown.wings.map((hp, i) => <button key={i} type="button" className={`dc-wing dc-wing-${i} ${shown.selected === `wing:${i}` ? 'is-selected' : ''} ${hp === 0 ? 'dc-wing-broken' : ''} ${focusTarget === `wing:${i}` ? 'dc-focus-target' : ''}`} disabled={busy || blocked || hp === 0} aria-label={`${i === 0 ? '左' : '右'}の翼、体力${hp}/48${focusTarget === `wing:${i}` ? '、光っている弱点' : ''}`} aria-pressed={shown.selected === `wing:${i}`} onClick={() => void act({ kind: 'select', target: `wing:${i}` })}><DragonWingArt side={i as 0 | 1} hp={hp} focused={focusTarget === `wing:${i}`} selected={shown.selected === `wing:${i}`} reduced={calm} /><HpBar small hp={hp} total={48} label="翼の体力" />{hp === 0 ? <b>✓</b> : focusTarget === `wing:${i}` && <b className="dc-weak-star">✦</b>}</button>)}
          {shown.orbHp > 0 && <button type="button" className={`dc-orb ${shown.selected === 'orb' ? 'is-selected' : ''} ${shown.orbTurns === 1 ? 'dc-orb-ready' : ''}`} disabled={busy || blocked} aria-label={`大きな玉、体力${shown.orbHp}、あと${shown.orbTurns}行動で爆発`} aria-pressed={shown.selected === 'orb'} onClick={() => void act({ kind: 'select', target: 'orb' })}><i aria-hidden="true" /><HpBar small hp={shown.orbHp} total={8} label="大きな玉の体力" /><span>{shown.orbTurns === 2 ? '● ●' : '●'}</span></button>}
          {shown.landingTurns > 0 && <div className="dc-opening-banner"><span>いまだ！</span>{Array.from({ length: shown.landingTurns }, (_, i) => <i key={i}>✦</i>)}</div>}
          {wingCloseup && <div className="dc-wing-closeup" aria-hidden="true"><DragonWingArt side={target === 'wing:0' ? 0 : 1} hp={shown.wings[target === 'wing:0' ? 0 : 1]} closeup focused reduced={calm} /></div>}
          {animation && stage !== 'ticket' && <div className={`dc-action-fx ${hitVisible && target !== 'body' ? 'dc-part-hit' : ''}`} key={animation.id}>
            {allyActing && <DragonAllyFx key={activeAlly?.id ?? 'party'} buddies={shown.equipment.buddies} hits={activeAlly ? [activeAlly] : helperHit?.allies} stroke={animation.before.adventure?.beat ?? animation.before.turns} special={special} impact={stage === 'assistImpact'} reduced={calm} />}
            {!allyActing && !enemyAttacking && stage !== 'reflect' && stage !== 'reflected' && <div className={stage !== 'victory' && target !== 'body' && ownFx === 'slash' ? 'dc-local-fx' : 'dc-global-fx'} style={stage !== 'victory' && target !== 'body' && ownFx === 'slash' ? impactPosition(target) : undefined}>
              {stage !== 'victory' && (ownFx === 'slash' || ownFx === 'ultimate') ? <DragonAttackFx stage={effectPhase} technique={technique} special={!!special} counter={counterStrike} critical={critical} stroke={animation.before.adventure?.beat ?? animation.before.turns} reduced={calm} buddies={shown.equipment.buddies} sword={animation.before.equipment.sword} skill={castKind} power={animation.action.kind === 'releaseSkill' ? animation.action.score / 100 : .5} />
                : ownFx === 'bed' && stage !== 'victory' ? <BedExplosionFx phase={effectPhase} reduced={calm} />
                  : <BattleSpectacle kind={stage === 'victory' ? 'victory' : ownFx} phase={effectPhase} variant="dragon" shield={shown.equipment.shield} reduced={calm} seed={animation.id} />}
            </div>}
            {stage === 'reflect' && <i className="dc-reflected-orb" aria-hidden="true" />}
            {stage === 'reflected' && <BattleSpectacle kind="enemyUltimate" phase="impact" variant="dragon" reduced={calm} />}
            {enemyAttacking && <DragonThreatArt kind={shownIntent === 'storm' ? 'storm' : shownIntent === 'orbFire' ? 'orb' : shownIntent === 'breath' ? 'breath' : shownIntent === 'gust' ? 'gust' : 'claw'} phase={stage === 'enemyWindup' ? 'windup' : stage === 'counter' ? 'strike' : 'impact'} reduced={calm} guarded={!!guarding} />}
            {(stage === 'assistImpact' || stage === 'impact' && !helperHit) && animation.events.some(e => e.kind === 'partBreak') && <div className="dc-local-fx" style={impactPosition(target)}><BattleSpectacle kind="break" phase="impact" variant="dragon" reduced={calm} /></div>}
          </div>}
          <DragonStatusArt effects={shown.effects} pulse={stage} />
          {stage === 'effect' && animation?.events.filter(event => event.kind === 'burn' || event.kind === 'effect').map((event, i) => <span className="dc-damage dc-effect-number" key={i}>{event.kind === 'burn' ? `🔥 −${event.amount}` : event.message}</span>)}
          {hitVisible && visibleHits.map((hit, index) => hit.amount > 0 && <span className={`dc-damage ${special && !allyActing ? 'dc-damage-special' : ''} ${allyActing ? 'dc-damage-ally' : ''} ${critical && stage === 'impact' ? 'dc-damage-critical' : ''}`} style={hit.kind === 'orbReflect' ? { left: '36%', top: '37%' } : impactPosition(hit.target ?? target)} key={`d${animation?.id}-${stage}-${index}`}>{critical && stage === 'impact' && <small>かいしん！</small>}{allyActing && <small>ついげき</small>}−{hit.amount}</span>)}
          {(stage === 'assistImpact' || stage === 'impact' && !helperHit) && animation?.events.some(e => e.kind === 'crystalHeal') && <span className="dc-boss-heal">＋{animation.events.find(e => e.kind === 'crystalHeal')?.amount}</span>}
          {stage === 'hurt' && taken > 0 && <span className="dc-incoming-number">−{taken}</span>}
        </section>
        <div className="dc-target-caption"><span>{shown.selected === 'body' ? 'エンドラ' : shown.selected === 'orb' ? 'おおきな たま' : shown.selected.startsWith('wing') ? 'つばさ' : 'クリスタル'} <b>{selectedHp}</b></span><small>{shown.phase === 'crystals' ? `◆ ${brokenCrystals(shown)}/8` : `翼 ${brokenWings(shown)}/2`}</small></div>
        {shown.adventure && <div className={`dc-tactic-strip ${shown.adventure.counter ? 'dc-counter-ready' : shown.landingTurns > 0 ? 'dc-tactic-opening' : ''}`} role="status">
          <span className="dc-tactic-pictures" aria-hidden="true">{shown.adventure.counter ? <><GuardArt shield={shown.equipment.shield} /><i>→</i><SwordArt tier={shown.equipment.sword} special /></>
            : shown.phase === 'crystals' ? <><img src="/mining/End_Crystal.jpg" alt="" /><i>→</i><span>✦</span></>
              : shown.phase === 'wings' ? <><ChapterSymbol phase="wings" /><i>→</i><SwordArt tier={shown.equipment.sword} /></>
                : shown.phase === 'orb' ? <><span className="dc-orb-symbol">●</span><i>↩</i><SwordArt tier={shown.equipment.sword} /></>
                  : <><span className="dc-pressure-pips"><i className={shown.adventure.pressure > 0 ? 'is-full' : ''} /><i /></span><i>→</i><span>✦</span></>}</span>
          <b>{adventureCue}</b>
        </div>}
        <section className="dc-player" aria-label="自分の体力"><div className="dc-hearts" role="img" aria-label={`体力${shown.hp}/${maxHp(shown.equipment)}`}>{Array.from({ length: maxHp(shown.equipment) / 2 }, (_, i) => <span key={i} className={shown.hp >= (i + 1) * 2 ? 'dc-heart-full' : shown.hp === i * 2 + 1 ? 'dc-heart-half' : ''}>♥</span>)}</div><small>{shown.hp}/{maxHp(shown.equipment)}</small></section>
        <div className="dc-commands">
          <button type="button" className={`dc-command dc-attack ${shown.adventure?.counter ? 'dc-riposte' : ''}`} disabled={commandDisabled} onClick={() => void act({ kind: 'attack' })}><SwordArt tier={run.equipment.sword} special={!!shown.adventure?.counter} /><b>{shown.adventure?.counter ? 'かえす' : 'こうげき'}</b></button>
          <button type="button" className="dc-command dc-guard" disabled={commandDisabled} onClick={() => void act({ kind: 'guard' })}><GuardArt shield={run.equipment.shield} /><b>まもる</b></button>
          <button type="button" className={`dc-command dc-ultimate ${shown.gauge >= 3 ? 'dc-ready' : ''}`} disabled={commandDisabled || run.gauge < 3} onClick={() => void act({ kind: 'beginSkill' })}><SwordArt tier={run.equipment.sword} special /><b>ひっさつ</b><span className="dc-gauge" aria-label={`必殺の光${shown.gauge}/3`}>{[0, 1, 2].map(i => <i key={i} className={i < shown.gauge ? 'is-full' : ''}>✦</i>)}</span></button>
          <button type="button" className="dc-command dc-heal" disabled={busy || blocked || recovery === 'daily-limit' || recovery === 'full'} aria-label={recovery === 'needs-bread' ? 'かいふく、パンのつくりかた' : 'かいふく'} onClick={() => recovery === 'needs-bread' ? setRecoveryHelp(true) : void act({ kind: 'heal' })}><BattleIcon kind="bread" /><b>かいふく</b><span className="dc-food-pips">{[0, 1].map(i => <i key={i} className={i < 2 - shown.foodToday ? 'is-full' : ''}>♥</i>)}</span></button>
        </div>
        {shown.gauge >= 3 && <div className="dc-technique-name">✦ ひっさつを えらべる！</div>}
        <DragonStatusBadges effects={shown.effects} />
        <div className="dc-bottom-row"><small>パン {shown.supplies.materials.bread ?? 0}こ</small><button type="button" className="dc-quiet-button" disabled={busy} onClick={() => setLeaveOpen(true)}>かえる</button></div>
        <p className="dc-live" role="status" aria-live="polite">{lastMessage}</p>
      </>}
      {notice && (run.status === 'battle' || run.status === 'won' || blocked) && <p className={`dc-notice ${blocked ? 'dc-error' : ''}`} role={blocked ? 'alert' : 'status'}>{notice}</p>}
      {blocked && <div className="dc-recovery"><button type="button" disabled={busy} onClick={reloadTestState}>記録を読み直す</button>{boot.backup && <button type="button" disabled={busy} onClick={() => void replaceTestState(boot.backup!)}>バックアップから試験記録を復元</button>}</div>}

      {!production && <details className="dc-parent"><summary>保護者用：試験設定・演出・数値</summary>
        <p>この画面専用のローカル試験記録です。本番の子ども・チケット・アイテム・旧エンドラ戦には接続しません。</p>
        <p>必殺だけ練習できます。チケット・敵・HPは変わりません。</p>
        <div className="dc-parent-line"><button type="button" disabled={busy || !!run.skills?.pending} onClick={() => { audio.current ??= createBlazeAudio(); if (sound) audio.current.unlock(); setCombatPreview(true); }}>敵の攻撃・会心をみる（消費なし）</button></div>
        <div className="dc-parent-line dc-practice-buttons">{SKILL_KINDS.map(kind => <button key={kind} type="button" disabled={busy || blocked || !!run.skills?.pending} onClick={() => { if (sound) { skillAudio.current ??= createDragonSkillAudio(); skillAudio.current.unlock(); } setPractice({ kind, id: ++sequence.current }); }}><SkillGlyph kind={kind} />{SKILL_NAMES[kind]}を練習</button>)}</div>
        <div className="dc-parent-line"><button type="button" className="dc-test-recover" disabled={busy || blocked || run.status === 'won' || run.hp >= maxHp(run.equipment) && run.status !== 'lost'} onClick={() => void recoverTestHp()}>♥ 試験用：HPを全回復</button></div>
        <p>全回復は自分のHPだけを変更します。パン・日付・敵HP・残り行動はそのまま。敗北後は準備画面へ戻ります。</p>
        <label className="dc-motion-setting"><input type="checkbox" checked={reduced} onChange={event => setReduced(event.target.checked)} />動き・揺れを弱める{systemReduced ? '（端末設定で有効）' : ''}</label>
        <label className="dc-motion-setting"><input type="checkbox" checked={phonePreview} onChange={event => setPhonePreview(event.target.checked)} />スマホ幅（360px）で確認</label>
        <div className="dc-parent-line"><select aria-label="確認する戦闘の段階" value={fixture} onChange={event => { setFixture(event.target.value as DragonFixture); setConfirmFixture(false); }}>{FIXTURES.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select><button disabled={busy} type="button" onClick={() => setConfirmFixture(true)}>段階を切り替える</button></div>
        {confirmFixture && <div className="dc-confirm"><p>今の試験記録をバックアップし、選んだ段階の仮データに置き換えます。</p><button type="button" disabled={busy} onClick={() => void replaceTestState(dragonCampaignFixture(fixture, run.day))}>この試験記録で切替</button><button type="button" onClick={() => setConfirmFixture(false)}>やめる</button></div>}
        <div className="dc-parent-line">{(['iron', 'diamond', 'netherite'] as const).map(tier => <button type="button" disabled={busy || blocked} key={tier} onClick={() => void replaceTestState(dragonArmorFixture(current.current, tier))}>{tier === 'iron' ? '鉄' : tier === 'diamond' ? 'ダイヤ' : 'ネザライト'}一式で確認</button>)}</div>
        <div className="dc-parent-line"><button type="button" disabled={busy || blocked} onClick={() => { const next = structuredClone(current.current); next.tickets += 20; next.revision++; void replaceTestState(next); }}>試験チケット＋20</button><button type="button" disabled={busy || blocked} onClick={() => { const day = new Date(`${current.current.day}T12:00:00`); day.setDate(day.getDate() + 1); const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`; void replaceTestState(refreshCampaignDay(current.current, key)); }}>翌日の回復を確認</button><button type="button" disabled={busy} onClick={reloadTestState}>保存記録を読み直す</button></div>
        <button type="button" className="dc-quiet-button" disabled={busy} onClick={() => { try { const snapshot = loadDragonSnapshot(window.localStorage); if (snapshot) void replaceTestState(snapshot); else setNotice('段階切替前の試験記録はまだありません。'); } catch { setNotice('退避記録を読み込めませんでした。'); } }}>段階切替前の記録に戻す</button>
        <output>試験日 {run.day} · 防具軽減 {(armorRate(run.equipment) * 100).toFixed(1)}% · 次の直撃 {campaignCounterDamage(run)}HP · 守ると {campaignCounterDamage(run, true)}HP · 行動{run.turns} · 敗北{run.defeats} · 記録v{run.version}/{run.revision}</output>
        <p>ベッドは討伐まで3個。パンは1日2個。エンチャント種類は準備開始時と攻略の区切り後に変更できます。途中の装備変更は1行動、同じ種類の★強化は行動不要です。</p>
        <a href="?end-journey=1">ジ・エンドまでの確認に戻る</a> · <a href="?blaze-prototype=1">ブレイズ</a> · <a href="?enderman-prototype=1">エンダーマン</a>
      </details>}
    </div>
    {!animation && <BattleSkillActivity skills={run.skills} unlocked={run.unlockedSkills ?? ['repel', 'aim', 'burst', 'gauge']} sound={sound} reduced={calm} compact={phonePreview} blocked={blocked} liveToken={liveSkill} onAction={act} onReload={reloadTestState} />}
    {rescueActive && !busy && <DragonCompanionRescue buddies={run.equipment.buddies} reduced={calm} onDone={() => act({ kind: 'rescue' })} />}
    {practice && <DragonSkillGame key={`practice-${practice.id}`} kind={practice.kind} practice sound={sound} reduced={calm} compact={phonePreview} onExit={() => setPractice(null)} onDone={score => { setPracticeCast({ kind: practice.kind, score }); setPractice(null); setNotice(`れんしゅう ${score}点：ダイヤ${8 + skillBonus('diamond', score)}／ネザライト${12 + skillBonus('netherite', score)}ダメージ（仲間・強化・弱点なし）。戦闘の記録は変えていません。`); }} />}
    {practiceCast && <DragonSkillPreview kind={practiceCast.kind} score={practiceCast.score} reduced={calm} compact={phonePreview} sword={run.equipment.sword} onClose={() => { setPracticeCast(null); skillAudio.current?.stop(); }} onStrike={() => { if (sound) { skillAudio.current ??= createDragonSkillAudio(); skillAudio.current.release(practiceCast.kind); } }} />}
    {combatPreview && <DragonCombatPreview equipment={run.equipment} reduced={calm} compact={phonePreview} onClose={() => { setCombatPreview(false); audio.current?.stop(); }} onCue={cue} />}
    <dialog className="dc-leave-dialog" ref={leaveDialog} onCancel={() => setLeaveOpen(false)}><h2>いったん かえる？</h2><div className="dc-leave-picture"><BattleIcon kind="ticket" /><span>{run.hands} ●</span></div><p>ここまでの たたかいも<br />のこりの行動も とっておくよ</p><button type="button" onClick={() => { setLeaveOpen(false); void act({ kind: 'pause' }); }}>かえる</button><button type="button" onClick={() => setLeaveOpen(false)}>まだ たたかう</button></dialog>
    {recoveryHelp && <BreadRecoveryHelp onClose={() => setRecoveryHelp(false)} />}
    {itemsOpen && <BattleItemsDialog held={run.heldItem ?? (run.equipment.shield ? 'shield' : 'none')}
      items={[...(run.supplies.owned.shield ? [{ id: 'shield' as const, count: run.supplies.materials.shield ?? 1 }] : []), { id: 'water', count: run.supplies.materials.water ?? 0 }, { id: 'spare_bed', count: run.supplies.materials.spare_bed ?? 0 }]}
      bedAvailable={!commandDisabled && campaignBedAvailable(run)} bedsLeft={Math.max(0, 3 - run.bedsUsed)}
      onHold={(item: HeldBattleItem) => { void act({ kind: 'hold', item }); return undefined; }}
      onBed={() => void act({ kind: 'bed' })} onClose={() => setItemsOpen(false)}
      onPrepare={() => { setItemsOpen(false); if (production?.onPrepare) production.onPrepare(); else void act({ kind: 'pause' }); }} />}
  </main>;
}
