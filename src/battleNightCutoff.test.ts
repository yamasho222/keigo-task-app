import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdventureBattlePanel } from './AdventureBattlePanel';
import { useAdventureController, type AdventureRequest } from './useAdventureController';
import * as session from './adventureSession';
import type { AdventureLocation } from './adventureState';
import type { MiningPatch } from './miningCommit';
import { emptyMiningState, type MiningState } from './miningTypes';

// Capture real hook effects for a small Node-only lifecycle harness; no browser is needed.
const effects = vi.hoisted(() => ({
  passive: [] as Array<() => void | (() => void)>,
  layout: [] as Array<() => void | (() => void)>,
}));
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useEffect: (effect: () => void | (() => void)) => { effects.passive.push(effect); },
  useLayoutEffect: (effect: () => void | (() => void)) => { effects.layout.push(effect); },
}));

const DAY = '2026-10-19';
const locations = ['fortress', 'warped_forest', 'the_end'] as const;
const cleanups: Array<() => void> = [];
const at = (hour: number, minute: number, second = 0, ms = 0) => new Date(2026, 9, 19, hour, minute, second, ms);

function mountEffects() {
  for (const effect of [...effects.layout, ...effects.passive]) {
    const cleanup = effect();
    if (cleanup) cleanups.push(cleanup);
  }
}
function unmount() { cleanups.splice(0).reverse().forEach(cleanup => cleanup()); }
function step(state: MiningState, location: AdventureLocation, request: AdventureRequest) {
  const result = session.transitionAdventure(state, { ...request, location, day: DAY, revision: state.adventure?.revision ?? -1 } as session.AdventureCommand);
  expect(result.error).toBeUndefined();
  return result.state;
}
function savedBattle(location: AdventureLocation, pending = false) {
  const base = emptyMiningState();
  base.unlockedGachas = [...locations];
  base.tickets = 5;
  base.materials = { bread: 4, blaze_rod: 2, ender_pearl: 3, water: 1 };
  base.crafted.sword_diamond = true;
  let state = step(base, location, { kind: 'enter' });
  state = step(state, location, { kind: 'lesson' });
  state.adventure!.hands = 2;
  state.adventure!.gauge = 3;
  if (pending) state = step(state, location, {
    kind: location === 'fortress' ? 'blaze' : location === 'warped_forest' ? 'enderman' : 'dragon',
    action: { kind: 'beginSkill' },
  });
  return state;
}
function controller(initial: MiningState, nightLockEnabled?: boolean, beforePatch?: () => void) {
  let mining = initial;
  let api: ReturnType<typeof useAdventureController> | undefined;
  const onChange = vi.fn((patch: MiningPatch) => { beforePatch?.(); mining = patch(mining); });
  function Capture() {
    api = useAdventureController(mining, 'fortress', DAY, undefined, onChange, nightLockEnabled);
    return null;
  }
  renderToStaticMarkup(createElement(Capture));
  return { api: api!, onChange, mining: () => mining };
}
function panel(initial: MiningState, location: AdventureLocation, nightLockEnabled?: boolean, fallback = false) {
  let mining = initial;
  let open = true;
  const onChange = vi.fn((patch: MiningPatch) => { mining = patch(mining); });
  const onClose = vi.fn(() => { open = false; });
  const onNightEnd = vi.fn(() => { open = false; });
  function Capture() {
    const element = AdventureBattlePanel({
      mining, location, dateKey: DAY, onChange, onClose,
      nightLockEnabled, onNightEnd: fallback ? undefined : onNightEnd,
    });
    // Exercise the panel/controller lifecycle without mounting unrelated battle animations.
    return element.type === 'dialog' ? createElement('dialog') : element;
  }
  const html = renderToStaticMarkup(createElement(Capture));
  return { html, onChange, onClose, onNightEnd, mining: () => mining, open: () => open };
}

beforeEach(() => {
  effects.passive.length = effects.layout.length = 0;
  vi.useFakeTimers();
  vi.setSystemTime(at(20, 29, 59, 999));
  vi.stubGlobal('window', Object.assign(new EventTarget(), {
    setTimeout, clearTimeout, setInterval, clearInterval,
  }));
  vi.stubGlobal('document', new EventTarget());
});
afterEach(() => {
  unmount();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('battle night dispatch cutoff', () => {
  it('checks the actual clock before every command without invoking the updater or transition', () => {
    const state = savedBattle('fortress'), saved = structuredClone(state);
    const ui = controller(state, true);
    const transition = vi.spyOn(session, 'transitionAdventure');
    vi.setSystemTime(at(20, 30));
    const requests: AdventureRequest[] = [
      { kind: 'enter' }, { kind: 'retry' }, { kind: 'next' }, { kind: 'lesson' },
      { kind: 'blaze', action: { kind: 'guard' } },
      { kind: 'enderman', action: { kind: 'guard' } },
      { kind: 'dragon', action: { kind: 'pause' } },
      { kind: 'blaze', action: { kind: 'releaseSkill', token: 'saved', score: 100 } },
      { kind: 'magic', category: 'attack', value: 'power' },
      { kind: 'upgrade', category: 'defense' },
    ];
    for (const request of requests) {
      const result = ui.api.send(request);
      expect(result.state).toBe(state);
      expect(result.error).toBeTruthy();
    }
    expect(ui.onChange).not.toHaveBeenCalled();
    expect(transition).not.toHaveBeenCalled();
    expect(state).toEqual(saved);
  });

  it('rejects automatic entry if the clock crosses the cutoff after rendering', () => {
    const state = emptyMiningState();
    state.unlockedGachas = ['fortress'];
    const ui = controller(state, true);
    const transition = vi.spyOn(session, 'transitionAdventure');
    vi.setSystemTime(at(20, 30));
    mountEffects();
    expect(ui.onChange).not.toHaveBeenCalled();
    expect(transition).not.toHaveBeenCalled();
    expect(ui.mining()).toBe(state);
    expect(state.adventure).toBeUndefined();
  });

  it('also guards a resource updater delayed across 20:30', () => {
    const state = savedBattle('fortress');
    const ui = controller(state, true, () => vi.setSystemTime(at(20, 30)));
    const transition = vi.spyOn(session, 'transitionAdventure');
    const result = ui.api.send({ kind: 'blaze', action: { kind: 'guard' } });
    expect(result.error).toBeTruthy();
    expect(result.state).toBe(state);
    expect(transition).not.toHaveBeenCalled();
    expect(ui.mining()).toBe(state);
  });

  it.each([[20, 29, 59, 999, false], [20, 30, 0, 0, true], [0, 0, 0, 0, true], [6, 29, 59, 999, true], [6, 30, 0, 0, false]] as const)(
    'dispatch at %i:%i:%i.%i is locked=%s', (h, m, s, ms, locked) => {
      const ui = controller(savedBattle('fortress'), true);
      vi.setSystemTime(at(h, m, s, ms));
      const result = ui.api.send({ kind: 'enter' });
      expect(!!result.error).toBe(locked);
      expect(ui.onChange).toHaveBeenCalledTimes(locked ? 0 : 1);
    },
  );

  it('keeps the default disabled for DEV callers even at night', () => {
    const ui = controller(savedBattle('fortress'));
    vi.setSystemTime(at(21, 0));
    expect(ui.api.send({ kind: 'enter' }).error).toBeUndefined();
    expect(ui.onChange).toHaveBeenCalledOnce();
  });
});

describe('free battle night exit', () => {
  for (const location of locations) it.each([false, true])(`${location}: preserves the entire save with pending skill=%s`, pending => {
    const state = savedBattle(location, pending), saved = structuredClone(state);
    const ui = panel(state, location, true);
    mountEffects();
    ui.onChange.mockClear(); // Ignore the normal, pre-cutoff automatic entry.
    const beforeCutoff = ui.mining(), beforeSaved = structuredClone(beforeCutoff);
    expect(ui.open()).toBe(true);
    vi.advanceTimersByTime(1);
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(60_000);
    expect(ui.onNightEnd).toHaveBeenCalledOnce();
    expect(ui.onClose).not.toHaveBeenCalled();
    expect(ui.open()).toBe(false);
    expect(ui.onChange).not.toHaveBeenCalled();
    expect(ui.mining()).toBe(beforeCutoff);
    expect(ui.mining()).toEqual(beforeSaved);
    expect(state).toEqual(saved);
    expect(ui.mining().adventure!.hands).toBe(2);
    expect(ui.mining().tickets).toBe(5);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['focus', 'visibilitychange'] as const)('catches a suspended timer on %s and falls back to onClose', event => {
    const ui = panel(savedBattle('fortress', true), 'fortress', true, true);
    mountEffects();
    vi.setSystemTime(at(20, 31));
    (event === 'focus' ? window : document).dispatchEvent(new Event(event));
    expect(ui.onClose).toHaveBeenCalledOnce();
    expect(ui.onNightEnd).not.toHaveBeenCalled();
    expect(ui.onChange).not.toHaveBeenCalled();
  });

  it('blocks a directly opened locked panel, including its automatic entry', () => {
    vi.setSystemTime(at(20, 30));
    const state = emptyMiningState(), ui = panel(state, 'fortress', true);
    expect(ui.html).toContain('きょうの たたかいは おしまい');
    expect(ui.html).not.toContain('<dialog');
    mountEffects();
    expect(ui.onNightEnd).toHaveBeenCalledOnce();
    expect(ui.onChange).not.toHaveBeenCalled();
    expect(ui.mining()).toBe(state);
  });

  it('cleans up timers, listeners and the callback when unmounted before cutoff', () => {
    const removeWindow = vi.spyOn(window, 'removeEventListener');
    const removeDocument = vi.spyOn(document, 'removeEventListener');
    const ui = panel(savedBattle('fortress', true), 'fortress', true);
    mountEffects();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(removeWindow).toHaveBeenCalledWith('focus', expect.any(Function));
    expect(removeDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    vi.setSystemTime(at(20, 30));
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(60_000);
    expect(ui.onNightEnd).not.toHaveBeenCalled();
    expect(ui.onChange).not.toHaveBeenCalled();
  });

  it('leaves DEV panels open by default at the cutoff', () => {
    const ui = panel(savedBattle('fortress', true), 'fortress');
    mountEffects();
    vi.advanceTimersByTime(1);
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(ui.html).toContain('<dialog');
    expect(ui.onNightEnd).not.toHaveBeenCalled();
    expect(ui.onClose).not.toHaveBeenCalled();
  });
});
