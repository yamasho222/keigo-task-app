import { MiningItemIcon } from "./MiningItemIcon";
import type { JourneyAction, JourneyGuide } from "./endJourneyGuide";
import { END_SEARCH_STOPS } from "./endJourneyProgress";

export function EndJourneyGuide({ guide, onAction }: { guide: JourneyGuide; onAction: (action: JourneyAction) => void }) {
  const content = <>
    <MiningItemIcon material={guide.icon} size={40} alt="" />
    <span className="end-journey-copy">{guide.label}
      {guide.hunt !== undefined && <span className="end-journey-marks" role="img" aria-label={`探索 ${Math.min(END_SEARCH_STOPS, guide.hunt)}/${END_SEARCH_STOPS}`}>
        {Array.from({ length: END_SEARCH_STOPS }, (_, i) => <span key={i} className={i < guide.hunt! ? "is-done" : ""}>{i < guide.hunt! ? "◆" : "◇"}</span>)}
      </span>}
      {guide.rods !== undefined && <span className="end-journey-marks" role="img" aria-label={`ロッド あつめた数 ${guide.rods}/4`}>
        {[0, 1, 2, 3].map((i) => <span key={i} className={i < guide.rods! ? "is-done" : ""}>●</span>)}
      </span>}
    </span>
    {guide.action && <span aria-hidden>→</span>}
  </>;
  const className = `end-journey-guide${guide.mystery ? " is-mystery" : ""}`;
  return guide.action ? <button type="button" className={className} onClick={() => onAction(guide.action!)}>{content}</button>
    : <div className={className} role="status">{content}</div>;
}

export function EndArrival({ onFight, onBack }: { onFight: () => void; onBack: () => void }) {
  return <div className="end-arrival" role="dialog" aria-modal="true" aria-labelledby="end-arrival-title" onKeyDown={(event) => {
    if (event.key === "Escape") { event.preventDefault(); onBack(); }
    if (event.key !== "Tab") return;
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("button");
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <div className="end-arrival-card">
      <div className="end-arrival-land" aria-hidden><img src="/stickers/mc-ender-dragon.png" alt="" /></div>
      <h2 id="end-arrival-title">ジ・エンドについた！</h2>
      <p>たたかう準備はできた？</p>
      <button type="button" autoFocus onClick={onFight}>⚔️ たたかう</button>
      <button type="button" className="is-back" onClick={onBack}>いまはもどる</button>
    </div>
  </div>;
}
