/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability, react-hooks/preserve-manual-memoization, react-hooks/refs, react-hooks/exhaustive-deps */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { AuthScreen } from "./AuthScreen";
import { ChildProfileScreen } from "./ChildProfileScreen";
import {
  canImportLegacyToChild,
  clearLegacyUnscopedSnapshot,
  clearSelectedChildId,
  hasLegacyUnscopedLocalData,
  hasLocalAppState,
  hasLocalImportSeen,
  loadLegacyUnscopedSnapshot,
  loadLocalAppStateSnapshot,
  loadSelectedChildId,
  markLocalImportSeen,
  saveSelectedChildId,
  writeLocalAppStateSnapshot,
  listOrphanedLocalSnapshots,
  clearLocalAppStateSnapshot,
  type LocalAppStateSnapshot,
} from "./appStateStorage";
import {
  CloudConflictError,
  createChildProfile,
  createDeviceId,
  deleteChildProfile,
  ensureParentUser,
  listChildProfiles,
  loadCloudAppState,
  reorderChildProfiles,
  saveCloudAppState,
  touchChildProfile,
  updateChildProfile,
  type ActiveChildContext,
  type ChildProfile,
  type LoadedCloudAppState,
} from "./cloudStorage";
import {
  isFirebaseConfigured,
  listenAuthState,
  signInWithGoogle,
  signOutFirebase,
  completeGoogleRedirectSignIn,
  type FirebaseUser,
} from "./firebase";

interface CloudAppShellProps {
  children: (context?: ActiveChildContext) => ReactNode;
}

type OpenMode = "cloud" | "importLocal";

function isMeaningfulSnapshot(snapshot: LocalAppStateSnapshot | null): boolean {
  return snapshot !== null && hasLocalAppState(snapshot);
}

function snapshotKey(state: unknown, stickerAlbum: string[]): string {
  return JSON.stringify({ state, stickerAlbum });
}

export function CloudAppShell({ children }: CloudAppShellProps) {
  const [localOnly, setLocalOnly] = useState(false);
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<ChildProfile | null>(null);
  const [appKey, setAppKey] = useState("local");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [syncStatus, setSyncStatus] = useState("未同期");
  const saveTimerRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<{
    userId: string;
    childId: string;
    state: unknown;
    stickerAlbum: string[];
  } | null>(null);
  /** 同一プロフィールの openProfile 重複実行を防ぐ（auth の多重発火対策） */
  const openingChildIdRef = useRef<string | null>(null);
  const openedChildIdRef = useRef<string | null>(null);
  const seenUpdatedAtMsRef = useRef(0);
  const lastAppliedKeyRef = useRef<string | null>(null);
  const resumeLockRef = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;
  const activeProfileRef = useRef(activeProfile);
  activeProfileRef.current = activeProfile;
  const deviceId = useMemo(() => createDeviceId(), []);
  /** レガシー共有データの有無（プロフィール選択画面の再表示用） */
  const [legacyImportAvailable, setLegacyImportAvailable] = useState(false);
  /** 初回「つなぐ」を出してよい childId（クラウド未作成の子だけ） */
  const [importableChildIds, setImportableChildIds] = useState<string[]>([]);
  /** クラウドに無い子IDの端末セーブ（削除済みプロフィールの拾い直し用） */
  const [orphans, setOrphans] = useState<{ childId: string; summary: string }[]>([]);

  const applyChildSnapshot = useCallback((childId: string, snapshot: LocalAppStateSnapshot) => {
    writeLocalAppStateSnapshot(snapshot, childId);
  }, []);

  const rememberLoaded = useCallback((childId: string, loaded: LoadedCloudAppState) => {
    applyChildSnapshot(childId, loaded.snapshot);
    seenUpdatedAtMsRef.current = loaded.updatedAtMs;
    lastAppliedKeyRef.current = snapshotKey(loaded.snapshot.state, loaded.snapshot.stickerAlbum);
  }, [applyChildSnapshot]);

  const rememberWritten = useCallback((
    childId: string,
    snapshot: LocalAppStateSnapshot,
    updatedAtMs: number,
  ) => {
    applyChildSnapshot(childId, snapshot);
    seenUpdatedAtMsRef.current = updatedAtMs;
    lastAppliedKeyRef.current = snapshotKey(snapshot.state, snapshot.stickerAlbum);
  }, [applyChildSnapshot]);

  const pullRemoteAndRemount = useCallback(async (statusOnSuccess: string) => {
    const currentUser = userRef.current;
    const profile = activeProfileRef.current;
    if (!currentUser || !profile) return;
    const loaded = await loadCloudAppState(currentUser.uid, profile.id);
    if (!loaded) {
      setSyncStatus("クラウドに記録がありません");
      return;
    }
    rememberLoaded(profile.id, loaded);
    markLocalImportSeen(profile.id);
    setSyncStatus(statusOnSuccess);
    setAppKey(`${profile.id}:${loaded.updatedAtMs}:${Date.now()}`);
  }, [rememberLoaded]);

  const flushPendingSave = useCallback(async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingSaveRef.current;
    if (!pending) return;
    pendingSaveRef.current = null;
    try {
      const updatedAtMs = await saveCloudAppState(
        pending.userId,
        pending.childId,
        { state: pending.state, stickerAlbum: pending.stickerAlbum },
        deviceId,
        seenUpdatedAtMsRef.current,
      );
      rememberWritten(
        pending.childId,
        { state: pending.state, stickerAlbum: pending.stickerAlbum },
        updatedAtMs,
      );
      setSyncStatus("同期済み");
    } catch (err) {
      if (err instanceof CloudConflictError) {
        await pullRemoteAndRemount("別端末の新しい記録を入れたよ");
        return;
      }
      pendingSaveRef.current = pending;
      setSyncStatus(err instanceof Error ? `同期エラー: ${err.message}` : "同期エラー");
    }
  }, [deviceId, pullRemoteAndRemount, rememberWritten]);

  /** クラウド済みの子は「つなぐ」対象外にし、不要な共有スロットも片付ける */
  const reconcileImportEligibility = useCallback(async (
    userId: string,
    nextProfiles: ChildProfile[],
  ) => {
    const importable: string[] = [];
    for (const profile of nextProfiles) {
      if (!canImportLegacyToChild(profile.id)) continue;
      const cloudState = await loadCloudAppState(userId, profile.id);
      if (isMeaningfulSnapshot(cloudState?.snapshot ?? null)) {
        markLocalImportSeen(profile.id);
        continue;
      }
      importable.push(profile.id);
    }
    // どの子にも「つなぐ」必要がなければ、古い共有スロットは誤操作の元なので消す
    if (importable.length === 0 && hasLegacyUnscopedLocalData()) {
      clearLegacyUnscopedSnapshot();
    }
    setImportableChildIds(importable);
    setLegacyImportAvailable(importable.length > 0);
  }, []);

  const commitProfiles = useCallback((nextProfiles: ChildProfile[]) => {
    setProfiles(nextProfiles);
    setOrphans(
      listOrphanedLocalSnapshots(nextProfiles.map((profile) => profile.id)).map(({ childId, summary }) => ({
        childId,
        summary,
      })),
    );
  }, []);

  const refreshProfiles = useCallback(async (currentUser = user) => {
    if (!currentUser) return;
    const nextProfiles = await listChildProfiles(currentUser.uid);
    commitProfiles(nextProfiles);
    await reconcileImportEligibility(currentUser.uid, nextProfiles);
  }, [commitProfiles, reconcileImportEligibility, user]);

  const openProfile = useCallback(async (
    currentUser: FirebaseUser,
    profile: ChildProfile,
    mode: OpenMode,
  ) => {
    // 起動時の onAuthStateChanged 多重発火で confirm が連続表示されるのを防ぐ
    if (openingChildIdRef.current === profile.id) return;
    if (mode === "cloud" && openedChildIdRef.current === profile.id) return;
    openingChildIdRef.current = profile.id;
    setLoading(true);
    setError(undefined);
    try {
      await flushPendingSave();

      const childLocal = loadLocalAppStateSnapshot(profile.id);
      const childLocalMeaningful = isMeaningfulSnapshot(childLocal);
      const legacySnapshot = loadLegacyUnscopedSnapshot();
      const legacyMeaningful = isMeaningfulSnapshot(legacySnapshot);

      if (mode === "importLocal") {
        if (!canImportLegacyToChild(profile.id)) {
          setError(
            hasLocalImportSeen(profile.id)
              ? `「${profile.name}」は、このスマホですでにつないであります。まちがって上書きしないよう、つなぐ操作はできません。`
              : "この端末に取り込める（まだどの子にもつないでない）記録がありません。",
          );
          return;
        }
        if (!legacyMeaningful) {
          setError("この端末に取り込める既存データがありません。");
          return;
        }
        const existingCloud = await loadCloudAppState(currentUser.uid, profile.id);
        if (isMeaningfulSnapshot(existingCloud?.snapshot ?? null)) {
          markLocalImportSeen(profile.id);
          setError(
            `「${profile.name}」にはすでにクラウドの記録があります。\n上書きつなぎはできません。「この子の記録を開く」を使ってください。`,
          );
          await reconcileImportEligibility(currentUser.uid, await listChildProfiles(currentUser.uid));
          return;
        }
        if (!window.confirm(
          `このスマホの古い記録を「${profile.name}」につなぎます。\n（この記録は1回だけ使えます。他の子にはつなげません）\nよろしいですか？`,
        )) {
          return;
        }
        const writtenAt = await saveCloudAppState(currentUser.uid, profile.id, legacySnapshot, deviceId);
        rememberWritten(profile.id, legacySnapshot, writtenAt);
        markLocalImportSeen(profile.id);
        // 共有スロットは使い切り。別の子へ同じデータをつなぐ事故を防ぐ
        clearLegacyUnscopedSnapshot();
        setImportableChildIds([]);
        setLegacyImportAvailable(false);
      } else {
        const loaded = await loadCloudAppState(currentUser.uid, profile.id);
        const cloudMeaningful = isMeaningfulSnapshot(loaded?.snapshot ?? null);

        if (cloudMeaningful && loaded) {
          // クラウドを正とし、その子専用の端末キャッシュへ書く（他の子の領域は触らない）
          rememberLoaded(profile.id, loaded);
          markLocalImportSeen(profile.id);
        } else if (childLocalMeaningful) {
          // クラウド空・子専用キャッシュあり → その子のデータをクラウドへ上げる
          if (!window.confirm(
            `「${profile.name}」のクラウドにはまだ記録がありません。\nこのスマホに残っている「${profile.name}」の記録をつなぎますか？`,
          )) {
            return;
          }
          const writtenAt = await saveCloudAppState(currentUser.uid, profile.id, childLocal, deviceId);
          rememberWritten(profile.id, childLocal, writtenAt);
          markLocalImportSeen(profile.id);
        } else if (legacyMeaningful && !hasLocalImportSeen(profile.id)) {
          setError(
            `「${profile.name}」にはまだクラウドの記録がありません。\n初回は「このスマホの記録を、この子につなぐ」を使ってください。`,
          );
          return;
        } else {
          const empty = { state: null, stickerAlbum: [] as string[] };
          const writtenAt = await saveCloudAppState(currentUser.uid, profile.id, empty, deviceId);
          rememberWritten(profile.id, empty, writtenAt);
          markLocalImportSeen(profile.id);
        }
      }
      await touchChildProfile(currentUser.uid, profile.id);
      saveSelectedChildId(profile.id);
      openedChildIdRef.current = profile.id;
      setActiveProfile(profile);
      setSyncStatus("同期準備OK");
      setAppKey(profile.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "プロフィールを開けませんでした。");
    } finally {
      if (openingChildIdRef.current === profile.id) openingChildIdRef.current = null;
      setLoading(false);
    }
  }, [deviceId, flushPendingSave, reconcileImportEligibility, rememberLoaded, rememberWritten]);

  const restoreOrphan = useCallback(async (orphanChildId: string, target: ChildProfile) => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    const snapshot = loadLocalAppStateSnapshot(orphanChildId);
    if (!isMeaningfulSnapshot(snapshot)) {
      setError("このスマホに残っている記録が見つかりませんでした。けんごのスマホでもう一度開いてみてください。");
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const existingCloud = await loadCloudAppState(currentUser.uid, target.id);
      const hasCloud = isMeaningfulSnapshot(existingCloud?.snapshot ?? null);
      const message = hasCloud
        ? `このスマホに残っている削除済みの記録で、「${target.name}」のクラウド記録を上書きします。\nけいごなど別の子にはつながないでください。\nよろしいですか？`
        : `このスマホに残っている削除済みの記録を「${target.name}」につなぎます。\nけいごなど別の子にはつながないでください。\nよろしいですか？`;
      if (!window.confirm(message)) return;
      await saveCloudAppState(currentUser.uid, target.id, snapshot, deviceId);
      markLocalImportSeen(target.id);
      clearLocalAppStateSnapshot(orphanChildId);
      const nextProfiles = await listChildProfiles(currentUser.uid);
      commitProfiles(nextProfiles);
      openedChildIdRef.current = null;
      await openProfile(currentUser, target, "cloud");
    } catch (err) {
      setError(err instanceof Error ? err.message : "記録のつなぎに失敗しました。");
    } finally {
      setLoading(false);
    }
  }, [commitProfiles, deviceId, openProfile]);

  const openProfileRef = useRef(openProfile);
  openProfileRef.current = openProfile;

  useEffect(() => {
    if (!isFirebaseConfigured || localOnly) {
      setAuthLoading(false);
      return;
    }

    let cancelled = false;
    let safetyTimer: number | null = window.setTimeout(() => {
      if (!cancelled) setAuthLoading(false);
    }, 10000);

    // getRedirectResult が長引いても、onAuthStateChanged で必ず進める
    const unsubscribe = listenAuthState(async (nextUser) => {
      if (cancelled) return;
      if (safetyTimer !== null) {
        window.clearTimeout(safetyTimer);
        safetyTimer = null;
      }
      setUser(nextUser);
      setAuthLoading(false);
      if (!nextUser) {
        setProfiles([]);
        setOrphans([]);
        setActiveProfile(null);
        openedChildIdRef.current = null;
        seenUpdatedAtMsRef.current = 0;
        lastAppliedKeyRef.current = null;
        return;
      }
      setLoading(true);
      setError(undefined);
      try {
        await ensureParentUser(nextUser.uid, nextUser.email);
        const nextProfiles = await listChildProfiles(nextUser.uid);
        if (cancelled) return;
        commitProfiles(nextProfiles);
        await reconcileImportEligibility(nextUser.uid, nextProfiles);
        if (cancelled) return;
        const selectedId = loadSelectedChildId();
        const selected = nextProfiles.find((profile) => profile.id === selectedId);
        const hasOrphans = listOrphanedLocalSnapshots(nextProfiles.map((profile) => profile.id)).length > 0;
        // 削除済みの端末記録があるときは選択画面を出して、つなぎ直しを先にできるようにする
        if (selected && !hasOrphans) await openProfileRef.current(nextUser, selected, "cloud");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "プロフィールの読み込みに失敗しました。");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    void completeGoogleRedirectSignIn().catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : "Googleログインに失敗しました。");
        setAuthLoading(false);
      }
    });

    return () => {
      cancelled = true;
      if (safetyTimer !== null) window.clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, [localOnly]);

  const saveState = useCallback((state: unknown, stickerAlbum: string[]) => {
    if (!user || !activeProfile) return;
    const childId = activeProfile.id;
    writeLocalAppStateSnapshot({ state, stickerAlbum }, childId);
    if (lastAppliedKeyRef.current === snapshotKey(state, stickerAlbum)) return;
    pendingSaveRef.current = {
      userId: user.uid,
      childId,
      state,
      stickerAlbum,
    };
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    setSyncStatus("保存待ち");
    saveTimerRef.current = window.setTimeout(() => {
      const pending = pendingSaveRef.current;
      if (!pending || pending.childId !== childId) return;
      pendingSaveRef.current = null;
      setSyncStatus("保存中...");
      saveCloudAppState(
        pending.userId,
        pending.childId,
        { state: pending.state, stickerAlbum: pending.stickerAlbum },
        deviceId,
        seenUpdatedAtMsRef.current,
      )
        .then((updatedAtMs) => {
          rememberWritten(
            pending.childId,
            { state: pending.state, stickerAlbum: pending.stickerAlbum },
            updatedAtMs,
          );
          setSyncStatus("同期済み");
        })
        .catch((err) => {
          if (err instanceof CloudConflictError) {
            void pullRemoteAndRemount("別端末の新しい記録を入れたよ");
            return;
          }
          pendingSaveRef.current = pending;
          setSyncStatus(err instanceof Error ? `同期エラー: ${err.message}` : "同期エラー");
        });
    }, 800);
  }, [activeProfile, deviceId, pullRemoteAndRemount, rememberWritten, user]);

  const reloadFromCloud = useCallback(async () => {
    const currentUser = userRef.current;
    const profile = activeProfileRef.current;
    if (!currentUser || !profile) return;
    if (pendingSaveRef.current) {
      if (!window.confirm("まだ送っていない変更があります。捨ててクラウドの最新を入れますか？")) return;
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      pendingSaveRef.current = null;
    }
    setSyncStatus("読み込み中...");
    try {
      await pullRemoteAndRemount("同期済み");
    } catch (err) {
      setSyncStatus(err instanceof Error ? `同期エラー: ${err.message}` : "同期エラー");
    }
  }, [pullRemoteAndRemount]);

  const onSwitchProfile = useCallback(() => {
    if (!window.confirm("プロフィール選択画面に戻りますか？未同期の変更がある場合は少し待ってから切り替えてください。")) return;
    void flushPendingSave().finally(() => {
      openedChildIdRef.current = null;
      seenUpdatedAtMsRef.current = 0;
      lastAppliedKeyRef.current = null;
      setActiveProfile(null);
      clearSelectedChildId();
      setAppKey("profile-select");
      if (user) {
        void listChildProfiles(user.uid).then((nextProfiles) => {
          commitProfiles(nextProfiles);
          return reconcileImportEligibility(user.uid, nextProfiles);
        });
      } else {
        setImportableChildIds([]);
        setLegacyImportAvailable(false);
      }
    });
  }, [commitProfiles, flushPendingSave, reconcileImportEligibility, user]);

  const onSignOut = useCallback(async () => {
    await flushPendingSave();
    openedChildIdRef.current = null;
    seenUpdatedAtMsRef.current = 0;
    lastAppliedKeyRef.current = null;
    setActiveProfile(null);
    clearSelectedChildId();
    await signOutFirebase();
  }, [flushPendingSave]);

  useEffect(() => {
    const onHidden = () => {
      void flushPendingSave();
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (resumeLockRef.current) return;
      if (!userRef.current || !activeProfileRef.current) return;
      resumeLockRef.current = true;
      void (async () => {
        try {
          await flushPendingSave();
          if (pendingSaveRef.current) {
            setSyncStatus("未送信あり。メニューの同期で取り直せます");
            return;
          }
          const currentUser = userRef.current;
          const profile = activeProfileRef.current;
          if (!currentUser || !profile) return;
          const loaded = await loadCloudAppState(currentUser.uid, profile.id);
          if (!loaded) return;
          if (loaded.updatedAtMs <= seenUpdatedAtMsRef.current) return;
          rememberLoaded(profile.id, loaded);
          markLocalImportSeen(profile.id);
          setSyncStatus("同期済み");
          setAppKey(`${profile.id}:${loaded.updatedAtMs}:${Date.now()}`);
        } catch (err) {
          setSyncStatus(err instanceof Error ? `同期エラー: ${err.message}` : "同期エラー");
        } finally {
          resumeLockRef.current = false;
        }
      })();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onHidden();
      if (document.visibilityState === "visible") onVisible();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHidden);
    };
  }, [flushPendingSave, rememberLoaded]);

  const activeContext: ActiveChildContext | undefined = useMemo(() => {
    if (!user || !activeProfile) return undefined;
    return {
      parentUserId: user.uid,
      childId: activeProfile.id,
      childName: activeProfile.name,
      avatarEmoji: activeProfile.avatarEmoji,
      syncStatus,
      saveState,
      reloadFromCloud,
      onSwitchProfile,
      onSignOut,
    };
  }, [user, activeProfile, syncStatus, saveState, reloadFromCloud, onSwitchProfile, onSignOut]);

  if (localOnly) return <>{children()}</>;

  if (authLoading) {
    return <div style={{ padding: 24, fontWeight: 800 }}>ログイン状態を確認しています...</div>;
  }

  if (!user) {
    return (
      <AuthScreen
        firebaseConfigured={isFirebaseConfigured}
        loading={loading}
        error={error}
        onSignInGoogle={async () => {
          setLoading(true);
          setError(undefined);
          try {
            await signInWithGoogle();
          } catch (err) {
            setError(err instanceof Error ? err.message : "ログインに失敗しました。");
          } finally {
            setLoading(false);
          }
        }}
        onContinueLocal={() => setLocalOnly(true)}
      />
    );
  }

  if (!activeProfile) {
    return (
      <ChildProfileScreen
        profiles={profiles}
        loading={loading}
        error={error}
        legacyImportAvailable={legacyImportAvailable}
        canImportToChild={(childId) => importableChildIds.includes(childId)}
        userLabel={user.email ?? user.displayName ?? "親アカウント"}
        onCreate={async (name, avatarEmoji) => {
          setLoading(true);
          setError(undefined);
          try {
            const nextOrder = profiles.reduce(
              (max, profile, index) => Math.max(max, profile.sortOrder ?? index),
              -1,
            ) + 1;
            await createChildProfile(user.uid, name, avatarEmoji, nextOrder);
            await refreshProfiles(user);
          } catch (err) {
            setError(err instanceof Error ? err.message : "プロフィール作成に失敗しました。");
          } finally {
            setLoading(false);
          }
        }}
        onOpen={(profile, mode) => openProfile(user, profile, mode)}
        onRestoreOrphan={restoreOrphan}
        orphans={orphans}
        onUpdate={async (profile, name, avatarEmoji) => {
          setLoading(true);
          setError(undefined);
          try {
            await updateChildProfile(user.uid, profile.id, name, avatarEmoji);
            await refreshProfiles(user);
          } catch (err) {
            setError(err instanceof Error ? err.message : "プロフィールの変更に失敗しました。");
          } finally {
            setLoading(false);
          }
        }}
        onMoveProfile={async (profileId, direction) => {
          const from = profiles.findIndex((profile) => profile.id === profileId);
          const to = from + direction;
          if (from < 0 || to < 0 || to >= profiles.length) return;
          const next = arrayMove(profiles, from, to);
          commitProfiles(next);
          setLoading(true);
          setError(undefined);
          try {
            await reorderChildProfiles(user.uid, next.map((profile) => profile.id));
            await refreshProfiles(user);
          } catch (err) {
            setError(err instanceof Error ? err.message : "順番の保存に失敗しました。");
            await refreshProfiles(user);
          } finally {
            setLoading(false);
          }
        }}
        onDelete={async (profile) => {
          setLoading(true);
          setError(undefined);
          try {
            await deleteChildProfile(user.uid, profile.id);
            await refreshProfiles(user);
          } catch (err) {
            setError(err instanceof Error ? err.message : "プロフィール削除に失敗しました。");
          } finally {
            setLoading(false);
          }
        }}
        onSignOut={async () => {
          await flushPendingSave();
          openedChildIdRef.current = null;
          seenUpdatedAtMsRef.current = 0;
          lastAppliedKeyRef.current = null;
          clearSelectedChildId();
          await signOutFirebase();
        }}
        onContinueLocal={() => setLocalOnly(true)}
      />
    );
  }

  return (
    <div
      key={appKey}
      style={{
        height: "100%",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {children(activeContext)}
    </div>
  );
}
