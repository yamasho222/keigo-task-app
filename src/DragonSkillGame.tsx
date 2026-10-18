import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { AIM_CENTERS, AIM_COUNT, BURST_TAP_CAP, SKILL_DURATION, SKILL_NAMES, SKILL_TITLES, aimCursor, aimScore, aimTotalScore, burstScore, gaugeScore, repelTargets, repelScore, skillGaugePosition, type DragonSkillKind } from './dragonSkillRules';
import { DragonSkillArt } from './DragonSkillArt';
import { DragonBurstArt, type BurstTapPoint } from './DragonBurstArt';
import { richBurstEnabled, warmBurstAssets } from './dragonBurstPresentation';
import { createDragonSkillAudio } from './dragonSkillAudio';
import { DragonElementArt } from './DragonElementArt';
import { ELEMENT_ASSETS, ELEMENT_PROJECTILE_IMAGE, richElementEnabled, warmElementAssets } from './dragonElementPresentation';
import './dragonSkillGame.css';

export function SkillGlyph({ kind }: { kind: DragonSkillKind }) {
  return <svg className={`dm-glyph dm-glyph-${kind}`} viewBox="0 0 100 100" aria-hidden="true">
    {kind === 'burst' ? <><path d="M52 5C66 26 39 36 68 51c6-13 9-19 8-24 30 42 5 66-26 67C17 94 6 65 30 39c-3 18 1 22 6 24C21 37 51 28 52 5Z" /><path className="dm-gold" d="M51 50C68 67 69 83 51 89 31 85 37 70 51 50Z" /></>
      : kind === 'gauge' ? <path d="m62 4-42 51h27L36 96l47-59H56Z" />
        : kind === 'repel' ? <><path d="M8 59C28 73 36 25 61 30c18 2 22 22 13 27 2-13-14-14-18-4C49 74 28 84 8 59Z" /><path className="dm-line" d="M13 82c24 13 56 6 75-9" /></>
          : <><circle cx="50" cy="50" r="34" /><circle className="dm-gold" cx="50" cy="50" r="13" /><path className="dm-line" d="M50 5v18m0 54v18M5 50h18m54 0h18" /></>}
  </svg>;
}

type Props = { kind: DragonSkillKind; onDone: (score: number) => void; reduced: boolean; resumed?: boolean; blocked?: boolean; onReload?: () => void; practice?: boolean; sound?: boolean; onExit?: () => void; compact?: boolean };
type Feedback = { id: number; score: number; cursor: number };
/** Six active seconds. Hit feedback pauses the clock; only the parent writes battle outcomes. */
export function DragonSkillGame({ kind, onDone, reduced, resumed = false, blocked = false, onReload, practice = false, sound = true, onExit, compact = false }: Props) {
  const dialog = useRef<HTMLDialogElement>(null), callback = useRef(onDone), audio = useRef<ReturnType<typeof createDragonSkillAudio> | null>(null);
  const elapsedRef = useRef(0), finished = useRef(false), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taps = useRef(0), aim = useRef<number[]>([]), reflected = useRef(new Set<number>()), aimStart = useRef(0), lastPress = useRef(-1000), freezeUntil = useRef(0);
  const [elapsed, setElapsed] = useState(0), [count, setCount] = useState(0), [shots, setShots] = useState<number[]>([]), [returns, setReturns] = useState<number[]>([]);
  const [result, setResult] = useState<number | null>(null), [feedback, setFeedback] = useState<Feedback | null>(null);
  const [beat, setBeat] = useState(0), [aimOrigin, setAimOrigin] = useState(0), [started, setStarted] = useState(false);
  const [tapPoint, setTapPoint] = useState<BurstTapPoint>({ x: 50, y: 43 });
  const search = typeof window === 'undefined' ? '' : window.location.search;
  const richRequested = kind === 'burst' ? richBurstEnabled(search) : richElementEnabled(search);
  const [burstAssets, setBurstAssets] = useState<'loading' | 'ready' | 'fallback'>(richRequested ? 'loading' : 'ready');
  const richBurst = kind === 'burst' && richRequested && burstAssets !== 'fallback';
  const richElement = kind !== 'burst' && richRequested && burstAssets !== 'fallback';
  useEffect(() => {
    if (!richRequested) return;
    let alive = true;
    void (kind === 'burst' ? warmBurstAssets() : warmElementAssets(kind)).then(ok => { if (alive) setBurstAssets(ok ? 'ready' : 'fallback'); });
    return () => { alive = false; };
  }, [richRequested, kind]);
  useEffect(() => { callback.current = onDone; }, [onDone]);
  useEffect(() => { if (!sound) audio.current?.stop(); }, [sound]);
  const currentScore = useCallback(() => kind === 'burst' ? burstScore(taps.current) : kind === 'repel' ? repelScore(reflected.current.size)
    : kind === 'aim' ? aimTotalScore(aim.current) : 0, [kind]);
  const finish = useCallback((score: number) => {
    if (finished.current) return;
    finished.current = true; setResult(score);
    audio.current?.endCharge();
    if (sound) { audio.current ??= createDragonSkillAudio(); audio.current.release(kind); }
    timer.current = setTimeout(() => callback.current(score), 1250);
  }, [kind, sound]);
  useEffect(() => {
    dialog.current?.showModal();
    return () => { if (timer.current) clearTimeout(timer.current); audio.current?.dispose(); };
  }, []);
  useEffect(() => {
    if (!started || resumed || blocked) return;
    let request = 0, previous = performance.now();
    const update = (now: number) => {
      if (finished.current) return;
      const delta = Math.max(0, now - Math.max(previous, freezeUntil.current)); previous = now;
      if (freezeUntil.current && now >= freezeUntil.current) {
        freezeUntil.current = 0; setFeedback(null);
        if (aim.current.length === AIM_COUNT) { finish(currentScore()); return; }
      }
      elapsedRef.current = Math.min(SKILL_DURATION, elapsedRef.current + delta); setElapsed(elapsedRef.current);
      if (elapsedRef.current >= SKILL_DURATION) finish(currentScore());
      else request = requestAnimationFrame(update);
    };
    const hidden = () => { if (document.visibilityState === 'hidden') finish(currentScore()); };
    request = requestAnimationFrame(update); document.addEventListener('visibilitychange', hidden);
    return () => { cancelAnimationFrame(request); document.removeEventListener('visibilitychange', hidden); };
  }, [started, blocked, resumed, currentScore, finish]);
  const active = started && !blocked && !resumed && result === null;
  function begin() { if (burstAssets === 'loading') return; if (sound) { audio.current ??= createDragonSkillAudio(); audio.current.unlock(); if (richBurst) audio.current.charge(0); } setStarted(true); }
  function hit(id?: number, point?: BurstTapPoint) {
    if (!active || finished.current || freezeUntil.current > performance.now()) return;
    const now = elapsedRef.current;
    if (now >= SKILL_DURATION) { finish(currentScore()); return; }
    if (kind !== 'repel' && now - lastPress.current < 90) return;
    lastPress.current = now;
    if (kind === 'burst') {
      taps.current = Math.min(BURST_TAP_CAP, taps.current + 1); setCount(taps.current); setBeat(value => value + 1);
      setTapPoint(point ?? { x: 50, y: 43 });
      if (sound && richBurst) audio.current?.charge(taps.current / BURST_TAP_CAP);
      if (sound) audio.current?.tap(kind, taps.current / BURST_TAP_CAP);
    } else if (kind === 'gauge') {
      const score = gaugeScore(skillGaugePosition(now)); setBeat(value => value + 1); finish(score);
    } else if (kind === 'repel') {
      if (id === undefined || reflected.current.has(id) || !repelTargets(now).some(target => target.id === id)) return;
      reflected.current.add(id); setReturns([...reflected.current]); setBeat(value => value + 1);
      if (sound) audio.current?.tap(kind, reflected.current.size / 10);
      if (reflected.current.size === 10) finish(100);
    } else if (kind === 'aim') {
      if (aim.current.length >= AIM_COUNT) return;
      const cursor = aimCursor(now - aimStart.current), score = aimScore(cursor, AIM_CENTERS[0]);
      aim.current = [...aim.current, score]; aimStart.current = now; setAimOrigin(now); setShots(aim.current);
      setFeedback({ id: aim.current.length, score, cursor }); setBeat(value => value + 1); freezeUntil.current = performance.now() + 620;
      if (sound) audio.current?.shot(score);
    }
  }
  const gauge = skillGaugePosition(elapsed), cursor = feedback?.cursor ?? aimCursor(elapsed - aimOrigin);
  const center = AIM_CENTERS[0];
  const score = result ?? (kind === 'gauge' ? gaugeScore(gauge) : kind === 'burst' ? burstScore(count) : kind === 'repel' ? repelScore(returns.length) : aimTotalScore(shots));
  const power = kind === 'gauge' ? result !== null ? result / 100 : gauge : score / 100;
  const instruction = { burst: 'いっぱい タップ！', gauge: 'てっぺんで とめよう！', repel: 'たまを タップ！', aim: 'まんなかで タップ！' }[kind];
  return <dialog ref={dialog} className={`dm-dialog dm-game dm-${kind} ${richBurst ? 'dm-burst-rich' : richElement ? 'dm-element-rich' : ''} ${compact ? 'dm-burst-compact' : ''} ${reduced ? 'dm-reduced' : ''} ${result !== null ? 'dm-finished' : ''}`} aria-label={`${practice ? '練習：' : ''}${SKILL_NAMES[kind]}の必殺`} onCancel={event => { event.preventDefault(); if (!blocked) { if (practice && !started && onExit) onExit(); else finish(resumed ? 0 : currentScore()); } }}>
    <header><SkillGlyph kind={kind} /><div><small>{practice ? 'れんしゅう' : 'ひっさつ'}</small><h2>{SKILL_TITLES[kind]}</h2></div><span className="dm-clock" role="img" aria-label={`残り${Math.ceil((SKILL_DURATION - elapsed) / 1000)}秒`}>{Array.from({ length: 6 }, (_, i) => <i key={i} className={i < Math.ceil((SKILL_DURATION - elapsed) / 1000) ? 'is-full' : ''} />)}</span></header>
    {blocked ? <div className="dm-resume"><p>べつの画面で きろくが かわったよ</p><button type="button" onClick={onReload}>きろくを よみなおす</button></div>
      : resumed ? <div className="dm-resume"><SkillGlyph kind={kind} /><p>つづきの ひっさつを はなとう！</p><button type="button" disabled={result !== null} onClick={() => finish(0)}>ひっさつを はなつ</button><small>ためた光の いちげきは のこっているよ</small></div>
        : <>
          <p className="dm-instruction">{instruction}</p>
          <div className="dm-stage" style={{ '--dm-power': power } as CSSProperties}>
            {richBurst ? <DragonBurstArt power={power} beat={beat} point={tapPoint} reduced={reduced} active={active} phase={result !== null ? 'result' : 'charge'} /> : richElement ? <DragonElementArt kind={kind} power={power} beat={beat} reduced={reduced} active={active} phase={result !== null ? 'result' : 'charge'} shots={shots} /> : <DragonSkillArt kind={kind} power={power} beat={beat} reduced={reduced} active={active} phase={result !== null ? 'result' : 'charge'} />}
            {kind === 'burst' && <><button className={`dm-big-tap ${count >= BURST_TAP_CAP ? 'dm-max-tap' : ''}`} type="button" aria-label="連打する" disabled={!active} onPointerDown={event => { if (event.button === 0) { const rect = event.currentTarget.getBoundingClientRect(); hit(undefined, { x: Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)), y: Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100)) }); } }} onClick={event => { if (event.detail === 0) hit(); }}><span className="dm-touch-ring" key={beat} /><span className="dm-tap-word">{count >= BURST_TAP_CAP ? 'MAX' : 'タップ！'}</span></button><div className="dm-charge-pips" role="img" aria-label={`連打${count}/${BURST_TAP_CAP}回`}>{Array.from({ length: 12 }, (_, i) => <i key={i} className={i < Math.min(count < BURST_TAP_CAP ? 11 : 12, Math.ceil(count / BURST_TAP_CAP * 12)) ? 'is-full' : ''} />)}</div><b className="dm-power-word">{count >= BURST_TAP_CAP ? 'MAX POWER' : score >= 75 ? 'はじけそう！' : score >= 42 ? 'もっと つよく！' : 'ちからを あつめろ！'}</b></>}
            {kind === 'gauge' && <div className="dm-power-meter" role="meter" aria-label="必殺のパワー" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(gauge * 100)}><div className="dm-power-best">MAX</div><i className="dm-power-fill" style={{ height: `${gauge * 100}%` }} /><b className="dm-power-pointer" style={{ bottom: `${gauge * 100}%` }}>◀</b><div className="dm-meter-ticks" /></div>}
            {kind === 'repel' && <><div className="dm-water-shield" aria-hidden="true" /><div className="dm-repel-count" aria-label={`打ち返した数${returns.length}/10`}>{returns.length}<small> / 10</small></div>{repelTargets(elapsed).map(target => {
              const returned = returns.includes(target.id);
              return <button key={target.id} type="button" className={`dm-repel-ball ${returned ? 'dm-returned' : ''}`} style={{ left: `${target.x}%`, top: `${target.y}%`, '--dm-age': target.age / 1100, '--de-return-x': `${50 - target.x}cqw`, '--de-return-y': `${48 - target.y}cqh` } as CSSProperties} aria-label={`光の玉${target.id + 1}を打ち返す`} disabled={!active || returned} onPointerDown={event => { if (event.button === 0) hit(target.id); }} onClick={event => { if (event.detail === 0) hit(target.id); }}><i /><b /><span />{richElement && <img src={returned ? ELEMENT_ASSETS.repel.core : ELEMENT_PROJECTILE_IMAGE} alt="" draggable={false} />}</button>;
            })}</>}
            {kind === 'aim' && <div className="dm-aim-scene"><div className={`dm-aim-lane ${feedback ? 'dm-aim-hit' : ''}`}><span className="dm-aim-target" style={{ left: `${center * 100}%` }} /><i className="dm-aim-cursor" style={{ left: `${cursor * 100}%` }}><b /></i></div><div className="dm-shots" aria-label={`ねらった回数${shots.length}/${AIM_COUNT}`}>{Array.from({ length: AIM_COUNT }, (_, i) => <i key={i} className={shots[i] !== undefined ? `is-done ${shots[i] >= 85 ? 'is-perfect' : ''}` : ''}>{shots[i] !== undefined ? <><b>{shots[i]}</b><small>{shots[i] >= 65 ? '★' : shots[i] > 0 ? '✦' : '・'}</small></> : <span>◆</span>}</i>)}</div>{feedback && <div className={`dm-shot-feedback ${feedback.score >= 85 ? 'dm-perfect' : ''}`} key={feedback.id}><i /><b>{feedback.score}<small>点</small></b><span>{feedback.score === 100 ? 'PERFECT' : feedback.score >= 65 ? 'いいぞ！' : feedback.score > 0 ? 'ヒット！' : 'おしい！'}</span></div>}</div>}
            {result !== null && <div className="dm-score" role="status"><small>POWER</small><strong>{result}<small>点</small></strong><div>{[0, 40, 80].map(threshold => <span key={threshold} className={result >= threshold ? 'is-lit' : ''}>★</span>)}</div><b>{result >= 85 ? 'すごい！' : 'いくぞ！'}</b></div>}
          </div>
          {!started ? <button className="dm-fire" type="button" aria-label="ミニゲームをはじめる" disabled={burstAssets === 'loading'} onClick={begin}>{burstAssets === 'loading' ? 'じゅんびちゅう…' : '▶ はじめる'}</button>
            : (kind === 'gauge' || kind === 'aim') ? <button className="dm-fire" type="button" disabled={!active || !!feedback} onPointerDown={event => { if (event.button === 0) hit(); }} onClick={event => { if (event.detail === 0) hit(); }}>{kind === 'gauge' ? 'とめる！' : feedback ? feedback.score > 0 ? 'ヒット！' : 'おしい！' : 'ここだ！'}</button>
              : <div className="dm-start-space" aria-hidden="true" />}
          <button className="dm-secondary" type="button" disabled={blocked || result !== null} onClick={() => { if (practice && !started && onExit) onExit(); else finish(currentScore()); }}>{practice && !started ? 'もどる' : 'このまま はなつ'}</button>
        </>}
  </dialog>;
}
