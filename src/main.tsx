import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";

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

const root = createRoot(document.getElementById("root")!);
if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("water-sling") === "1") {
  void import("./WaterSlingLab").then(({ default: WaterSlingLab }) => root.render(<StrictMode><WaterSlingLab /></StrictMode>));
} else if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("task-settings") === "1") {
  void import("./TaskSettingsLab").then(({ default: TaskSettingsLab }) => root.render(<StrictMode><TaskSettingsLab /></StrictMode>));
} else if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("battle-effects") === "1") {
  void import("./BattleEffectsLab").then(({ default: BattleEffectsLab }) => root.render(<StrictMode><BattleEffectsLab /></StrictMode>));
} else if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("adventure-release") === "1") {
  void import("./AdventureReleaseLab").then(({ default: AdventureReleaseLab }) => root.render(<StrictMode><AdventureReleaseLab /></StrictMode>));
} else if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("dragon-campaign") === "1") {
  // Isolated long campaign: exclusive DEV storage, never load real profiles/cloud.
  void import("./DragonCampaignLab").then(({ default: DragonCampaignLab }) => root.render(<StrictMode><DragonCampaignLab /></StrictMode>));
} else if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("end-journey") === "1") {
  // Memory-only progression checks. Never mount real profiles/cloud/save handlers.
  void import("./EndJourneyLab").then(({ default: EndJourneyLab }) => root.render(<StrictMode><EndJourneyLab /></StrictMode>));
} else if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("enderman-prototype") === "1") {
  // Disposable battle: no real profiles, inventory, cloud, or save handlers.
  void import("./EndermanPrototype").then(({ default: EndermanPrototype }) => root.render(<StrictMode><EndermanPrototype /></StrictMode>));
} else if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("blaze-prototype") === "1") {
  // Standalone prototype: never import the real app, cloud, or save handlers.
  void import("./BlazePrototype").then(({ default: BlazePrototype }) => root.render(<StrictMode><BlazePrototype /></StrictMode>));
} else if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("combat-v2") === "1") {
  // Do not mount CloudAppShell/App: lab data must never sync to a real child profile.
  void import("./CombatV2Lab").then(({ default: CombatV2Lab }) => root.render(<StrictMode><CombatV2Lab /></StrictMode>));
} else void Promise.all([import("./App.tsx"), import("./CloudAppShell.tsx")]).then(([{ default: App }, { CloudAppShell }]) => root.render(
  <StrictMode>
    <CloudAppShell>
      {(cloud) => <App cloud={cloud} />}
    </CloudAppShell>
  </StrictMode>,
));
