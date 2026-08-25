/** けいご向けの1回限りのごほうび補正（名前一致のみ。子IDは使わない） */

export const BRAINROD_COMPENSATION_CLAIM_KEY = "lr-brainrod-2026-08";
export const BRAINROD_COMPENSATION_STICKER_ID = "lr-brainrod";
export const BRAINROD_COMPENSATION_CHILD_NAME = "けいご";

export function isKeigoChildName(name: string | undefined | null): boolean {
  return (name ?? "").trim() === BRAINROD_COMPENSATION_CHILD_NAME;
}

export function isBrainrodCompensationAvailable(opts: {
  childName?: string | null;
  stickerAlbum: string[];
  compensationClaims: Record<string, boolean>;
}): boolean {
  if (!isKeigoChildName(opts.childName)) return false;
  if (opts.compensationClaims[BRAINROD_COMPENSATION_CLAIM_KEY]) return false;
  if (opts.stickerAlbum.includes(BRAINROD_COMPENSATION_STICKER_ID)) return false;
  return true;
}
