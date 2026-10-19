import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { createDragonSkillAudio } from './dragonSkillAudio';
import { ELEMENT_ASSETS, warmElementAssets } from './dragonElementPresentation';
import { DragonElementArt } from './DragonElementArt';
import {
  WATER_BOARD, WATER_BUBBLE_COUNT, WATER_ORIGIN, WATER_SHOTS,
  advanceWaterSling, createWaterSling, launchWaterSling, waterDirection, waterGuide,
  waterPosition, waterPullPosition, waterSlingScore, type WaterPoint,
} from './waterSlingRules';
import './waterSling.css';

type Props = {
  onDone: (score: number) => void; reduced: boolean; symbol: ReactNode;
  resumed?: boolean; blocked?: boolean; onReload?: () => void; practice?: boolean;
  sound?: boolean; onExit?: () => void; compact?: boolean;
};
/** Local activity only: one scored callback, never writes resources or battle effects. */
export function WaterSlingGame({ onDone, reduced, symbol, resumed = false, blocked = false, onReload, practice = false, sound = true, onExit, compact = false }: Props) {
  const dialog = useRef<HTMLDialogElement>(null), field = useRef<HTMLDivElement>(null);
  const callback = useRef(onDone), blockedRef = useRef(blocked), alive = useRef(true), finished = useRef(false);
  const audio = useRef<ReturnType<typeof createDragonSkillAudio> | null>(null), resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [model, setModel] = useState(() => createWaterSling(globalThis.crypto.getRandomValues(new Uint32Array(1))[0])), [started, setStarted] = useState(false);
  const current = useRef(model), gesture = useRef<{ id: number; anchor: WaterPoint } | null>(null);
  const [aim, setAim] = useState<WaterPoint | null>(null), [result, setResult] = useState<number | null>(null);
  const [pull, setPull] = useState<WaterPoint | null>(null);
  const [assets, setAssets] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const gradient = `water-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  useLayoutEffect(() => { callback.current = onDone; blockedRef.current = blocked; }, [onDone, blocked]);
  useEffect(() => {
    let live = true; void warmElementAssets('repel').then(ok => { if (live) setAssets(ok ? 'ready' : 'fallback'); });
    return () => { live = false; };
  }, []);
  const dropGesture = useCallback(() => {
    const id = gesture.current?.id; gesture.current = null; setAim(null); setPull(null);
    if (id !== undefined && field.current?.hasPointerCapture(id)) field.current.releasePointerCapture(id);
  }, []);
  const finish = useCallback((forced?: number) => {
    if (finished.current || blockedRef.current || !alive.current) return;
    finished.current = true; dropGesture(); audio.current?.endCharge();
    const score = forced ?? waterSlingScore(current.current.popped); setResult(score);
    if (sound) { audio.current ??= createDragonSkillAudio(); audio.current.release('repel'); }
    resultTimer.current = setTimeout(() => { if (alive.current && !blockedRef.current) callback.current(score); }, 1250);
  }, [sound, dropGesture]);
  useEffect(() => {
    alive.current = true; dialog.current?.showModal();
    return () => { alive.current = false; if (resultTimer.current) clearTimeout(resultTimer.current); audio.current?.dispose(); };
  }, []);
  useEffect(() => { if (!sound) audio.current?.stop(); }, [sound]);
  useEffect(() => {
    if (!blocked && !resumed) return;
    const id = gesture.current?.id; gesture.current = null;
    if (id !== undefined && field.current?.hasPointerCapture(id)) field.current.releasePointerCapture(id);
    audio.current?.stop();
  }, [blocked, resumed]);
  useEffect(() => {
    if (!started || resumed || blocked || result !== null) return;
    const hidden = () => { if (document.visibilityState === 'hidden') finish(); };
    document.addEventListener('visibilitychange', hidden);
    return () => document.removeEventListener('visibilitychange', hidden);
  }, [started, resumed, blocked, result, finish]);
  useEffect(() => {
    if (model.phase !== 'flight' || blocked || resumed || result !== null) return;
    let frame = 0, previous = performance.now();
    const tick = (now: number) => {
      if (finished.current || blockedRef.current || !alive.current) return;
      const before = current.current;
      const next = advanceWaterSling(before, before.elapsed + Math.min(64, Math.max(0, now - previous))); previous = now;
      current.current = next; setModel(next);
      if (next.popped.length > before.popped.length && sound) { audio.current?.tap('repel', next.popped.length / WATER_BUBBLE_COUNT); audio.current?.charge(next.popped.length / WATER_BUBBLE_COUNT); }
      if (next.phase === 'done') finish();
      else if (next.phase === 'flight') frame = requestAnimationFrame(tick);
      else audio.current?.endCharge();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [model.phase, model.shots, blocked, resumed, result, sound, finish]);
  const active = started && !blocked && !resumed && result === null;
  function launch(direction: WaterPoint) {
    if (!active || finished.current || current.current.phase !== 'ready') return;
    const next = launchWaterSling(current.current, direction);
    if (next === current.current) return;
    current.current = next; setModel(next); dropGesture();
    if (sound) { audio.current ??= createDragonSkillAudio(); audio.current.unlock(); audio.current.charge(next.popped.length / WATER_BUBBLE_COUNT); audio.current.tap('repel', .3); }
  }
  function point(event: PointerEvent<HTMLDivElement>): WaterPoint {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - box.left) / box.width * WATER_BOARD.width, y: (event.clientY - box.top) / box.height * WATER_BOARD.height };
  }
  function down(event: PointerEvent<HTMLDivElement>) {
    if (!active || finished.current || current.current.phase !== 'ready' || gesture.current || event.button !== 0 || !event.isPrimary) return;
    const p = point(event);
    if (Math.hypot(p.x - WATER_ORIGIN.x, p.y - WATER_ORIGIN.y) > 44) return;
    event.preventDefault(); gesture.current = { id: event.pointerId, anchor: p };
    event.currentTarget.setPointerCapture(event.pointerId); setAim(null); setPull({ x: 0, y: 0 });
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (gesture.current?.id !== event.pointerId) return;
    event.preventDefault(); const p = point(event), anchor = gesture.current.anchor;
    setAim(waterDirection(anchor, p)); setPull({ x: p.x - anchor.x, y: p.y - anchor.y });
  }
  function up(event: PointerEvent<HTMLDivElement>) {
    if (gesture.current?.id !== event.pointerId) return;
    event.preventDefault(); const direction = waterDirection(gesture.current.anchor, point(event));
    dropGesture(); if (direction) launch(direction);
  }
  const score = result ?? waterSlingScore(model.popped), power = score / 100;
  const guide = aim && model.phase === 'ready' ? waterGuide(aim) : [];
  const drawnBall = model.phase === 'ready' && active && pull ? waterPullPosition(pull) : model.ball;
  const tension = Math.min(1, Math.hypot(drawnBall.x - WATER_ORIGIN.x, drawnBall.y - WATER_ORIGIN.y) / 58);
  const pullAngle = Math.atan2(drawnBall.y - WATER_ORIGIN.y, drawnBall.x - WATER_ORIGIN.x) * 180 / Math.PI;
  const trail = model.phase === 'flight' ? [100, 80, 60, 40, 20, 0].map(delta => waterPosition(model.path, Math.max(0, model.elapsed - delta))) : [];
  const points = (p: WaterPoint[]) => p.map(v => `${v.x},${v.y}`).join(' ');
  return <dialog ref={dialog} className={`dm-dialog dm-game dm-repel ws-game${compact ? ' ws-compact' : ''}${reduced ? ' dm-reduced' : ''}${result !== null ? ' dm-finished' : ''}`} aria-label={`${practice ? '練習：' : ''}ひっぱるの必殺`} onCancel={event => {
    event.preventDefault(); if (blocked) return;
    if (practice && !started && onExit) onExit(); else finish(resumed ? 0 : undefined);
  }}>
    <header>{symbol}<div><small>{practice ? 'れんしゅう' : 'ひっさつ'}</small><h2>そうりゅうの いちげき</h2></div><span className="ws-ammo" role="img" aria-label={`のこり${WATER_SHOTS - model.shots}球`}>{Array.from({ length: WATER_SHOTS }, (_, i) => <i key={i} className={i < WATER_SHOTS - model.shots ? 'is-full' : ''} />)}</span></header>
    {blocked ? <div className="dm-resume ws-resume"><p>べつの画面で きろくが かわったよ</p><button type="button" onClick={onReload}>きろくを よみなおす</button></div>
      : resumed ? <div className="dm-resume ws-resume">{symbol}<p>つづきの ひっさつを はなとう！</p><button type="button" disabled={result !== null} onClick={() => finish(0)}>ひっさつを はなつ</button><small>ためた光の いちげきは のこっているよ</small></div>
        : <>
          <p className="dm-instruction">{result !== null ? 'いくぞ！' : model.phase === 'flight' ? 'はじけろ！' : 'ひっぱって、はなす！'}</p>
          <div ref={field} className={`dm-stage ws-field${model.phase === 'flight' ? ' ws-flying' : ''}${tension > 0 ? ' ws-pulling' : ''}${!started ? ' ws-demo' : ''}`} role="group" tabIndex={0} aria-label="水の球を引っ張って1回発射。矢印キーで向き、スペースで発射" style={{ '--ws-power': power, '--ws-tension': tension } as CSSProperties}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={dropGesture} onLostPointerCapture={dropGesture}
            onKeyDown={event => {
              if (!active || model.phase !== 'ready') return;
              if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'].includes(event.key)) event.preventDefault();
              if (event.key === ' ' || event.key === 'Enter') launch(aim ?? { x: 0, y: -1 });
              else if (event.key.startsWith('Arrow')) {
                setPull(null);
                const angle = event.key === 'ArrowUp' ? -Math.PI / 2 : event.key === 'ArrowDown' ? Math.PI / 2 : Math.atan2(aim?.y ?? -1, aim?.x ?? 0) + (event.key === 'ArrowLeft' ? -.12 : .12);
                setAim({ x: Math.cos(angle), y: Math.sin(angle) });
              }
            }}>
            {assets === 'ready' && <DragonElementArt kind="repel" power={power} phase="charge" active={started && result === null} reduced={reduced} />}
            <svg className="ws-board" viewBox="0 0 320 360" aria-hidden="true">
              <defs>
                <radialGradient id={`${gradient}-bubble`} cx="33%" cy="24%" r="80%"><stop stopColor="#f3ffff" stopOpacity=".7" /><stop offset=".18" stopColor="#9be8f4" stopOpacity=".18" /><stop offset=".65" stopColor="#115a80" stopOpacity=".25" /><stop offset=".88" stopColor="#67e3f6" stopOpacity=".5" /><stop offset="1" stopColor="#e1ffff" stopOpacity=".8" /></radialGradient>
                <radialGradient id={`${gradient}-ball`} cx="36%" cy="28%"><stop stopColor="#fff" /><stop offset=".25" stopColor="#bafcff" /><stop offset=".6" stopColor="#58d9f3" /><stop offset="1" stopColor="#196d9e" /></radialGradient>
                <linearGradient id={`${gradient}-dragon`} x1="0" x2="1"><stop stopColor="#08789e" /><stop offset=".5" stopColor="#b5f7ff" /><stop offset="1" stopColor="#26b9df" /></linearGradient>
              </defs>
              <rect className="ws-boundary" x="12" y="12" width="296" height="336" rx="5" />
              <g className="ws-dragon" style={{ opacity: .06 + power * .35 }}><path d="M76 260c150 25 160-76 66-80S116 84 213 104" stroke={`url(#${gradient}-dragon)`} strokeWidth="24" fill="none" /><path d="m205 104-6-25 18 9 21 6-7 14-16 11Z" fill={`url(#${gradient}-dragon)`} /><path d="m199 81 4-21 12 27m10 9 22-1-15 10M89 250l-22-9 10 21" stroke="#acfbff" strokeWidth="3" fill="none" /><circle cx="224" cy="98" r="2" fill="#fff" /></g>
              {model.bubbles.map(bubble => <g key={bubble.id} className={`ws-bubble${model.popped.includes(bubble.id) ? ' ws-popped' : ''}`} style={{ '--ws-x': bubble.x, '--ws-y': bubble.y } as CSSProperties}>
                <circle cx={bubble.x} cy={bubble.y} r={bubble.radius} fill={`url(#${gradient}-bubble)`} stroke="#b8f6ff" strokeWidth="1.1" />
                <path d={`M${bubble.x - 13} ${bubble.y - 4}q0-11 13-13`} fill="none" stroke="#efffff" strokeWidth="3" strokeLinecap="round" opacity=".9" />
                <path d={`M${bubble.x + 13} ${bubble.y + 5}q-1 8-10 10`} fill="none" stroke="#56d5f2" strokeWidth="2" opacity=".7" />
                <circle className="ws-bubble-ring" cx={bubble.x} cy={bubble.y} r={bubble.radius} />
              </g>)}
              {guide.length > 0 && <g className="ws-guide"><polyline points={points(guide.slice(0, 2))} /><polyline className="ws-guide-tail" points={points(guide.slice(1))} /><circle cx={guide[1].x} cy={guide[1].y} r="4" /><path className="ws-arrow" d="M-7-5 0 0-7 5" transform={`translate(${guide[2].x} ${guide[2].y}) rotate(${Math.atan2(guide[2].y - guide[1].y, guide[2].x - guide[1].x) * 180 / Math.PI})`} /></g>}
              {tension > 0 && <g className="ws-elastic"><circle className="ws-anchor-ghost" cx="160" cy="310" r="17" /><path className="ws-elastic-glow" d={`M142 310L${drawnBall.x} ${drawnBall.y}L178 310`} /><path className="ws-elastic-band" d={`M142 310L${drawnBall.x} ${drawnBall.y}L178 310`} /><circle cx="142" cy="310" r="3" /><circle cx="178" cy="310" r="3" /></g>}
              {model.phase === 'ready' && <><ellipse className="ws-launch-ring" cx="160" cy="310" rx="34" ry="27" /><path className="ws-launch-chevron" d="m148 272 12-10 12 10" /></>}
              {trail.length > 0 && !reduced && <><polyline className="ws-trail ws-trail-glow" points={points(trail)} /><polyline className="ws-trail" points={points(trail)} /></>}
              <g transform={`translate(${drawnBall.x} ${drawnBall.y}) rotate(${pullAngle})`}><ellipse className="ws-projectile" cx="0" cy="0" rx={model.phase === 'flight' ? 10 : 17 + tension * 4} ry={model.phase === 'flight' ? 10 : 17 - tension * 3} fill={`url(#${gradient}-ball)`} /></g>
              {!started && <g className="ws-hand-demo"><path d="M153 309v-12c0-5 7-5 7 0v7-5c0-4 7-4 7 0v7-3c0-4 7-4 7 0v13c0 12-5 17-12 17-8 0-11-6-16-13-3-5 2-8 5-4l3 3" /></g>}
            </svg>
            <div className="ws-count" aria-label={`割った泡${model.popped.length}/${WATER_BUBBLE_COUNT}`}><span className="ws-count-orb" aria-hidden="true" /><b>{model.popped.length}<small> / {WATER_BUBBLE_COUNT}</small></b></div>
            {model.phase === 'flight' && model.popped.length > 0 && <span className="ws-chain" key={model.popped.length}>{model.popped.length}<small>こ！</small></span>}
            {result !== null && <div className="dm-score ws-result" role="status">{assets === 'ready' && <img src={ELEMENT_ASSETS.repel.strike} alt="" />}<small>POWER</small><strong>{result}<small>点</small></strong><b>{result === 100 ? 'ぜんぶ はじけた！' : 'いくぞ！'}</b></div>}
          </div>
          <div className="ws-controls">{!started ? <button className="dm-fire" type="button" aria-label="ミニゲームをはじめる" disabled={assets === 'loading' || result !== null} onClick={() => {
            if (sound) { audio.current ??= createDragonSkillAudio(); audio.current.unlock(); }
            setStarted(true); field.current?.focus();
          }}>{assets === 'loading' ? 'じゅんびちゅう…' : '▶ はじめる'}</button> : <p className="ws-feedback" role="status" aria-live="polite">{result !== null ? `${score}てん！` : model.phase === 'flight' ? 'はじけろ！' : model.shots > 0 ? `あと ${WATER_SHOTS - model.shots}はつ！` : 'ひっぱって、はなす！'}</p>}
          <button className="dm-secondary" type="button" disabled={blocked || result !== null} onClick={() => { if (practice && !started && onExit) onExit(); else finish(); }}>{practice && !started ? 'もどる' : 'このまま はなつ'}</button></div>
        </>}
  </dialog>;
}
