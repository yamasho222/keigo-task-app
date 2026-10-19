import { FORECAST_LABELS, FORECAST_MARKS, type ForecastSignal } from './battleForecastRules';
import './battleForecast.css';

export function BattleForecast({ signal, detail }: { signal: ForecastSignal; detail?: string }) {
  return <span className={`bf-mark bf-${signal}`} role="img" aria-label={`${FORECAST_LABELS[signal]}${detail ? `。${detail}` : ''}`} data-forecast={signal}>
    <b aria-hidden="true">{FORECAST_MARKS[signal]}</b>
  </span>;
}
