/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability, react-hooks/preserve-manual-memoization, react-hooks/refs, react-hooks/exhaustive-deps */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  type LocalAppStateSnapshot,
} from "./appStateStorage";
import {
  createChildProfile,
  createDeviceId,
  deleteChildProfile,
  ensureParentUser,
  listChildProfiles,
  loadCloudAppState,
  saveCloudAppState,
  touchChildProfile,
  type ActiveChildContext,
  type ChildProfile,
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
  const deviceId = useMemo(() => createDeviceId(), []);
  /** レガシー共有データの有無（プロフィール選択画面の再表示用） */
  const [legacyImportAvailable, setLegacyImportAvailable] = useState(false);
  /** 初回「つなぐ」を出してよい childId（クラウド未作成の子だけ） */
  const [importableChildIds, setImportableChildIds] = useState<string[]>([]);

  const applyChildSnapshot = useCallback((childId: string, snapshot: LocalAppStateSnapshot) => {
    writeLocalAppStateSnapshot(snapshot, childId);
  }, []);

  const flushPendingSave = useCallback(async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingSaveRef.current;
    if (!pending) return;
    pendingSaveRef.current = null;
    try {
      await saveCloudAppState(
        pending.userId,
        pending.childId,
        { state: pending.state, stickerAlbum: pending.stickerAlbum },
        deviceId,
      );
      writeLocalAppStateSnapshot(
        { state: pending.state, stickerAlbum: pending.stickerAlbum },
        pending.childId,
      );
    } catch {
      // 切替時のフラッシュ失敗は握りつぶし（次回同期に任せる）
    }
  }, [deviceId]);

  /** クラウド済みの子は「つなぐ」対象外にし、不要な共有スロットも片付ける */
  const reconcileImportEligibility = useCallback(async (
    userId: string,
    nextProfiles: ChildProfile[],
  ) => {
    const importable: string[] = [];
    for (const profile of nextProfiles) {
      if (!canImportLegacyToChild(profile.id)) continue;
      const cloudState = await loadCloudAppState(userId, profile.id);
      if (isMeaningfulSnapshot(cloudState)) {
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

  const refreshProfiles = useCallback(async (currentUser = user) => {
    if (!currentUser) return;
    const nextProfiles = await listChildProfiles(currentUser.uid);
    setProfiles(nextProfiles);
    await reconcileImportEligibility(currentUser.uid, nextProfiles);
  }, [reconcileImportEligibility, user]);

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
        if (isMeaningfulSnapshot(existingCloud)) {
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
        await saveCloudAppState(currentUser.uid, profile.id, legacySnapshot, deviceId);
        applyChildSnapshot(profile.id, legacySnapshot);
        markLocalImportSeen(profile.id);
        // 共有スロットは使い切り。別の子へ同じデータをつなぐ事故を防ぐ
        clearLegacyUnscopedSnapshot();
        setImportableChildIds([]);
        setLegacyImportAvailable(false);
      } else {
        const cloudState = await loadCloudAppState(currentUser.uid, profile.id);
        const cloudMeaningful = isMeaningfulSnapshot(cloudState);

        if (cloudMeaningful) {
          // クラウドを正とし、その子専用の端末キャッシュへ書く（他の子の領域は触らない）
          applyChildSnapshot(profile.id, cloudState!);
          markLocalImportSeen(profile.id);
        } else if (childLocalMeaningful) {
          // クラウド空・子専用キャッシュあり → その子のデータをクラウドへ上げる
          if (!window.confirm(
            `「${profile.name}」のクラウドにはまだ記録がありません。\nこのスマホに残っている「${profile.name}」の記録をつなぎますか？`,
          )) {
            return;
          }
          await saveCloudAppState(currentUser.uid, profile.id, childLocal, deviceId);
          applyChildSnapshot(profile.id, childLocal);
          markLocalImportSeen(profile.id);
        } else if (legacyMeaningful && !hasLocalImportSeen(profile.id)) {
          setError(
            `「${profile.name}」にはまだクラウドの記録がありません。\n初回は「このスマホの記録を、この子につなぐ」を使ってください。`,
          );
          return;
        } else {
          const empty = { state: null, stickerAlbum: [] as string[] };
          applyChildSnapshot(profile.id, empty);
          await saveCloudAppState(currentUser.uid, profile.id, empty, deviceId);
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
  }, [applyChildSnapshot, deviceId, flushPendingSave, reconcileImportEligibility]);

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
        setActiveProfile(null);
        openedChildIdRef.current = null;
        return;
      }
      setLoading(true);
      setError(undefined);
      try {
        await ensureParentUser(nextUser.uid, nextUser.email);
        const nextProfiles = await listChildProfiles(nextUser.uid);
        if (cancelled) return;
        setProfiles(nextProfiles);
        await reconcileImportEligibility(nextUser.uid, nextProfiles);
        if (cancelled) return;
        const selectedId = loadSelectedChildId();
        const selected = nextProfiles.find((profile) => profile.id === selectedId);
        if (selected) await openProfileRef.current(nextUser, selected, "cloud");
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
      saveCloudAppState(pending.userId, pending.childId, {
        state: pending.state,
        stickerAlbum: pending.stickerAlbum,
      }, deviceId)
        .then(() => setSyncStatus("同期済み"))
        .catch((err) => setSyncStatus(err instanceof Error ? `同期エラー: ${err.message}` : "同期エラー"));
    }, 800);
  }, [activeProfile, deviceId, user]);

  const onSwitchProfile = useCallback(() => {
    if (!window.confirm("プロフィール選択画面に戻りますか？未同期の変更がある場合は少し待ってから切り替えてください。")) return;
    void flushPendingSave().finally(() => {
      openedChildIdRef.current = null;
      setActiveProfile(null);
      clearSelectedChildId();
      setAppKey("profile-select");
      if (user) {
        void listChildProfiles(user.uid).then((nextProfiles) => {
          setProfiles(nextProfiles);
          return reconcileImportEligibility(user.uid, nextProfiles);
        });
      } else {
        setImportableChildIds([]);
        setLegacyImportAvailable(false);
      }
    });
  }, [flushPendingSave, reconcileImportEligibility, user]);

  const onSignOut = useCallback(async () => {
    await flushPendingSave();
    openedChildIdRef.current = null;
    setActiveProfile(null);
    clearSelectedChildId();
    await signOutFirebase();
  }, [flushPendingSave]);

  const activeContext: ActiveChildContext | undefined = useMemo(() => {
    if (!user || !activeProfile) return undefined;
    return {
      parentUserId: user.uid,
      childId: activeProfile.id,
      childName: activeProfile.name,
      avatarEmoji: activeProfile.avatarEmoji,
      syncStatus,
      saveState,
      onSwitchProfile,
      onSignOut,
    };
  }, [user, activeProfile, syncStatus, saveState, onSwitchProfile, onSignOut]);

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
            await createChildProfile(user.uid, name, avatarEmoji);
            await refreshProfiles(user);
          } catch (err) {
            setError(err instanceof Error ? err.message : "プロフィール作成に失敗しました。");
          } finally {
            setLoading(false);
          }
        }}
        onOpen={(profile, mode) => openProfile(user, profile, mode)}
        onDelete={async (profile) => {
          if (!window.confirm(`「${profile.name}」プロフィールを削除します。クラウド上のデータも削除されます。よろしいですか？`)) return;
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
