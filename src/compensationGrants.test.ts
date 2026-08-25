import { describe, expect, it } from "vitest";
import {
  BRAINROD_COMPENSATION_CLAIM_KEY,
  BRAINROD_COMPENSATION_STICKER_ID,
  isBrainrodCompensationAvailable,
  isKeigoChildName,
} from "./compensationGrants";

describe("brainrod compensation", () => {
  it("matches only けいご", () => {
    expect(isKeigoChildName("けいご")).toBe(true);
    expect(isKeigoChildName(" けいご ")).toBe(true);
    expect(isKeigoChildName("けんご")).toBe(false);
    expect(isKeigoChildName(undefined)).toBe(false);
  });

  it("is available only when keigo has not claimed and does not own the sticker", () => {
    const base = { childName: "けいご", stickerAlbum: [] as string[], compensationClaims: {} as Record<string, boolean> };
    expect(isBrainrodCompensationAvailable(base)).toBe(true);
    expect(isBrainrodCompensationAvailable({ ...base, childName: "けんご" })).toBe(false);
    expect(isBrainrodCompensationAvailable({
      ...base,
      stickerAlbum: [BRAINROD_COMPENSATION_STICKER_ID],
    })).toBe(false);
    expect(isBrainrodCompensationAvailable({
      ...base,
      compensationClaims: { [BRAINROD_COMPENSATION_CLAIM_KEY]: true },
    })).toBe(false);
  });
});
