import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { LocalAppStateSnapshot } from "./appStateStorage";
import type { ActiveChildContext } from "./App";

export type { ActiveChildContext };

export interface ChildProfile {
  id: string;
  name: string;
  avatarEmoji: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  lastOpenedAt?: Timestamp;
}

export interface CloudAppStateDocument {
  schemaVersion: number;
  state: unknown | null;
  stickerAlbum: string[];
  updatedAt?: Timestamp;
  updatedByDeviceId?: string;
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
  return snapshot.docs.map((childDoc) => {
    const data = childDoc.data();
    return {
      id: childDoc.id,
      name: typeof data.name === "string" ? data.name : "プロフィール",
      avatarEmoji: typeof data.avatarEmoji === "string" ? data.avatarEmoji : "🙂",
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      lastOpenedAt: data.lastOpenedAt,
    };
  });
}

export async function createChildProfile(userId: string, name: string, avatarEmoji: string): Promise<ChildProfile> {
  const firestore = assertDb();
  const ref = doc(collection(firestore, "users", userId, "children"));
  const profile = {
    name: name.trim() || "プロフィール",
    avatarEmoji: avatarEmoji.trim() || "🙂",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, profile);
  return { id: ref.id, name: profile.name, avatarEmoji: profile.avatarEmoji };
}

export async function touchChildProfile(userId: string, childId: string): Promise<void> {
  const firestore = assertDb();
  await setDoc(
    doc(firestore, "users", userId, "children", childId),
    { lastOpenedAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function loadCloudAppState(userId: string, childId: string): Promise<LocalAppStateSnapshot | null> {
  const firestore = assertDb();
  const snapshot = await getDoc(doc(firestore, "users", userId, "children", childId, "appState", "main"));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as Partial<CloudAppStateDocument>;
  return {
    state: data.state ?? null,
    stickerAlbum: Array.isArray(data.stickerAlbum)
      ? data.stickerAlbum.filter((id): id is string => typeof id === "string")
      : [],
  };
}

export async function saveCloudAppState(
  userId: string,
  childId: string,
  snapshot: LocalAppStateSnapshot,
  deviceId: string,
): Promise<void> {
  const firestore = assertDb();
  const state = stripUndefinedDeep(snapshot.state) ?? null;
  const stickerAlbum = Array.isArray(snapshot.stickerAlbum)
    ? snapshot.stickerAlbum.filter((id): id is string => typeof id === "string")
    : [];
  await setDoc(
    doc(firestore, "users", userId, "children", childId, "appState", "main"),
    {
      schemaVersion: 1,
      state,
      stickerAlbum,
      updatedAt: serverTimestamp(),
      updatedByDeviceId: deviceId,
    },
    { merge: true },
  );
  await touchChildProfile(userId, childId);
}

export async function deleteChildProfile(userId: string, childId: string): Promise<void> {
  const firestore = assertDb();
  await deleteDoc(doc(firestore, "users", userId, "children", childId, "appState", "main"));
  await deleteDoc(doc(firestore, "users", userId, "children", childId));
}
