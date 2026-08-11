import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App.tsx";
import { CloudAppShell } from "./CloudAppShell.tsx";

// iOS ホーム画面PWAは更新が残りやすい。
// injectRegister: null のため、新SW検知時のリロードはここで明示する（取らないと古い画面のまま）。
let refreshing = false;
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
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
    // 起動直後にも一度取りにいく（バックグラウンド起動対策）
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
