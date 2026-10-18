import { useId } from 'react';
import type { CSSProperties } from 'react';

const SURFACE = 'M63 121C42 106 68 83 113 83C136 59 196 69 231 58C276 48 308 65 345 59C386 48 420 70 460 69C506 64 525 88 557 100C589 111 582 135 548 145C526 166 475 158 441 169C402 184 362 168 326 177C287 190 251 172 211 175C162 180 134 159 102 157C68 156 43 142 63 121Z';

/** Code-native liquid: irregular banks, visible bed, reflected canopy and moving wavelets. */
export function EndermanPond({ equipped = false, splashing = false, compact = false }: { equipped?: boolean; splashing?: boolean; compact?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return <div className={`ep-pond ${equipped ? 'ep-pond-equipped' : 'ep-pond-natural'} ${splashing ? 'is-splashing' : ''} ${compact ? 'ep-pond-compact' : ''}`} aria-hidden="true">
    <svg className="ep-pond-scene" viewBox="0 0 640 220" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`${id}-bed`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#506357" /><stop offset="1" stopColor="#283e3d" /></linearGradient>
        <linearGradient id={`${id}-liquid`} x1="0" y1="0" x2=".1" y2="1"><stop stopColor="#69bed4" stopOpacity=".82" /><stop offset=".45" stopColor="#167caa" stopOpacity=".78" /><stop offset="1" stopColor="#68c7d8" stopOpacity=".9" /></linearGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#85b4a0" /><stop offset="1" stopColor="#344c45" /></linearGradient>
        <pattern id={`${id}-caustic`} width="95" height="47" patternUnits="userSpaceOnUse"><path d="m0 25 25-6 22 7 28-10 20 7M25 19l7-17m15 24 7 20" fill="none" stroke="#adf3f1" strokeWidth="1.5" opacity=".28" /></pattern>
        <clipPath id={`${id}-surface`}><path d={SURFACE} /></clipPath>
      </defs>
      <path d={SURFACE} className="ep-pond-shadow" transform="translate(0 15) scale(1 .97)" fill="#142e32" opacity=".38" />
      <path d="M48 118C21 91 72 65 105 67C131 44 196 50 226 44C267 32 314 48 346 44C394 33 426 53 463 53C515 47 540 79 569 86C613 109 600 148 563 160C535 183 481 172 445 186C401 201 361 184 326 192C278 204 247 188 211 191C161 196 127 175 93 174C46 170 24 141 48 118Z" fill={`url(#${id}-edge)`} />
      <path d={SURFACE} transform="translate(0 8)" fill="#225560" />
      <g clipPath={`url(#${id}-surface)`}>
        <path d={SURFACE} fill={`url(#${id}-bed)`} />
        <g className="ep-pond-bed" fill="#839b85" stroke="#536c62" strokeWidth="3"><path d="m109 121 28-12 29 8-10 18-30 5zM237 146l24-13 31 11-12 15-27 1zM382 100l27-11 23 12-9 18-29-2zM483 136l24-13 30 13-16 17-28-2z" /><path d="m188 89 13-5 16 5-3 10-19 1zM350 160l15-6 17 7-6 9-19-1z" /></g>
        <path d={SURFACE} fill={`url(#${id}-liquid)`} />
        <path d={SURFACE} fill={`url(#${id}-caustic)`} className="ep-pond-caustic" />
        <g className="ep-pond-reflection" fill="#bcebe5" opacity=".28"><path d="m112 73 21 0-10 21 14 12-19 7 12 13-15 18-14-4 11-20-12-13 15-12zM185 60h31l-15 24 18 8-22 15 16 10-20 13-10-8 10-15-15-12 14-17zM437 61h24l-12 23 17 13-21 9 13 13-20 18-12-4 16-23-18-10 19-17z" /><path d="M95 115q54-16 92-6t69-5M357 140q46-19 77-9t87-8" fill="none" stroke="#d9fcf4" strokeWidth="7" /></g>
        {equipped && <path className="ep-pond-mob-reflection" d="m307 80 22 0 3 13-6 3 5 25-8 3-4-21-5 22-8-3 4-27-5-3z" fill="#182e43" opacity=".28" />}
        <g className="ep-pond-wavelets" fill="none" stroke="#c4f3f0" strokeWidth="2.5" strokeLinecap="round"><path d="M86 125q18-7 40-2m31 15 27-3M207 92q15-5 30-1m42 57q23-8 51-3m41-53 31 1m56 43q25-11 53-5M373 162l22-3" /><path d="M138 91l23-2m76 72 23 3m83-53 19-2m150 1 25 5" opacity=".55" /></g>
        <g className="ep-pond-touch-ripples" fill="none" stroke="#d2faff" strokeWidth="2"><path d="M276 117q-17 8 4 13m72-15q18 9-4 17M259 111q-34 16 7 29m98-28q35 15-9 29" /></g>
      </g>
      <g fill="none" strokeLinecap="round"><path d="M76 102q17-13 42-12m26-14 30-4M81 145q21 10 47 9m318 10 42-7m53-13q26-5 27-17" stroke="#b3e5d8" strokeWidth="3" opacity=".65" /><path d="M109 168q28-2 44 9m293 3 34-9" stroke="#496b4d" strokeWidth="6" /></g>
      <g className="ep-pond-stones" stroke="#455b4d" strokeWidth="2"><path d="m54 115 19-10 19 9-5 13-23 5z" fill="#93a191" /><path d="m99 169 21-13 25 9-5 14-26 4z" fill="#708272" /><path d="m525 156 21-11 20 8-2 13-26 4z" fill="#849786" /><path d="m464 62 15-10 24 4 5 13-24 5z" fill="#849a89" /></g>
      <g className="ep-pond-reeds" fill="none" strokeLinecap="round"><path d="m84 88-8-26m8 26 8-33m-8 33 17-18M539 150l10-29m-10 29-2-19m2 19 19-11M148 175l-4-20m4 20 10-18" stroke="#416b48" strokeWidth="5" /><path d="m85 80 6-22m448 92 10-24m-401 49 8-16" stroke="#a4b777" strokeWidth="2.5" /></g>
    </svg>
    {!compact && <div className="ep-pond-spray">{Array.from({ length: 7 }, (_, i) => <i key={i} style={{ '--drop-x': (i - 3) * 16, '--drop-y': -24 - (3 - Math.abs(i - 3)) * 11, '--drop-delay': i * .045 } as CSSProperties} />)}</div>}
  </div>;
}

/** A recognizable object, not the old blue block or an answer written in a label. */
export function EndermanBucket() {
  return <svg className="ep-item-art ep-bucket-art" viewBox="0 0 72 72" aria-hidden="true" fill="none" strokeLinejoin="round"><path d="M19 28V20a17 17 0 0 1 34 0v8" stroke="#1f303c" strokeWidth="9" /><path d="M19 28V20a17 17 0 0 1 34 0v8" stroke="#b8d2d9" strokeWidth="5" /><path d="m10 26 7 35q20 10 39 0l6-35Z" fill="#899da5" stroke="#d6e8e9" strokeWidth="3" /><path d="m17 31 6 27 8 3-4-29Z" fill="#d7e9e9" opacity=".7" /><path d="m49 32-3 29 9-3 5-29Z" fill="#526a78" /><ellipse cx="36" cy="27" rx="26" ry="10" fill="#1f698e" stroke="#d8e8e8" strokeWidth="3" /><path d="M13 28q11-8 24-3t22 1q-6 10-24 9T13 28" fill="#58c6e6" /><path d="m21 28 10-2m7 4 13-2" stroke="#c5f7ff" strokeWidth="2.5" strokeLinecap="round" /><path d="M31 5h10" stroke="#43535a" strokeWidth="6" strokeLinecap="round" /></svg>;
}
