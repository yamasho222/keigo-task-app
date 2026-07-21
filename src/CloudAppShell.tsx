/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability, react-hooks/preserve-manual-memoization, react-hooks/refs, react-hooks/exhaustive-deps */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AuthScreen } from "./AuthScreen";
import { ChildProfileScreen } from "./ChildProfileScreen";
import {
  clearSelectedChildId,
  hasLocalAppState,
  hasLocalImportSeen,
  loadLocalAppStateSnapshot,
  loadSelectedChildId,
  markLocalImportSeen,
  saveSelectedChildId,
  writeLocalAppStateSnapshot,
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

function isMeaningfulSnapshot(snapshot: ReturnType<typeof loadLocalAppStateSnapshot> | null): boolean {
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
  const initialLocalSnapshotRef = useRef(loadLocalAppStateSnapshot());
  const saveTimerRef = useRef<number | null>(null);
  const deviceId = useMemo(() => createDeviceId(), []);

  const refreshProfiles = useCallback(async (currentUser = user) => {
    if (!currentUser) return;
    const nextProfiles = await listChildProfiles(currentUser.uid);
    setProfiles(nextProfiles);
  }, [user]);

  const openProfile = useCallback(async (
    currentUser: FirebaseUser,
    profile: ChildProfile,
    mode: OpenMode,
  ) => {
    setLoading(true);
    setError(undefined);
    try {
      const localSnapshot = initialLocalSnapshotRef.current;
      const localMeaningful = isMeaningfulSnapshot(localSnapshot);

      if (mode === "importLocal") {
        if (!localMeaningful) {
          setError("この端末に取り込める既存データがありません。");
          return;
        }
        const existingCloud = await loadCloudAppState(currentUser.uid, profile.id);
        if (isMeaningfulSnapshot(existingCloud)) {
          if (!window.confirm(
            `「${profile.name}」には、すでに別のスマホの記録があります。\nこのスマホの記録で上書きしてつなぎますか？\n（このスマホの記録はそのまま残ります）`,
          )) {
            return;
          }
        } else if (!window.confirm(
          `このスマホの記録を「${profile.name}」につなぎます。\nこのスマホの記録は消えません。よろしいですか？`,
        )) {
          return;
        }
        await saveCloudAppState(currentUser.uid, profile.id, localSnapshot, deviceId);
        markLocalImportSeen(profile.id);
        writeLocalAppStateSnapshot(localSnapshot);
      } else {
        const cloudState = await loadCloudAppState(currentUser.uid, profile.id);
        const cloudMeaningful = isMeaningfulSnapshot(cloudState);

        if (cloudMeaningful) {
          if (localMeaningful && !hasLocalImportSeen(profile.id)) {
            if (!window.confirm(
              `「${profile.name}」の別スマホの記録で、このスマホを上書きします。\nこのスマホの未つなぎの記録は消えます。\nはじめてならキャンセルして「このスマホの記録を、この子につなぐ」を使ってください。\n上書きして開きますか？`,
            )) {
              return;
            }
          }
          writeLocalAppStateSnapshot(cloudState!);
        } else if (localMeaningful) {
          if (!window.confirm(
            `「${profile.name}」には、まだつなげた記録がありません。\nこのスマホの記録をつなぎますか？\n（キャンセルしてもこのスマホの記録は消えません）`,
          )) {
            return;
          }
          await saveCloudAppState(currentUser.uid, profile.id, localSnapshot, deviceId);
          markLocalImportSeen(profile.id);
          writeLocalAppStateSnapshot(localSnapshot);
        } else {
          // 端末もクラウドも空: 空プロフィールとして開く（消すものがない）
          writeLocalAppStateSnapshot({ state: null, stickerAlbum: [] });
          await saveCloudAppState(currentUser.uid, profile.id, { state: null, stickerAlbum: [] }, deviceId);
          markLocalImportSeen(profile.id);
        }
      }
      await touchChildProfile(currentUser.uid, profile.id);
      saveSelectedChildId(profile.id);
      setActiveProfile(profile);
      setSyncStatus("同期準備OK");
      setAppKey(profile.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "プロフィールを開けませんでした。");
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    if (!isFirebaseConfigured || localOnly) {
      setAuthLoading(false);
      return;
    }
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      try {
        await completeGoogleRedirectSignIn();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Googleログインに失敗しました。");
          setAuthLoading(false);
        }
      }
      if (cancelled) return;
      unsubscribe = listenAuthState(async (nextUser) => {
        setUser(nextUser);
        setAuthLoading(false);
        if (!nextUser) {
          setProfiles([]);
          setActiveProfile(null);
          return;
        }
        setLoading(true);
        setError(undefined);
        try {
          await ensureParentUser(nextUser.uid, nextUser.email);
          const nextProfiles = await listChildProfiles(nextUser.uid);
          setProfiles(nextProfiles);
          const selectedId = loadSelectedChildId();
          const selected = nextProfiles.find((profile) => profile.id === selectedId);
          if (selected) await openProfile(nextUser, selected, "cloud");
        } catch (err) {
          setError(err instanceof Error ? err.message : "プロフィールの読み込みに失敗しました。");
        } finally {
          setLoading(false);
        }
      });
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [localOnly, openProfile]);

  const saveState = useCallback((state: unknown, stickerAlbum: string[]) => {
    if (!user || !activeProfile) return;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    setSyncStatus("保存待ち");
    saveTimerRef.current = window.setTimeout(() => {
      setSyncStatus("保存中...");
      saveCloudAppState(user.uid, activeProfile.id, { state, stickerAlbum }, deviceId)
        .then(() => setSyncStatus("同期済み"))
        .catch((err) => setSyncStatus(err instanceof Error ? `同期エラー: ${err.message}` : "同期エラー"));
    }, 800);
  }, [activeProfile, deviceId, user]);

  const onSwitchProfile = useCallback(() => {
    if (!window.confirm("プロフィール選択画面に戻りますか？未同期の変更がある場合は少し待ってから切り替えてください。")) return;
    setActiveProfile(null);
    clearSelectedChildId();
    setAppKey("profile-select");
  }, []);

  const onSignOut = useCallback(async () => {
    setActiveProfile(null);
    clearSelectedChildId();
    await signOutFirebase();
  }, []);

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
    const importAvailable = hasLocalAppState(initialLocalSnapshotRef.current);
    return (
      <ChildProfileScreen
        profiles={profiles}
        loading={loading}
        error={error}
        localImportAvailable={importAvailable}
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
          clearSelectedChildId();
          await signOutFirebase();
        }}
        onContinueLocal={() => setLocalOnly(true)}
      />
    );
  }

  return <div key={appKey}>{children(activeContext)}</div>;
}
