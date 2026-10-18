import { useId } from 'react';
import './dragonWingArt.css';

type DragonWingArtProps = {
  side: 0 | 1;
  hp: number;
  maxHp?: number;
  focused?: boolean;
  selected?: boolean;
  closeup?: boolean;
  reduced?: boolean;
};

// One sculpted wing, reflected as a whole for the opposite side. All details share
// the same coordinates, including the transparent tears and the close-up crop.
const OUTLINE = 'M398 224 378 190 352 136 340 114 304 91 266 76 230 61 183 49 132 37 79 24 35 17 43 43 57 70 69 101 89 151 101 159 116 148 130 149 146 164 160 185 175 191 189 177 204 175 219 194 236 224 249 233 266 213 280 208 295 225 311 248 326 253 340 236 352 233 371 244 395 245 407 237Z';

const SAILS = [
  'M49 31 102 42 160 56 225 72 205 89 174 105 149 125 130 145 114 143 98 151 79 101 66 70Z',
  'M227 76 218 106 208 135 204 168 188 171 173 184 163 180 148 158 133 146 155 124 181 104Z',
  'M235 81 254 110 268 143 279 201 266 205 248 225 241 218 223 187 210 171 214 135 225 103Z',
  'M243 82 281 95 314 113 340 137 354 170 372 208 390 237 373 238 354 226 337 230 323 245 316 240 300 217 287 202 276 143 260 108Z',
];

const FACETS = [
  'M49 31 160 56 225 72 174 105 149 125 165 93 121 68 76 55Z',
  'M76 78 121 68 165 93 149 125 130 145 114 143 98 151Z',
  'M227 76 208 135 204 168 188 171 173 184 183 142 196 109Z',
  'M235 81 254 110 268 143 279 201 266 205 255 163 237 143 225 103Z',
  'M243 82 314 113 340 137 354 170 309 137 281 127 276 143 260 108Z',
  'M287 156 309 137 354 170 372 208 390 237 354 226 337 230 323 245 316 240 306 207Z',
];

const FINGERS = [
  'M388 226 370 192 346 139 333 119 300 98 266 84 231 73 184 60 132 47 80 34 44 25',
  'M232 76 210 89 180 106 154 125 131 146 113 151 99 155',
  'M234 77 224 107 214 136 210 170 224 189 243 224',
  'M237 78 258 111 273 146 283 203 301 223 321 247',
];

const SEAMS = [
  'M87 57 119 67 143 85 163 91M94 88 116 96 139 116',
  'M201 111 188 135 180 160M219 97 204 117 202 138',
  'M240 111 246 137 259 165 266 192M226 147 240 163 250 191',
  'M280 113 302 127 321 132M294 149 311 164 326 193 346 215',
];

const TEARS = [
  { stage: 1, d: 'M137 94h13v9h-6v13h-10v-9h-7V96h10Z' },
  { stage: 1, d: 'M306 153h9v10h9v12h-9v-6h-11v-9h-6v-7Z' },
  { stage: 2, d: 'M151 178v-23h10v-14h11v-16h11v12h-5v19h-9v14h-5v26Z' },
  { stage: 2, d: 'M242 238v-34h-8v-19h-8v-14h11v9h10v15h11v13h9v31Z' },
  { stage: 3, d: 'M79 167v-36h12v-18h10V95h12v12h8v21h-9v16h-8v23Z' },
  { stage: 3, d: 'M321 258v-37h-11v-18h-9v-19h-8v-15h12v10h12v17h12v17h12v45Z' },
  { stage: 3, d: 'M183 114h10v11h9v15h-13v-9h-9v-10h3Z' },
];

const CRACKS = [
  { stage: 1, d: 'M145 83v12h-8v10h7v14h-8v12m8-21h12v9h7' },
  { stage: 1, d: 'M298 139h10v14h8v13h-7v13h9v12' },
  { stage: 2, d: 'M177 116v13h-8v14h-11v18h-8m19-18h13v10h9' },
  { stage: 2, d: 'M228 161h10v17h8v16h11v16' },
  { stage: 3, d: 'M99 90v13H88v15h-9m234 45v17h12v18h13v19' },
];

const CHIPS = [
  { stage: 1, x: 146, y: 121, turn: 18, size: 5 },
  { stage: 2, x: 156, y: 206, turn: -16, size: 8 },
  { stage: 2, x: 255, y: 249, turn: 26, size: 6 },
  { stage: 3, x: 86, y: 178, turn: -24, size: 8 },
  { stage: 3, x: 327, y: 271, turn: 12, size: 9 },
  { stage: 4, x: 194, y: 195, turn: -18, size: 12 },
  { stage: 4, x: 256, y: 221, turn: 32, size: 10 },
  { stage: 4, x: 119, y: 158, turn: 14, size: 10 },
];

/** Decorative only: the parent owns targeting, accessible names and HP controls. */
export function DragonWingArt({ side, hp, maxHp = 48, focused = false, selected = false, closeup = false, reduced = false }: DragonWingArtProps) {
  const instance = useId();
  const prefix = `dw-${instance.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  // Invalid totals fall back to the normal wing total; invalid HP fails closed.
  const total = Number.isFinite(maxHp) && maxHp > 0 ? maxHp : 48;
  const ratio = Number.isFinite(hp) ? Math.min(1, Math.max(0, hp / total)) : 0;
  const damage = ratio === 0 ? 4 : ratio <= 0.25 ? 3 : ratio <= 0.5 ? 2 : ratio <= 0.75 ? 1 : 0;
  const stage = ['intact', 'cracked', 'torn', 'ragged', 'broken'][damage];
  const ids = {
    membrane: `${prefix}-membrane`, bone: `${prefix}-bone`, edge: `${prefix}-edge`,
    scales: `${prefix}-scales`, tears: `${prefix}-tears`, frame: `${prefix}-frame`,
  };
  const classes = ['dw-art', `dw-side-${side}`, `dw-${stage}`, focused && 'dw-focused', selected && 'dw-selected', closeup && 'dw-closeup', reduced && 'dw-reduced'].filter(Boolean).join(' ');

  return <svg
    className={classes}
    viewBox={closeup ? `${side === 0 ? 58 : 38} 58 344 228` : '0 0 440 300'}
    preserveAspectRatio="xMidYMid meet"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
    data-dw-side={side}
    data-dw-damage={stage}
    data-dw-hp-ratio={ratio}
  >
    <defs>
      <linearGradient id={ids.membrane} x1="100" y1="38" x2="272" y2="236" gradientUnits="userSpaceOnUse">
        <stop stopColor="#675275" />
        <stop offset="0.38" stopColor="#372b48" />
        <stop offset="0.76" stopColor="#201d2b" />
        <stop offset="1" stopColor="#44334f" />
      </linearGradient>
      <linearGradient id={ids.bone} x1="161" y1="45" x2="185" y2="89" gradientUnits="userSpaceOnUse" spreadMethod="reflect">
        <stop stopColor="#85808e" />
        <stop offset="0.22" stopColor="#54535f" />
        <stop offset="0.62" stopColor="#343540" />
        <stop offset="1" stopColor="#1a1c27" />
      </linearGradient>
      <linearGradient id={ids.edge} x1="224" y1="71" x2="282" y2="235" gradientUnits="userSpaceOnUse">
        <stop stopColor="#d3b1ed" />
        <stop offset="0.45" stopColor="#91769e" />
        <stop offset="1" stopColor="#675a7d" />
      </linearGradient>
      <pattern id={ids.scales} width="32" height="28" patternUnits="userSpaceOnUse">
        <path d="M2 3h11v5H2Zm17 13h9v5h-9Z" fill="#bba4c8" opacity="0.11" />
        <path d="M5 9h10v3H5Zm16 13h9v3h-9Z" fill="#080c18" opacity="0.28" />
      </pattern>
      <mask id={ids.tears} x="0" y="0" width="440" height="300" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" style={{ maskType: 'luminance' }}>
        <rect width="440" height="300" fill="white" />
        {TEARS.filter(tear => damage >= tear.stage).map((tear, index) => <path key={index} d={tear.d} fill="black" />)}
        {damage === 4 && <path d="M0 0h190v67h29v25h-18v27h-18v29h-23v28h-23v27H0Zm174 300v-120h15v-27h14v-26h16v-20h17v21h10v30h13v32h17v34h18v76Zm115 0v-80h9v-32h13v-31h13v-20h13v31h14v25h19v25h21v82Z" fill="black" />}
      </mask>
      <mask id={ids.frame} x="0" y="0" width="440" height="300" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" style={{ maskType: 'luminance' }}>
        <rect width="440" height="300" fill="white" />
        {damage === 4 && <path d="M110 137h33v34h-33Zm86 13h33v31h-33Zm68 27h33v35h-33ZM166 42h27v27h-27Z" fill="black" />}
      </mask>
    </defs>

    <g className="dw-orientation" transform={side === 1 ? 'translate(440 0) scale(-1 1)' : undefined}>
      <g className="dw-hover">
        <g className="dw-sails" mask={`url(#${ids.tears})`}>
          <path className="dw-aura" d={OUTLINE} />
          <path className="dw-thickness" d={OUTLINE} transform="translate(0 9)" fill="#101320" stroke="#080c16" strokeWidth="6" strokeLinejoin="miter" />
          <path d={OUTLINE} fill={`url(#${ids.membrane})`} stroke="#121422" strokeWidth="5" />
          {SAILS.map((d, index) => <path key={d} className={`dw-sail dw-sail-${index}`} d={d} fill={`url(#${ids.membrane})`} stroke="#74627e" strokeOpacity="0.45" strokeWidth="1.5" />)}
          {FACETS.map((d, index) => <path key={d} d={d} fill={index % 2 === 0 ? '#b9a0c9' : '#100e20'} opacity={index % 2 === 0 ? 0.11 : 0.26} />)}
          <path d={OUTLINE} fill={`url(#${ids.scales})`} />
          <g className="dw-seams" fill="none" stroke="#a28aad" strokeWidth="1.5" opacity="0.28">
            {SEAMS.map(d => <path key={d} d={d} />)}
          </g>
          <path className="dw-trailing-bevel" d="m89 151 12 8 15-11 14 1 16 15 14 21 15 6 14-14 15-2 15 19 17 30 13 9 17-20 14-5 15 17 16 23 15 5 14-17 12-3 19 11 24 1" fill="none" stroke={`url(#${ids.edge})`} strokeWidth="3" opacity="0.7" />
          {CRACKS.filter(crack => damage >= crack.stage).map((crack, index) => <g className="dw-crack" key={index} fill="none" strokeLinejoin="miter">
            <path d={crack.d} stroke="#0b0b18" strokeWidth="7" />
            <path d={crack.d} stroke="#c3a1d7" strokeWidth="2" transform="translate(-1 -1)" />
          </g>)}
        </g>

        <g className="dw-frame" mask={`url(#${ids.frame})`} fill="none" strokeLinejoin="miter" strokeLinecap="square">
          {FINGERS.map((d, index) => <g key={d} className={`dw-finger dw-finger-${index}`}>
            <path d={d} transform="translate(0 6)" stroke="#090e1a" strokeWidth={index === 0 ? 22 : 13} />
            <path d={d} stroke="#161b28" strokeWidth={index === 0 ? 22 : 13} />
            <path d={d} stroke={`url(#${ids.bone})`} strokeWidth={index === 0 ? 15 : 8} />
            <path d={d} transform="translate(0 -3)" stroke="#aaa0b8" strokeOpacity="0.65" strokeWidth={index === 0 ? 2.5 : 1.5} />
          </g>)}
          <path className="dw-claw" d="m224 64 3-21 10-12 8 1-4 12 2 24Z" fill="#aaa3b8" stroke="#1a1d2c" strokeWidth="4" />
          <path d="m227 47 10-13-3 19-5 10" stroke="#e7d9ed" strokeWidth="2" />
          <path className="dw-joint" d="m219 63 16-4 14 12-4 16-17 5-14-14Z" fill={`url(#${ids.bone})`} stroke="#111625" strokeWidth="4" />
          <path d="m220 66 13-3 12 10-13-1-13 5Z" fill="#9c8ca8" stroke="none" />
          <path d="m330 111 13 5 12 23-8 11-15-11-10-18Z" fill={`url(#${ids.bone})`} stroke="#131826" strokeWidth="4" />
          <path d="m329 114 10 4 10 19" stroke="#b5a3bf" strokeWidth="2" />
          <path className="dw-root" d="m370 198 17-7 22 30 4 19-15 13-20-12-15-27Z" fill={`url(#${ids.bone})`} stroke="#101522" strokeWidth="5" />
          <path d="m370 202 14-5 16 25-14 4-12-10Z" fill="#6a6578" stroke="none" />
          <path d="m384 231 17-5 6 12-12 9-12-8Z" fill="#272a3c" stroke="none" />
        </g>

        {damage === 4 && <g className="dw-fractures" fill="#ae90c1" stroke="#171827" strokeWidth="2">
          <path d="m167 46 8 2-4 7 7 6-9 2-6-9Z" />
          <path d="m208 145 9 2 3 8-6 7-7-5 5-5Z" />
          <path d="m273 172 8 2 6 8-7 5-8-6 5-4Z" />
        </g>}

        <g className="dw-debris">
          {CHIPS.filter(chip => damage >= chip.stage).map((chip, index) => <g key={index} className={`dw-chip dw-chip-${index}`} transform={`translate(${chip.x} ${chip.y}) rotate(${chip.turn})`}>
            <g className="dw-chip-drift">
              <path d={`M0 0h${chip.size}v${chip.size / 2}h3v${chip.size}H3v-3H0Z`} fill="#0d1020" transform="translate(1 3)" />
              <path d={`M0 0h${chip.size}v${chip.size / 2}h3v${chip.size}H3v-3H0Z`} fill="#554060" stroke="#9d81b1" strokeWidth="1" />
              <path d={`M1 1h${chip.size - 2}v3H1Z`} fill="#c6a4d8" opacity="0.7" />
            </g>
          </g>)}
        </g>
      </g>
    </g>
  </svg>;
}
