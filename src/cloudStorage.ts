import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { LocalAppStateSnapshot } from "./appStateStorage";
import type { ActiveChildContext } from "./App";
import { firestoreAppStateSetOptions } from "./cloudAppStateWrite";

export type { ActiveChildContext };

export interface ChildProfile {
  id: string;
  name: string;
  avatarEmoji: string;
  sortOrder?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  lastOpenedAt?: Timestamp;
}

export interface CloudAppStateDocument {
  schemaVersion: number;
  state: unknown | null;
  stickerAlbum: string[];
  revision?: number;
  updatedAt?: Timestamp;
  updatedByDeviceId?: string;
}

export interface LoadedCloudAppState {
  snapshot: LocalAppStateSnapshot;
  updatedAtMs: number;
  revision: number;
  updatedByDeviceId?: string;
}

export class CloudConflictError extends Error {
  constructor() {
    super("別の端末の新しい記録があるので、上書きしませんでした");
    this.name = "CloudConflictError";
  }
}

function timestampToMs(value: unknown): number {
  if (
    value
    && typeof value === "object"
    && "toMillis" in value
    && typeof (value as Timestamp).toMillis === "function"
  ) {
    return (value as Timestamp).toMillis();
  }
  return 0;
}

export function createDeviceId(): string {
  const key = "keigo-cloud-device-id-v1";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(key, id);
  return id;
}

function assertDb() {
  if (!db) throw new Error("Firebase is not configured.");
  return db;
}

/** Firestore rejects `undefined`; strip it (and keep null / other values). */
function stripUndefinedDeep(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)).filter((item) => item !== undefined);
  }
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (nested === undefined) continue;
    const cleaned = stripUndefinedDeep(nested);
    if (cleaned !== undefined) out[key] = cleaned;
  }
  return out;
}

export async function ensureParentUser(userId: string, email: string | null): Promise<void> {
  const firestore = assertDb();
  await setDoc(
    doc(firestore, "users", userId),
    { email: email ?? null, updatedAt: serverTimestamp(), createdAt: serverTimestamp() },
    { merge: true },
  );
}

export async function listChildProfiles(userId: string): Promise<ChildProfile[]> {
  const firestore = assertDb();
  const snapshot = await getDocs(query(collection(firestore, "users", userId, "children"), orderBy("createdAt", "asc")));
  const mapped = snapshot.docs.map((childDoc) => {
    const data = childDoc.data();
    return {
      id: childDoc.id,
      name: typeof data.name === "string" ? data.name : "プロフィール",
      avatarEmoji: typeof data.avatarEmoji === "string" ? data.avatarEmoji : "🙂",
      sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : undefined,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      lastOpenedAt: data.lastOpenedAt,
    };
  });
  return mapped
    .map((profile, index) => ({
      profile,
      key: typeof profile.sortOrder === "number" ? profile.sortOrder : index,
    }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.profile);
}

export async function createChildProfile(
  userId: string,
  name: string,
  avatarEmoji: string,
  sortOrder = 0,
): Promise<ChildProfile> {
  const firestore = assertDb();
  const ref = doc(collection(firestore, "users", userId, "children"));
  const profile = {
    name: name.trim() || "プロフィール",
    avatarEmoji: avatarEmoji.trim() || "🙂",
    sortOrder,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, profile);
  return { id: ref.id, name: profile.name, avatarEmoji: profile.avatarEmoji, sortOrder };
}

export async function touchChildProfile(userId: string, childId: string): Promise<void> {
  const firestore = assertDb();
  await setDoc(
    doc(firestore, "users", userId, "children", childId),
    { lastOpenedAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function updateChildProfile(
  userId: string,
  childId: string,
  name: string,
  avatarEmoji: string,
): Promise<ChildProfile> {
  const firestore = assertDb();
  const nextName = name.trim() || "プロフィール";
  const nextEmoji = avatarEmoji.trim() || "🙂";
  await setDoc(
    doc(firestore, "users", userId, "children", childId),
    {
      name: nextName,
      avatarEmoji: nextEmoji,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return { id: childId, name: nextName, avatarEmoji: nextEmoji };
}

export async function reorderChildProfiles(userId: string, orderedIds: string[]): Promise<void> {
  const firestore = assertDb();
  await Promise.all(
    orderedIds.map((childId, index) =>
      setDoc(
        doc(firestore, "users", userId, "children", childId),
        { sortOrder: index, updatedAt: serverTimestamp() },
        { merge: true },
      ),
    ),
  );
}

export async function loadCloudAppState(userId: string, childId: string): Promise<LoadedCloudAppState | null> {
  const firestore = assertDb();
  const snapshot = await getDoc(doc(firestore, "users", userId, "children", childId, "appState", "main"));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as Partial<CloudAppStateDocument>;
  return {
    snapshot: {
      state: data.state ?? null,
      stickerAlbum: Array.isArray(data.stickerAlbum)
        ? data.stickerAlbum.filter((id): id is string => typeof id === "string")
        : [],
    },
    updatedAtMs: timestampToMs(data.updatedAt),
    revision: typeof data.revision === "number" && Number.isSafeInteger(data.revision) && data.revision >= 0
      ? data.revision
      : 0,
    updatedByDeviceId: typeof data.updatedByDeviceId === "string" ? data.updatedByDeviceId : undefined,
  };
}

export async function saveCloudAppState(
  userId: string,
  childId: string,
  snapshot: LocalAppStateSnapshot,
  deviceId: string,
  expectedRevision?: number,
  expectedUpdatedAtMs?: number,
): Promise<{ updatedAtMs: number; revision: number }> {
  const firestore = assertDb();
  const ref = doc(firestore, "users", userId, "children", childId, "appState", "main");
  const state = stripUndefinedDeep(snapshot.state) ?? null;
  const stickerAlbum = Array.isArray(snapshot.stickerAlbum)
    ? snapshot.stickerAlbum.filter((id): id is string => typeof id === "string")
    : [];
  const mergeOptions = firestoreAppStateSetOptions();

  const result = await runTransaction(firestore, async (transaction) => {
    const remote = await transaction.get(ref);
    const remoteData = remote.exists()
      ? remote.data() as Partial<CloudAppStateDocument>
      : undefined;
    const remoteRevision = typeof remoteData?.revision === "number"
      && Number.isSafeInteger(remoteData.revision)
      && remoteData.revision >= 0
      ? remoteData.revision
      : 0;

    const remoteUpdatedAtMs = timestampToMs(remoteData?.updatedAt);
    if (
      (expectedRevision !== undefined && remoteRevision > expectedRevision)
      || (expectedUpdatedAtMs !== undefined && remoteUpdatedAtMs > expectedUpdatedAtMs)
    ) {
      throw new CloudConflictError();
    }

    const revision = remoteRevision + 1;
    const updatedAt = Timestamp.now();
    const payload = {
      schemaVersion: 1,
      state,
      stickerAlbum,
      revision,
      updatedAt,
      updatedByDeviceId: deviceId,
    };
    if (mergeOptions) {
      transaction.set(ref, payload, mergeOptions);
    } else {
      transaction.set(ref, payload);
    }
    return { updatedAtMs: updatedAt.toMillis(), revision };
  });

  await touchChildProfile(userId, childId);
  return result;
}

export async function deleteChildProfile(userId: string, childId: string): Promise<void> {
  const firestore = assertDb();
  await deleteDoc(doc(firestore, "users", userId, "children", childId, "appState", "main"));
  await deleteDoc(doc(firestore, "users", userId, "children", childId));
}
