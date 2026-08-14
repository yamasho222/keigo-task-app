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

export interface OrphanedLocalSnapshot {
  childId: string;
  snapshot: LocalAppStateSnapshot;
  summary: string;
}

function summarizeSnapshot(snapshot: LocalAppStateSnapshot): string {
  const parts: string[] = [];
  const state = snapshot.state && typeof snapshot.state === "object"
    ? snapshot.state as Record<string, unknown>
    : null;
  if (state && typeof state.date === "string" && state.date) {
    parts.push(`日付 ${state.date}`);
  }
  const mining = state?.mining && typeof state.mining === "object"
    ? state.mining as Record<string, unknown>
    : null;
  if (mining && typeof mining.tickets === "number") {
    parts.push(`こうざん🎫 ${mining.tickets}`);
  }
  if (snapshot.stickerAlbum.length > 0) {
    parts.push(`シール ${snapshot.stickerAlbum.length}`);
  }
  return parts.length > 0 ? parts.join(" / ") : "記録あり";
}

/** いまのクラウドプロフィールに属さない、端末に残った子別セーブ */
export function listOrphanedLocalSnapshots(liveChildIds: string[]): OrphanedLocalSnapshot[] {
  const live = new Set(liveChildIds);
  const prefixes = [`${LEGACY_STORAGE_KEY}:`, `${LEGACY_STICKER_ALBUM_KEY}:`];
  const ids = new Set<string>();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    for (const prefix of prefixes) {
      if (!key.startsWith(prefix)) continue;
      const id = key.slice(prefix.length);
      if (!id || live.has(id)) continue;
      ids.add(id);
    }
  }
  const out: OrphanedLocalSnapshot[] = [];
  for (const childId of ids) {
    const snapshot = loadLocalAppStateSnapshot(childId);
    if (!hasLocalAppState(snapshot)) continue;
    out.push({
      childId,
      snapshot,
      summary: summarizeSnapshot(snapshot),
    });
  }
  return out;
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
