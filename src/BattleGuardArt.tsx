import './battleGuard.css';

/** Crossed, block-shaped forearms: no equipment is invented for an empty slot. */
export function BattleGuardArt({ shield = false, large = false }: { shield?: boolean; large?: boolean }) {
  return <span className={`${large ? 'bs-guard-pose' : 'bp-icon'} ${shield ? 'bs-equipped-guard' : 'bs-bare-guard'}`} aria-hidden="true">
    {shield ? <img className="bs-guard-texture" src="/mining/Shield.webp" alt="" /> : <svg className="bs-guard-arms" viewBox="0 0 180 160" fill="none">
      <path fill="#173b4a" stroke="#80c2cc" strokeWidth="2" d="m5 115 32-33 59 48-28 28Z" />
      <path fill="#ad795e" stroke="#e6b998" strokeWidth="2" d="m37 82 47-46 29 29-46 47Z" />
      <path fill="#e0ac84" d="m81 33 18-18 32 32-18 18Z" /><path fill="#f7c8a0" d="m81 33 18-18 32 32-8 8-24-24-10 10Z" />
      <path fill="#225567" stroke="#a7d5d9" strokeWidth="2" d="m175 115-32-33-59 48 28 28Z" />
      <path fill="#c58d68" stroke="#f4c49b" strokeWidth="2" d="m143 82-47-46-29 29 46 47Z" />
      <path fill="#e7b28a" d="m99 33-18-18-32 32 18 18Z" /><path stroke="#ffe1b8" strokeWidth="3" d="m55 47 26-26 12 12M106 67l29 28" />
      <path stroke="#0c273d" strokeWidth="6" d="m18 119 43 32m101-32-43 32" />
    </svg>}
  </span>;
}
