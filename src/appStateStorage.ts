const STORAGE_KEY = "keigo-app-v1";
const STICKER_ALBUM_KEY = "keigo-sticker-album-v1";
const LOCAL_IMPORT_SEEN_KEY = "keigo-cloud-import-seen-v1";
const SELECTED_CHILD_KEY = "keigo-selected-child-profile-v1";

export interface LocalAppStateSnapshot {
  state: unknown | null;
  stickerAlbum: string[];
}

export function loadLocalAppStateSnapshot(): LocalAppStateSnapshot {
  let state: unknown | null = null;
  let stickerAlbum: string[] = [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = JSON.parse(raw);
  } catch {
    state = null;
  }

  try {
    const raw = localStorage.getItem(STICKER_ALBUM_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) stickerAlbum = parsed.filter((id): id is string => typeof id === "string");
  } catch {
    stickerAlbum = [];
  }

  return { state, stickerAlbum };
}

export function hasLocalAppState(snapshot = loadLocalAppStateSnapshot()): boolean {
  return snapshot.state !== null || snapshot.stickerAlbum.length > 0;
}

export function writeLocalAppStateSnapshot(snapshot: LocalAppStateSnapshot): void {
  if (snapshot.state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot.state));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  localStorage.setItem(STICKER_ALBUM_KEY, JSON.stringify(snapshot.stickerAlbum));
}

export function clearLocalAppStateSnapshot(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.setItem(STICKER_ALBUM_KEY, JSON.stringify([]));
}

export function markLocalImportSeen(childId: string): void {
  const seen = new Set(loadLocalImportSeen());
  seen.add(childId);
  localStorage.setItem(LOCAL_IMPORT_SEEN_KEY, JSON.stringify([...seen]));
}

export function hasLocalImportSeen(childId: string): boolean {
  return loadLocalImportSeen().includes(childId);
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
