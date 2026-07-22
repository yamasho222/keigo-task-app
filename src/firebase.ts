import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  indexedDBLocalPersistence,
  browserPopupRedirectResolver,
  type Auth,
  type User,
  type UserCredential,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/**
 * iPhone / iPad では firebaseapp.com とのクロスオリジンが壊れやすい。
 * 本番はアプリ自身のホストを authDomain にし、vercel.json で /__/auth をプロキシする。
 * ※ Google Cloud の OAuth クライアントに
 *   https://<本番ドメイン>/__/auth/handler
 *   を必ず登録すること。
 */
function resolveAuthDomain(): string | undefined {
  const configured = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;
  if (typeof window === "undefined") return configured;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return configured;
  return window.location.host;
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: resolveAuthDomain(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey
  && firebaseConfig.authDomain
  && firebaseConfig.projectId
  && firebaseConfig.appId,
);

function createFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) return null;
  return getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);
}

const app: FirebaseApp | null = createFirebaseApp();

function createAuth(firebaseApp: FirebaseApp): Auth {
  try {
    return initializeAuth(firebaseApp, {
      persistence: indexedDBLocalPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    return getAuth(firebaseApp);
  }
}

export const auth: Auth | null = app ? createAuth(app) : null;
export const db = app ? getFirestore(app) : null;

const googleProvider = new GoogleAuthProvider();

export type FirebaseUser = User;

function isAppleMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
            error_callback?: () => void;
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
        };
      };
    };
  }
}

function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>("script[data-keigo-gis]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Googleログイン用スクリプトの読み込みに失敗しました。")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.dataset.keigoGis = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Googleログイン用スクリプトの読み込みに失敗しました。"));
    document.head.appendChild(script);
  });
}

async function signInWithGoogleIdentityServices(clientId: string): Promise<void> {
  if (!auth) throw new Error("Firebase is not configured.");
  await loadGisScript();
  await new Promise<void>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "openid email profile",
      callback: (resp) => {
        void (async () => {
          if (resp.error || !resp.access_token) {
            reject(new Error("Googleログインがキャンセルされました。"));
            return;
          }
          try {
            const credential = GoogleAuthProvider.credential(null, resp.access_token);
            await signInWithCredential(auth!, credential);
            resolve();
          } catch (err) {
            reject(err instanceof Error ? err : new Error(authErrorMessage(err)));
          }
        })();
      },
      error_callback: () => {
        reject(new Error("Googleログインに失敗しました。もう一度お試しください。"));
      },
    });
    client.requestAccessToken({ prompt: "select_account" });
  });
}

export function listenAuthState(callback: (user: FirebaseUser | null) => void) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

let redirectResultPromise: Promise<UserCredential | null> | null = null;

function authErrorMessage(err: unknown): string {
  const code = typeof err === "object" && err && "code" in err
    ? String((err as { code?: string }).code)
    : "";
  const raw = err instanceof Error ? err.message : String(err ?? "");
  if (code === "auth/unauthorized-domain" || /unauthorized.domain/i.test(raw)) {
    return "このドメインは Firebase の承認済みドメインに登録されていません。";
  }
  if (/redirect_uri_mismatch/i.test(raw) || /redirect.uri/i.test(raw)) {
    return (
      "Google側の戻り先設定が不足しています。"
      + " Google Cloud の OAuth クライアントに "
      + "https://app-nine-phi-bomgfkrycz.vercel.app/__/auth/handler"
      + " を追加してください。"
    );
  }
  if (code === "auth/popup-blocked") {
    return "ポップアップがブロックされました。Safariで開いてログインしてください。";
  }
  if (code === "auth/popup-closed-by-user") {
    return "ログイン画面が閉じられました。もう一度お試しください。";
  }
  if (code === "auth/network-request-failed") {
    return "ネットワークエラーです。接続を確認して再度お試しください。";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Googleログインに失敗しました。";
}

export async function completeGoogleRedirectSignIn(): Promise<UserCredential | null> {
  if (!auth) return null;
  if (!redirectResultPromise) {
    redirectResultPromise = getRedirectResult(auth)
      .then((result) => result)
      .catch((err) => {
        redirectResultPromise = null;
        throw Object.assign(err instanceof Error ? err : new Error(authErrorMessage(err)), {
          message: authErrorMessage(err),
        });
      });
  }
  return redirectResultPromise;
}

export async function signInWithGoogle() {
  if (!auth) throw new Error("Firebase is not configured.");

  const gisClientId = (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined)?.trim();

  // iPhone / iPad: GIS（redirect を使わない）が最優先
  if (isAppleMobile()) {
    if (gisClientId) {
      await signInWithGoogleIdentityServices(gisClientId);
      return;
    }
    // Client ID 未設定時はポップアップを試し、失敗時は設定手順を出す
    try {
      await signInWithPopup(auth, googleProvider);
      return;
    } catch (err) {
      throw new Error(
        `${authErrorMessage(err)}\n\n`
        + "iPhoneで安定してログインするには、Firebase の Google「ウェブクライアント ID」を "
        + "Vercel の環境変数 VITE_GOOGLE_WEB_CLIENT_ID に追加してください。\n"
        + "また redirect_uri_mismatch の場合は Google Cloud に "
        + "https://app-nine-phi-bomgfkrycz.vercel.app/__/auth/handler を追加してください。",
      );
    }
  }

  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    throw Object.assign(err instanceof Error ? err : new Error(authErrorMessage(err)), {
      message: authErrorMessage(err),
    });
  }
}

export async function signOutFirebase() {
  if (!auth) return;
  await signOut(auth);
}
