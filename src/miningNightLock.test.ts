import { describe, expect, it } from "vitest";
import {
  isMiningNightHours,
  isMiningNightLocked,
  miningNightLockNightKey,
  normalizeMiningNightLockEnabled,
  shouldAutoShowMiningNightEnd,
} from "./miningNightLock";

function at(hours: number, minutes: number, day = 29): Date {
  return new Date(2026, 7, day, hours, minutes, 0, 0);
}

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
  it("is open just before 21:00", () => {
    expect(isMiningNightHours(at(20, 59))).toBe(false);
  });

  it("locks from 21:00 inclusive", () => {
    expect(isMiningNightHours(at(21, 0))).toBe(true);
    expect(isMiningNightHours(at(23, 0))).toBe(true);
  });

  it("stays locked after midnight until 5:00", () => {
    expect(isMiningNightHours(at(0, 0, 30))).toBe(true);
    expect(isMiningNightHours(at(4, 59, 30))).toBe(true);
  });

  it("unlocks at 5:00 inclusive", () => {
    expect(isMiningNightHours(at(5, 0, 30))).toBe(false);
  });
});

describe("isMiningNightLocked", () => {
  it("never locks when the setting is OFF", () => {
    expect(isMiningNightLocked({ enabled: false, now: at(22, 0) })).toBe(false);
    expect(isMiningNightLocked({ enabled: false, now: at(3, 0, 30) })).toBe(false);
  });

  it("follows night hours when ON", () => {
    expect(isMiningNightLocked({ enabled: true, now: at(20, 59) })).toBe(false);
    expect(isMiningNightLocked({ enabled: true, now: at(21, 0) })).toBe(true);
    expect(isMiningNightLocked({ enabled: true, now: at(5, 0, 30) })).toBe(false);
  });
});

describe("miningNightLockNightKey", () => {
  it("uses the evening date across midnight", () => {
    expect(miningNightLockNightKey(at(21, 0))).toBe("2026-08-29");
    expect(miningNightLockNightKey(at(2, 0, 30))).toBe("2026-08-29");
    expect(miningNightLockNightKey(at(5, 0, 30))).toBe("2026-08-30");
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
      now: at(20, 59),
      shownNightKey: null,
    }).show).toBe(false);
    expect(shouldAutoShowMiningNightEnd({
      enabled: false,
      now: at(22, 0),
      shownNightKey: null,
    }).show).toBe(false);
  });
});
