import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App.tsx";
import { CloudAppShell } from "./CloudAppShell.tsx";

// iOS ホーム画面PWAは、起動時の SW 初回制御でも controllerchange が飛ぶ。
// そこで無条件リロードすると、閉じて開き直すたびに真っ白のまま回り続ける。
const RELOAD_GUARD_KEY = "pwa-sw-reload-at";
const RELOAD_GUARD_MS = 15_000;
let pendingReload = false;
let refreshing = false;

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!pendingReload || refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? "0");
    if (Date.now() - last < RELOAD_GUARD_MS) return;
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
    pendingReload = true;
    void updateSW(true);
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    const check = () => {
      void registration.update();
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") check();
    });
    window.addEventListener("focus", check);
    window.setInterval(check, 30 * 60 * 1000);
    check();
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CloudAppShell>
      {(cloud) => <App cloud={cloud} />}
    </CloudAppShell>
  </StrictMode>,
);
