import { describe, expect, it } from "vitest";
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BattleNightEndOverlay, MiningNightEndOverlay } from './MiningNightEndOverlay';
import {
  isMiningNightHours,
  isBattleNightLocked,
  isMiningNightLocked,
  miningNightLockNightKey,
  normalizeMiningNightLockEnabled,
  shouldAutoShowMiningNightEnd,
} from "./miningNightLock";

function at(hours: number, minutes: number, day = 29): Date {
  return new Date(2026, 7, day, hours, minutes, 0, 0);
}

describe('separate battle and general play cutoffs', () => {
  it.each([[20, 29, false, false], [20, 30, true, false], [20, 59, true, false], [21, 0, true, true], [0, 0, true, true], [6, 29, true, true], [6, 30, false, false]])('%i:%i has battle lock %s and general lock %s', (hours, minutes, battle, general) => {
    const now = at(hours as number, minutes as number);
    expect(isBattleNightLocked({ enabled: true, now })).toBe(battle);
    expect(isMiningNightLocked({ enabled: true, now })).toBe(general);
    expect(isBattleNightLocked({ enabled: false, now })).toBe(false);
    expect(isMiningNightLocked({ enabled: false, now })).toBe(false);
  });
  it('does not announce the whole day ending at the battle-only cutoff', () => {
    expect(shouldAutoShowMiningNightEnd({ enabled: true, now: at(20, 30), shownNightKey: null }).show).toBe(false);
    const battle = renderToStaticMarkup(createElement(BattleNightEndOverlay, { onDismiss() {} }));
    const all = renderToStaticMarkup(createElement(MiningNightEndOverlay, { onDismiss() {} }));
    expect(battle).toContain('バトルは おしまい'); expect(battle).toContain('21:00'); expect(battle).not.toContain('今日はおしまい');
    expect(all).toContain('今日はおしまい'); expect(all).toContain('朝6:30');
  });
  it('honors exact boundaries down to the millisecond', () => {
    expect(isBattleNightLocked({ enabled: true, now: new Date(2026, 7, 29, 20, 29, 59, 999) })).toBe(false);
    expect(isBattleNightLocked({ enabled: true, now: new Date(2026, 7, 29, 20, 30, 0, 0) })).toBe(true);
  });
});

describe("normalizeMiningNightLockEnabled", () => {
  it("treats missing and true as ON", () => {
    expect(normalizeMiningNightLockEnabled(undefined)).toBe(true);
    expect(normalizeMiningNightLockEnabled(true)).toBe(true);
  });

  it("treats false as OFF", () => {
    expect(normalizeMiningNightLockEnabled(false)).toBe(false);
  });
});

describe("isMiningNightHours", () => {
  it("is open until 20:59:59.999", () => {
    expect(isMiningNightHours(at(20, 29))).toBe(false);
    expect(isMiningNightHours(new Date(2026, 7, 29, 20, 29, 59, 999))).toBe(false);
    expect(isMiningNightHours(new Date(2026, 7, 29, 20, 59, 59, 999))).toBe(false);
  });

  it("locks from 21:00 inclusive", () => {
    expect(isMiningNightHours(at(20, 30))).toBe(false);
    expect(isMiningNightHours(at(20, 59))).toBe(false);
    expect(isMiningNightHours(at(21, 0))).toBe(true);
    expect(isMiningNightHours(at(23, 0))).toBe(true);
  });

  it("stays locked after midnight until 6:30", () => {
    expect(isMiningNightHours(at(0, 0, 30))).toBe(true);
    expect(isMiningNightHours(at(5, 0, 30))).toBe(true);
    expect(isMiningNightHours(at(6, 29, 30))).toBe(true);
  });

  it("unlocks at 6:30 inclusive", () => {
    expect(isMiningNightHours(at(6, 30, 30))).toBe(false);
  });
});

describe("isMiningNightLocked", () => {
  it("never locks when the setting is OFF", () => {
    expect(isMiningNightLocked({ enabled: false, now: at(22, 0) })).toBe(false);
    expect(isMiningNightLocked({ enabled: false, now: at(3, 0, 30) })).toBe(false);
  });

  it("follows night hours when ON", () => {
    expect(isMiningNightLocked({ enabled: true, now: at(20, 29) })).toBe(false);
    expect(isMiningNightLocked({ enabled: true, now: at(20, 30) })).toBe(false);
    expect(isMiningNightLocked({ enabled: true, now: at(21, 0) })).toBe(true);
    expect(isMiningNightLocked({ enabled: true, now: at(6, 30, 30) })).toBe(false);
  });
});

describe("miningNightLockNightKey", () => {
  it("uses the evening date across midnight", () => {
    expect(miningNightLockNightKey(at(20, 30))).toBe("2026-08-29");
    expect(miningNightLockNightKey(at(2, 0, 30))).toBe("2026-08-29");
    expect(miningNightLockNightKey(at(6, 29, 30))).toBe("2026-08-29");
    expect(miningNightLockNightKey(at(6, 30, 30))).toBe("2026-08-30");
  });
});

describe("shouldAutoShowMiningNightEnd", () => {
  it("shows once per night while locked", () => {
    const now = at(21, 0);
    expect(shouldAutoShowMiningNightEnd({
      enabled: true,
      now,
      shownNightKey: null,
    })).toEqual({ show: true, nightKey: "2026-08-29" });
    expect(shouldAutoShowMiningNightEnd({
      enabled: true,
      now,
      shownNightKey: "2026-08-29",
    })).toEqual({ show: false, nightKey: "2026-08-29" });
  });

  it("does not auto-show when unlocked or setting is OFF", () => {
    expect(shouldAutoShowMiningNightEnd({
      enabled: true,
      now: at(20, 29),
      shownNightKey: null,
    }).show).toBe(false);
    expect(shouldAutoShowMiningNightEnd({
      enabled: false,
      now: at(22, 0),
      shownNightKey: null,
    }).show).toBe(false);
  });
});
