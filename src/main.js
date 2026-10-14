import { createApp } from "vue";
import { createPinia } from "pinia";

import App from "./App.vue";
import router from "./router";
import { useUserStore } from "./stores/user";
import { useMapStore } from "./stores/map";
import { useMarketStore } from "./stores/market";
import { useHousingWorkbenchStore } from "./stores/housingWorkbench";
import { readHousingDrafts } from "./housing/drafts.mjs";
import { installUiI18n } from "./i18n/vue";
import { activateUiLanguage } from "./i18n/index.mjs";

import "./assets/main.css";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
// Restore preferences before the first navigation decides which data to load.
useUserStore().migrate(localStorage.getItem("user"));
for (const [key, store] of [
  ["map", useMapStore()],
  ["market", useMarketStore()],
]) {
  const saved = localStorage.getItem(key);
  if (saved) store.$patch(JSON.parse(saved));
}
useMarketStore().apiFetching = false;
if (useMarketStore().apiRegion !== useUserStore().selectedRegion) {
  useMarketStore().$patch({
    apiPrices: {},
    apiDatetime: 0,
    ready: false,
    apiAlive: false,
    apiPartial: false,
    apiMissingCount: 0,
  });
}
try {
  useHousingWorkbenchStore().$patch(
    readHousingDrafts(localStorage.getItem("housingWorkbench"))
  );
} catch {
  useHousingWorkbenchStore().storageError =
    "Some saved drafts could not be read. Saved empire settings are still available.";
}
async function start() {
  try {
    await activateUiLanguage(useUserStore().selectedLang);
  } catch (error) {
    console.error('UI language load failed', error);
  }
  installUiI18n(app, useUserStore());
  app.use(router);
  app.mount("#app");
}
start();
