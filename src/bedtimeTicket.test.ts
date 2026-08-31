import { describe, expect, it } from "vitest";
import {
  canDeclareBedtime,
  isBedtimeTicketClaimable,
  isBeforeBedtimeDeadline,
} from "./bedtimeTicket";
import { emptyMiningState } from "./miningTypes";

function at(hours: number, minutes: number, day = 29): Date {
  return new Date(2026, 7, day, hours, minutes, 0, 0);
}

describe("isBeforeBedtimeDeadline", () => {
  it("allows declare through 21:30 inclusive", () => {
    expect(isBeforeBedtimeDeadline(at(21, 0))).toBe(true);
    expect(isBeforeBedtimeDeadline(at(21, 30))).toBe(true);
  });

  it("misses after 21:30", () => {
    expect(isBeforeBedtimeDeadline(at(21, 31))).toBe(false);
  });
});

describe("canDeclareBedtime", () => {
  const nightDate = "2026-08-29";
  const base = {
    nightDate,
    state: emptyMiningState(),
    eveningAllResolved: true,
  };

  it("is allowed at 21:30 when evening is done", () => {
    expect(canDeclareBedtime({ ...base, now: at(21, 30) })).toBe(true);
  });

  it("is blocked at 21:31", () => {
    expect(canDeclareBedtime({ ...base, now: at(21, 31) })).toBe(false);
  });
});

describe("isBedtimeTicketClaimable", () => {
  it("grants from 6:30 the next morning", () => {
    expect(isBedtimeTicketClaimable("2026-08-29", at(6, 29, 30))).toBe(false);
    expect(isBedtimeTicketClaimable("2026-08-29", at(6, 30, 30))).toBe(true);
  });
});
