const LEGACY_STORAGE_KEY = "keigo-app-v1";
const LEGACY_STICKER_ALBUM_KEY = "keigo-sticker-album-v1";
const LOCAL_IMPORT_SEEN_KEY = "keigo-cloud-import-seen-v1";
const SELECTED_CHILD_KEY = "keigo-selected-child-profile-v1";

export interface LocalAppStateSnapshot {
  state: unknown | null;
  stickerAlbum: string[];
}

export function appStateStorageKey(childId?: string | null): string {
  return childId ? `${LEGACY_STORAGE_KEY}:${childId}` : LEGACY_STORAGE_KEY;
}

export function stickerAlbumStorageKey(childId?: string | null): string {
  return childId ? `${LEGACY_STICKER_ALBUM_KEY}:${childId}` : LEGACY_STICKER_ALBUM_KEY;
}

function readStickerAlbum(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function readState(key: string): unknown | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function loadLocalAppStateSnapshot(childId?: string | null): LocalAppStateSnapshot {
  return {
    state: readState(appStateStorageKey(childId)),
    stickerAlbum: readStickerAlbum(stickerAlbumStorageKey(childId)),
  };
}

/** クラウド導入前の共有スロット（子IDなし）。初回「つなぐ」の取り込み元だけに使う */
export function loadLegacyUnscopedSnapshot(): LocalAppStateSnapshot {
  return loadLocalAppStateSnapshot(null);
}

export function hasLocalAppState(snapshot = loadLocalAppStateSnapshot()): boolean {
  return snapshot.state !== null || snapshot.stickerAlbum.length > 0;
}

export function hasLegacyUnscopedLocalData(): boolean {
  return hasLocalAppState(loadLegacyUnscopedSnapshot());
}

export function writeLocalAppStateSnapshot(
  snapshot: LocalAppStateSnapshot,
  childId?: string | null,
): void {
  const stateKey = appStateStorageKey(childId);
  const stickerKey = stickerAlbumStorageKey(childId);
  if (snapshot.state) {
    localStorage.setItem(stateKey, JSON.stringify(snapshot.state));
  } else {
    localStorage.removeItem(stateKey);
  }
  localStorage.setItem(stickerKey, JSON.stringify(snapshot.stickerAlbum));
}

export function clearLocalAppStateSnapshot(childId?: string | null): void {
  localStorage.removeItem(appStateStorageKey(childId));
  localStorage.setItem(stickerAlbumStorageKey(childId), JSON.stringify([]));
}

export function markLocalImportSeen(childId: string): void {
  const seen = new Set(loadLocalImportSeen());
  seen.add(childId);
  localStorage.setItem(LOCAL_IMPORT_SEEN_KEY, JSON.stringify([...seen]));
}

export function hasLocalImportSeen(childId: string): boolean {
  return loadLocalImportSeen().includes(childId);
}

/**
 * 初回「つなぐ」候補か（同期判定の前段）。
 * クラウドに既にある子は別途 markLocalImportSeen して除外する。
 */
export function canImportLegacyToChild(childId: string): boolean {
  return (
    hasLegacyUnscopedLocalData() &&
    !hasLocalImportSeen(childId) &&
    !hasLocalAppState(loadLocalAppStateSnapshot(childId))
  );
}

/** 古い共有スロットを消す（誤って別の子へつなぐのを防ぐ） */
export function clearLegacyUnscopedSnapshot(): void {
  clearLocalAppStateSnapshot(null);
}

function loadLocalImportSeen(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_IMPORT_SEEN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function loadSelectedChildId(): string | null {
  return localStorage.getItem(SELECTED_CHILD_KEY);
}

export function saveSelectedChildId(childId: string): void {
  localStorage.setItem(SELECTED_CHILD_KEY, childId);
}

export function clearSelectedChildId(): void {
  localStorage.removeItem(SELECTED_CHILD_KEY);
}
