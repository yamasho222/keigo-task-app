/** 親の救済メニュー用パスワード（未設定時の初期デフォルト） */

/** アプリで未変更のときの合言葉 */
export const DEFAULT_PARENT_RESCUE_PASSWORD = "oyako";

/** @deprecated 互換エイリアス — DEFAULT_PARENT_RESCUE_PASSWORD を使う */
export const PARENT_RESCUE_PASSWORD = DEFAULT_PARENT_RESCUE_PASSWORD;

const MIN_PASSWORD_LENGTH = 4;

export function resolveParentRescuePassword(stored?: string | null): string {
  if (typeof stored !== "string") return DEFAULT_PARENT_RESCUE_PASSWORD;
  const trimmed = stored.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_PARENT_RESCUE_PASSWORD;
}

/** 保存用。空なら undefined（＝デフォルト扱い） */
export function normalizeParentRescuePassword(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function verifyParentRescuePassword(
  input: string,
  stored?: string | null,
): boolean {
  return input.trim() === resolveParentRescuePassword(stored);
}

export function isValidNewParentRescuePassword(next: string): boolean {
  return next.trim().length >= MIN_PASSWORD_LENGTH;
}
