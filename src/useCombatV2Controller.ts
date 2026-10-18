import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MiningPatch } from "./miningCommit";
import type { MiningState } from "./miningTypes";
import { transitionCombatV2 } from "./combatV2Session";
import type { CombatAction, CombatV2Command, CombatV2Location } from "./combatV2Types";

export function useCombatV2Controller(mining: MiningState, location: CombatV2Location, dateKey: string, onChange: (patch: MiningPatch) => void) {
  const latest = useRef(mining);
  useLayoutEffect(() => { latest.current = mining; }, [mining]);
  const seq = useRef(0);
  const [prefix] = useState(() => `combat-${crypto.randomUUID()}`);
  const [now, setNow] = useState(Date.now);
  const session = mining.combatV2?.sessions[location];
  const send = useCallback((kind: CombatV2Command["kind"], action?: CombatAction) => {
    const current = latest.current.combatV2?.sessions[location];
    const base = { location, id: `${prefix}-${++seq.current}`, sessionId: current?.id, expectedRevision: current?.revision ?? 0, dateKey, now: Date.now() };
    const command = (kind === "act" ? { ...base, kind, action: action! } : { ...base, kind }) as CombatV2Command;
    // onChange applies the command to the latest complete state, not a stale rendered snapshot.
    onChange((state) => transitionCombatV2(state, command).state);
  }, [location, dateKey, onChange, prefix]);

  useEffect(() => {
    if (!session) send("enter");
    else if (session.dateKey !== dateKey || (session.pendingSpecial && Date.now() >= session.pendingSpecial.deadline)) send("sync");
  }, [session, dateKey, send]);

  const specialDeadline = session?.pendingSpecial?.deadline;
  useEffect(() => {
    if (specialDeadline === undefined) return;
    const tick = () => { setNow(Date.now()); send("sync"); };
    const timer = window.setInterval(tick, 100);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [specialDeadline, send]);

  return { session, send, now };
}
