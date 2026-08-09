import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App.tsx";
import { CloudAppShell } from "./CloudAppShell.tsx";

// iOS ホーム画面PWAは更新が残りやすいので、起動時・復帰時に SW 更新を取りにいく
registerSW({
  immediate: true,
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
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CloudAppShell>
      {(cloud) => <App cloud={cloud} />}
    </CloudAppShell>
  </StrictMode>,
);
